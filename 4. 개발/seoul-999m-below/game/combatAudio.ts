import type { HeroId } from "./content";
import {
  COMBAT_SAMPLES,
  MUSIC_BY_CAMPAIGN,
  MUSIC_BY_MAP,
  MUSIC_TRACKS,
  type DigMaterial,
  type ImpactMaterial,
  type MusicId,
  type VoiceSlot,
  voiceLine,
} from "./audioCatalog";
import type { BattleMapId } from "./matchConfig";

export type CombatSfx = "dig" | "rootDig" | "metalDig" | "hit" | "shield" | "shot" | "swing" | "item" | "evade" | "acid" | "laser" | "blast" | "heal" | "coin" | "build" | "warning" | "down" | "victory" | "defeat";

const SFX_PRESETS: Record<CombatSfx, [number, number, number, OscillatorType]> = {
  dig: [105, .08, .08, "square"], rootDig: [132, .1, .07, "sawtooth"], metalDig: [280, .11, .06, "triangle"],
  hit: [72, .1, .085, "sawtooth"], shield: [190, .14, .08, "triangle"], shot: [430, .09, .065, "triangle"],
  swing: [235, .13, .07, "sawtooth"], item: [620, .2, .07, "triangle"], evade: [410, .16, .065, "sine"],
  acid: [155, .18, .065, "sawtooth"], laser: [780, .13, .06, "sine"], blast: [48, .3, .12, "sawtooth"],
  heal: [520, .22, .055, "sine"], coin: [760, .13, .055, "sine"], build: [230, .22, .07, "square"],
  warning: [330, .32, .07, "square"], down: [92, .4, .09, "triangle"], victory: [392, .75, .08, "triangle"], defeat: [110, .8, .08, "sawtooth"],
};

/** 화면 전환에도 끊기지 않는 게임 전역 오디오 엔진. */
export class CombatAudio {
  private context: AudioContext | null = null;
  private effects: GainNode | null = null;
  private desiredMusic: MusicId | null = null;
  private currentMusic: MusicId | null = null;
  private music: HTMLAudioElement | null = null;
  private unlocked = false;
  private lastSfx = new Map<CombatSfx, number>();
  private voicePriority = 0;
  private voiceUntil = 0;
  private activeVoice: HTMLAudioElement | null = null;
  private duckTimer: ReturnType<typeof setTimeout> | null = null;
  private sampleCache = new Map<string, HTMLAudioElement>();
  private sampleCursor = new Map<string, number>();
  private lastSample = new Map<string, number>();

  private ensureEffects() {
    if (typeof window === "undefined") return null;
    this.context ??= new AudioContext();
    if (!this.effects) {
      this.effects = this.context.createGain();
      this.effects.gain.value = .72;
      this.effects.connect(this.context.destination);
    }
    return this.context;
  }

  async unlock() {
    this.unlocked = true;
    this.preloadCombatSamples();
    const context = this.ensureEffects();
    if (context?.state === "suspended") await context.resume().catch(() => undefined);
    if (this.desiredMusic) await this.playMusic(this.desiredMusic);
  }

  async start(mapId: BattleMapId) { await this.selectMusic(MUSIC_BY_MAP[mapId]); }
  async startCampaign(chapter: number) { await this.selectMusic(MUSIC_BY_CAMPAIGN[chapter] ?? "shelter-network"); }
  async startMenu() { await this.selectMusic("shelter-network"); }

  private async selectMusic(id: MusicId) {
    this.desiredMusic = id;
    if (this.unlocked) await this.playMusic(id);
  }

  private async playMusic(id: MusicId) {
    if (typeof Audio === "undefined") return;
    if (this.currentMusic === id && this.music) {
      if (this.music.paused) await this.music.play().catch(() => undefined);
      return;
    }
    const previous = this.music, next = new Audio(MUSIC_TRACKS[id].file);
    next.loop = true; next.preload = "auto"; next.volume = 0;
    this.music = next; this.currentMusic = id;
    await next.play().catch(() => undefined);
    const started = performance.now();
    const fade = () => {
      const progress = Math.min(1, (performance.now() - started) / 700);
      next.volume = .38 * progress;
      if (previous) previous.volume = Math.max(0, .38 * (1 - progress));
      if (progress < 1) requestAnimationFrame(fade);
      else if (previous) { previous.pause(); previous.src = ""; }
    };
    fade();
  }

  stopMusic() {
    this.desiredMusic = null; this.currentMusic = null;
    if (this.music) { this.music.pause(); this.music.src = ""; }
    this.music = null;
  }

  async sfx(kind: CombatSfx) {
    const context = this.ensureEffects();
    if (!context || context.state !== "running" || !this.effects) return;
    const nowMs = performance.now(), last = this.lastSfx.get(kind) ?? -Infinity;
    if (nowMs - last < (["hit", "shot", "dig"].includes(kind) ? 65 : 25)) return;
    this.lastSfx.set(kind, nowMs);
    const [frequency, duration, volume, type] = SFX_PRESETS[kind], at = context.currentTime;
    this.note(frequency, at, duration, volume, type);
    if (["dig", "rootDig", "blast", "acid", "swing", "evade"].includes(kind)) this.noise(at, duration * .75, volume * .52, kind === "blast" ? 260 : kind === "swing" ? 1100 : 720);
    if (kind === "item") this.note(frequency * 1.32, at + .07, .15, volume * .8, "sine");
    if (kind === "victory") {
      this.note(frequency * 1.25, at + .18, .5, volume, "triangle");
      this.note(frequency * 1.5, at + .36, .65, volume, "triangle");
    }
  }

  /** 피격 대상의 재질과 치명타 여부를 반영한 실제 전투 샘플을 재생한다. */
  async impact(material: ImpactMaterial, critical = false, prominence = 1) {
    const key = critical ? "impact-critical" : `impact-${material}`;
    const files = critical ? COMBAT_SAMPLES.critical : COMBAT_SAMPLES.impact[material];
    await this.playSample(key, files, (critical ? .98 : .76) * prominence * .5, critical ? 70 : 55);
  }

  /** 벽 재질과 최종 붕괴 여부를 구분한 굴착 샘플을 재생한다. */
  async dig(material: DigMaterial, collapsed = false, prominence = 1) {
    const key = collapsed ? "dig-collapse" : `dig-${material}`,
      files = collapsed ? COMBAT_SAMPLES.collapse : COMBAT_SAMPLES.dig[material];
    await this.playSample(key, files, (collapsed ? .9 : .7) * prominence * .5, collapsed ? 95 : 62);
  }

  /** 진영별 전투불능 샘플. 주인공 사망은 BGM을 잠시 낮춰 원인을 들려준다. */
  async down(faction: Exclude<ImpactMaterial, "structure">, hero = false, prominence = 1) {
    if (hero) this.duckMusic(650, .08);
    await this.playSample(`down-${faction}`, COMBAT_SAMPLES.down[faction], (hero ? 1 : .78) * prominence, 90);
  }

  async result(outcome: "win" | "lose") {
    this.duckMusic(1750, .1);
    await this.playSample(
      `result-${outcome}`,
      [outcome === "win" ? COMBAT_SAMPLES.victory : COMBAT_SAMPLES.defeat],
      1,
      1200,
    );
  }

  /** 캐릭터별 스킬음과 대사를 함께 재생한다. 필살기는 낮은 우선순위 대사를 끊는다. */
  async skillCue(heroId: HeroId, slot: VoiceSlot, volume = 1, priority = slot === 4 ? 5 : 2) {
    const line = voiceLine(heroId, slot);
    if (!line || !this.unlocked) return;
    const now = performance.now();
    if (now < this.voiceUntil && priority < this.voicePriority) return;
    this.voicePriority = priority;
    this.voiceUntil = now + (slot === 4 ? 2400 : 1300);
    this.skillSignature(heroId, slot, volume);
    if (this.activeVoice && priority >= this.voicePriority) {
      this.activeVoice.pause();
      this.activeVoice.currentTime = 0;
    }
    const audio = new Audio(line.file);
    audio.preload = "auto";
    audio.volume = Math.min(1, (slot === 4 ? .96 : .82) * volume);
    audio.playbackRate = Math.min(4, line.playbackRate * 2);
    audio.preservesPitch = line.style !== "ai" && line.style !== "bugborn";
    this.activeVoice = audio;
    this.duckMusic(slot === 4 ? 2700 : 1500);
    audio.addEventListener("ended", () => {
      if (this.activeVoice === audio) {
        this.activeVoice = null;
        this.voicePriority = 0;
        this.voiceUntil = 0;
      }
    }, { once: true });
    await audio.play().catch(() => undefined);
  }

  private duckMusic(duration: number, target = .15) {
    if (!this.music) return;
    this.music.volume = target;
    if (this.duckTimer) clearTimeout(this.duckTimer);
    this.duckTimer = setTimeout(() => {
      if (this.music) this.music.volume = .38;
      this.duckTimer = null;
    }, duration);
  }

  private preloadCombatSamples() {
    if (typeof Audio === "undefined" || this.sampleCache.size) return;
    const files = [
      ...Object.values(COMBAT_SAMPLES.impact).flat(),
      ...COMBAT_SAMPLES.critical,
      ...Object.values(COMBAT_SAMPLES.dig).flat(),
      ...COMBAT_SAMPLES.collapse,
      ...Object.values(COMBAT_SAMPLES.down).flat(),
      COMBAT_SAMPLES.victory,
      COMBAT_SAMPLES.defeat,
    ];
    for (const file of files) {
      const audio = new Audio(file);
      audio.preload = "auto";
      this.sampleCache.set(file, audio);
    }
  }

  private async playSample(key: string, files: string[], volume: number, throttle: number) {
    if (!this.unlocked || typeof Audio === "undefined" || files.length === 0) return;
    const now = performance.now(), last = this.lastSample.get(key) ?? -Infinity;
    if (now - last < throttle) return;
    this.lastSample.set(key, now);
    this.preloadCombatSamples();
    const cursor = this.sampleCursor.get(key) ?? 0,
      file = files[cursor % files.length],
      template = this.sampleCache.get(file),
      audio = template?.cloneNode(true) as HTMLAudioElement | undefined;
    this.sampleCursor.set(key, cursor + 1);
    const playable = audio ?? new Audio(file);
    playable.preload = "auto";
    playable.volume = Math.max(0, Math.min(1, volume));
    playable.playbackRate = [0.97, 1, 1.035][cursor % 3];
    await playable.play().catch(() => undefined);
  }

  private skillSignature(heroId: HeroId, slot: VoiceSlot, volume: number) {
    const context = this.ensureEffects();
    if (!context || context.state !== "running") return;
    let hash = 0;
    for (const char of heroId) hash = (hash * 31 + char.charCodeAt(0)) | 0;
    const base = 170 + Math.abs(hash % 360), at = context.currentTime;
    this.note(base * (slot === 4 ? .7 : 1), at, slot === 4 ? .42 : .18, .06 * volume, slot === 4 ? "sawtooth" : "triangle");
    this.note(base * (1 + slot * .16), at + .07, slot === 4 ? .55 : .2, .045 * volume, "square");
    if (slot === 4) this.noise(at, .34, .055 * volume, 540);
  }

  private note(frequency: number, at: number, duration: number, volume: number, type: OscillatorType) {
    if (!this.context || !this.effects) return;
    const oscillator = this.context.createOscillator(), gain = this.context.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(28, frequency * .78), at + duration);
    gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(volume, at + .012); gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(gain); gain.connect(this.effects); oscillator.start(at); oscillator.stop(at + duration + .02);
  }

  private noise(at: number, duration: number, volume: number, lowpass: number) {
    if (!this.context || !this.effects) return;
    const length = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate), data = buffer.getChannelData(0);
    for (let index = 0; index < length; index++) data[index] = Math.random() * 2 - 1;
    const source = this.context.createBufferSource(), filter = this.context.createBiquadFilter(), gain = this.context.createGain();
    source.buffer = buffer; filter.type = "lowpass"; filter.frequency.value = lowpass;
    gain.gain.setValueAtTime(volume, at); gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    source.connect(filter); filter.connect(gain); gain.connect(this.effects); source.start(at);
  }
}

export const gameAudio = new CombatAudio();

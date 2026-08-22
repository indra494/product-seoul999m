import type { BattleMapId } from "./matchConfig";

export type CombatSfx =
  | "dig"
  | "rootDig"
  | "metalDig"
  | "hit"
  | "shield"
  | "shot"
  | "acid"
  | "laser"
  | "blast"
  | "heal"
  | "coin"
  | "build"
  | "warning"
  | "down"
  | "victory"
  | "defeat";

type Theme = {
  bpm: number;
  root: number;
  bass: number[];
  signal: number[];
  wave: OscillatorType;
  swing: number;
};

const THEMES: Record<BattleMapId, Theme> = {
  "central-exchange": { bpm: 92, root: 46, bass: [0, 0, 5, 3, 0, 7, 5, 3], signal: [12, 7, 10, 5], wave: "triangle", swing: 0.08 },
  "flooded-pump": { bpm: 78, root: 41, bass: [0, 3, 0, 5, 0, 3, 7, 5], signal: [12, 15, 10, 14], wave: "sine", swing: 0.16 },
  "root-lab": { bpm: 86, root: 43, bass: [0, 1, 6, 0, 4, 1, 8, 6], signal: [13, 8, 14, 7, 11], wave: "sawtooth", swing: 0.22 },
  "freight-fork": { bpm: 104, root: 49, bass: [0, 0, 7, 5, 3, 3, 10, 7], signal: [12, 10, 15, 7], wave: "square", swing: 0.05 },
  "thermal-shaft": { bpm: 112, root: 52, bass: [0, 5, 3, 8, 7, 3, 10, 8], signal: [12, 14, 17, 15, 19], wave: "sawtooth", swing: 0.11 },
};

const semitone = (root: number, step: number) => root * 2 ** (step / 12);

export class CombatAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private effects: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private drones: OscillatorNode[] = [];
  private beat = 0;
  private mapId: BattleMapId | null = null;
  private lastSfx = new Map<CombatSfx, number>();

  private async ready() {
    this.context ??= new AudioContext();
    if (this.context.state === "suspended") await this.context.resume();
    if (!this.master) {
      this.master = this.context.createGain();
      this.music = this.context.createGain();
      this.effects = this.context.createGain();
      this.master.gain.value = 0.72;
      this.music.gain.value = 0.34;
      this.effects.gain.value = 0.78;
      this.music.connect(this.master);
      this.effects.connect(this.master);
      this.master.connect(this.context.destination);
    }
    return this.context;
  }

  async start(mapId: BattleMapId) {
    const context = await this.ready();
    if (this.mapId === mapId && this.timer) return;
    this.stopMusic();
    this.mapId = mapId;
    const theme = THEMES[mapId], now = context.currentTime;
    for (const [frequency, gainValue, type] of [
      [theme.root, 0.045, "sine"],
      [theme.root * 1.5, 0.014, theme.wave],
    ] as const) {
      const oscillator = context.createOscillator(), gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      gain.gain.setValueAtTime(gainValue, now);
      oscillator.connect(gain);
      gain.connect(this.music!);
      oscillator.start(now);
      this.drones.push(oscillator);
    }
    const interval = (60000 / theme.bpm) / 2;
    this.beat = 0;
    this.scheduleBeat(theme);
    this.timer = setInterval(() => this.scheduleBeat(theme), interval);
  }

  private scheduleBeat(theme: Theme) {
    const context = this.context;
    if (!context || context.state !== "running" || !this.music) return;
    const index = this.beat++, at = context.currentTime + (index % 2 ? theme.swing * 0.08 : 0),
      bassStep = theme.bass[index % theme.bass.length],
      signalStep = theme.signal[Math.floor(index / 2) % theme.signal.length];
    this.note(semitone(theme.root, bassStep), at, 0.32, index % 4 === 0 ? 0.07 : 0.042, theme.wave, this.music);
    if (index % 2 === 0)
      this.note(semitone(theme.root, signalStep), at + 0.03, 0.18, 0.018, "triangle", this.music);
    if (index % 8 === 6) this.noise(at, 0.16, 0.012, this.music, 520);
  }

  private note(frequency: number, at: number, duration: number, volume: number, type: OscillatorType, destination: AudioNode) {
    const context = this.context! , oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(28, frequency * 0.78), at + duration);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(volume, at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(at);
    oscillator.stop(at + duration + 0.02);
  }

  private noise(at: number, duration: number, volume: number, destination: AudioNode, lowpass: number) {
    const context = this.context!, length = Math.max(1, Math.floor(context.sampleRate * duration)),
      buffer = context.createBuffer(1, length, context.sampleRate), data = buffer.getChannelData(0);
    for (let index = 0; index < length; index++) data[index] = Math.random() * 2 - 1;
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
    source.buffer = buffer;
    filter.type = "lowpass";
    filter.frequency.value = lowpass;
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    source.start(at);
  }

  async sfx(kind: CombatSfx) {
    const context = await this.ready(), nowMs = performance.now(), last = this.lastSfx.get(kind) ?? -Infinity,
      throttle = ["hit", "shot", "dig"].includes(kind) ? 65 : 25;
    if (nowMs - last < throttle || !this.effects) return;
    this.lastSfx.set(kind, nowMs);
    const at = context.currentTime,
      presets: Record<CombatSfx, [number, number, number, OscillatorType]> = {
        dig: [105, 0.08, 0.07, "square"], rootDig: [132, 0.1, 0.06, "sawtooth"], metalDig: [280, 0.11, 0.05, "triangle"],
        hit: [72, 0.1, 0.075, "sawtooth"], shield: [190, 0.14, 0.07, "triangle"], shot: [430, 0.09, 0.055, "triangle"],
        acid: [155, 0.18, 0.055, "sawtooth"], laser: [780, 0.13, 0.05, "sine"], blast: [48, 0.3, 0.105, "sawtooth"],
        heal: [520, 0.22, 0.045, "sine"], coin: [760, 0.13, 0.045, "sine"], build: [230, 0.22, 0.06, "square"],
        warning: [330, 0.32, 0.06, "square"], down: [92, 0.4, 0.08, "triangle"], victory: [392, 0.75, 0.07, "triangle"], defeat: [110, 0.8, 0.07, "sawtooth"],
      }, [frequency, duration, volume, type] = presets[kind];
    this.note(frequency, at, duration, volume, type, this.effects);
    if (["dig", "rootDig", "blast", "acid"].includes(kind))
      this.noise(at, duration * 0.75, volume * 0.52, this.effects, kind === "blast" ? 260 : 720);
    if (kind === "victory") {
      this.note(frequency * 1.25, at + 0.18, 0.5, volume, "triangle", this.effects);
      this.note(frequency * 1.5, at + 0.36, 0.65, volume, "triangle", this.effects);
    }
  }

  private stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const drone of this.drones)
      try {
        drone.stop();
      } catch {
        // 이미 정지된 오디오 노드는 다시 정지할 필요가 없다.
      }
    this.drones = [];
    this.mapId = null;
  }

  close() {
    this.stopMusic();
    this.context?.close();
    this.context = null;
    this.master = this.music = this.effects = null;
  }
}

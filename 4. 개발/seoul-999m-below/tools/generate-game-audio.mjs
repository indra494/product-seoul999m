import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HERO_VOICE_LINES, MUSIC_TRACKS } from "../game/audioCatalog.ts";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = path.join(projectRoot, "public", "assets", "audio");
const sampleRate = 22050;

const clamp = (value) => Math.max(-1, Math.min(1, value));
const hash = (text) => [...text].reduce((value, char) => (value * 33 + char.charCodeAt(0)) >>> 0, 2166136261);
const randomFor = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
};
const wav = (samples, rate = sampleRate) => {
  const dataSize = samples.length * 2, buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0); buffer.writeUInt32LE(36 + dataSize, 4); buffer.write("WAVE", 8);
  buffer.write("fmt ", 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 2, 28);
  buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write("data", 36); buffer.writeUInt32LE(dataSize, 40);
  samples.forEach((sample, index) => buffer.writeInt16LE(Math.round(clamp(sample) * 32767), 44 + index * 2));
  return buffer;
};
const wavStereo = (left, right, rate = sampleRate) => {
  const dataSize = left.length * 4, buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0); buffer.writeUInt32LE(36 + dataSize, 4); buffer.write("WAVE", 8);
  buffer.write("fmt ", 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(2, 22); buffer.writeUInt32LE(rate, 24); buffer.writeUInt32LE(rate * 4, 28);
  buffer.writeUInt16LE(4, 32); buffer.writeUInt16LE(16, 34); buffer.write("data", 36); buffer.writeUInt32LE(dataSize, 40);
  for (let index = 0; index < left.length; index++) {
    buffer.writeInt16LE(Math.round(clamp(left[index]) * 32767), 44 + index * 4);
    buffer.writeInt16LE(Math.round(clamp(right[index]) * 32767), 46 + index * 4);
  }
  return buffer;
};
const addTone = (out, start, duration, frequency, gain, wave = "sine", slide = 1) => {
  const from = Math.max(0, Math.floor(start * sampleRate)), count = Math.floor(duration * sampleRate);
  let phase = 0;
  for (let n = 0; n < count && from + n < out.length; n++) {
    const p = n / count, env = Math.min(1, p * 18) * Math.min(1, (1 - p) * 12), hz = frequency * (1 + (slide - 1) * p);
    phase += (Math.PI * 2 * hz) / sampleRate;
    const raw = wave === "square" ? Math.sign(Math.sin(phase)) : wave === "saw" ? 2 * ((phase / (Math.PI * 2)) % 1) - 1 : wave === "triangle" ? (2 / Math.PI) * Math.asin(Math.sin(phase)) : Math.sin(phase);
    out[from + n] += raw * gain * env;
  }
};
const addNoise = (out, start, duration, gain, seed, decay = 4) => {
  const from = Math.max(0, Math.floor(start * sampleRate)), count = Math.floor(duration * sampleRate), random = randomFor(seed);
  let low = 0;
  for (let n = 0; n < count && from + n < out.length; n++) {
    const p = n / count, white = random() * 2 - 1;
    low += (white - low) * 0.22;
    out[from + n] += (white * 0.35 + low * 0.65) * gain * Math.exp(-p * decay);
  }
};
const normalize = (samples, peak = 0.82) => {
  let max = 0;
  for (const value of samples) max = Math.max(max, Math.abs(value));
  const scale = max ? peak / max : 1;
  for (let index = 0; index < samples.length; index++) samples[index] = Math.tanh(samples[index] * scale * 1.15) / Math.tanh(1.15) * peak;
};

const addStereoTone = (left, right, start, duration, frequency, gain, wave = "sine", pan = 0, slide = 1) => {
  const angle = (pan + 1) * Math.PI / 4;
  addTone(left, start, duration, frequency, gain * Math.cos(angle), wave, slide);
  addTone(right, start, duration, frequency, gain * Math.sin(angle), wave, slide);
};
const addStereoNoise = (left, right, start, duration, gain, seed, pan = 0, decay = 4) => {
  const angle = (pan + 1) * Math.PI / 4;
  addNoise(left, start, duration, gain * Math.cos(angle), seed, decay);
  addNoise(right, start, duration, gain * Math.sin(angle), seed + 17, decay);
};
const noteFrequency = (root, semitones) => root * 2 ** (semitones / 12);

const musicRecipes = {
  "shelter-network": {
    root: 55, chords: [0, -5, -2, -7], wave: "triangle", pad: "sine", drive: .65,
    motifA: [0, null, 3, 5, 7, null, 5, 3, 0, null, 3, 7, 10, 7, 5, null],
    motifB: [7, null, 10, 12, 15, 12, 10, null, 7, 5, 3, 5, 7, null, 3, null],
  },
  "rust-rail-assault": {
    root: 55, chords: [0, -2, -5, -7], wave: "saw", pad: "triangle", drive: 1,
    motifA: [0, 0, 7, null, 5, 3, 0, null, 0, 3, 5, 7, 10, 7, 5, 3],
    motifB: [12, 10, 7, 5, 7, null, 10, 12, 15, 12, 10, 7, 5, 7, 3, null],
  },
  "flooded-pressure": {
    root: 49, chords: [0, -7, -5, -2], wave: "sine", pad: "sine", drive: .72,
    motifA: [0, null, null, 7, 10, null, 7, null, 5, null, 3, null, 0, null, null, null],
    motifB: [12, null, 10, null, 7, 10, 12, null, 15, null, 12, 10, 7, null, 5, null],
  },
  "root-signal": {
    root: 51.91, chords: [0, 1, -5, -1], wave: "saw", pad: "triangle", drive: .82,
    motifA: [0, 1, 6, null, 5, 1, 8, null, 6, 5, 1, null, 0, 6, 8, null],
    motifB: [12, 13, 18, 17, 13, null, 8, 11, 12, 8, 6, 5, 1, null, 6, null],
  },
  "redline-siege": {
    root: 58.27, chords: [0, -2, -5, 3], wave: "saw", pad: "square", drive: 1.12,
    motifA: [0, 0, 3, 5, 7, 7, 10, 7, 12, 10, 7, 5, 3, 5, 7, null],
    motifB: [12, 12, 15, 17, 19, 17, 15, 12, 10, 12, 15, 10, 7, 10, 12, null],
  },
};

await mkdir(path.join(publicRoot, "bgm"), { recursive: true });
for (const [id, track] of Object.entries(MUSIC_TRACKS)) {
  const bars = 16, beat = 60 / track.bpm, duration = bars * beat * 4;
  const left = new Float32Array(Math.floor(sampleRate * duration)), right = new Float32Array(left.length);
  const recipe = musicRecipes[id], rng = randomFor(hash(id));
  for (let bar = 0; bar < bars; bar++) {
    const barAt = bar * beat * 4, chord = recipe.chords[bar % recipe.chords.length];
    const section = bar < 2 ? "intro" : bar < 6 ? "a" : bar < 10 ? "b" : bar < 12 ? "break" : "climax";
    const energy = section === "intro" ? .48 : section === "break" ? .42 : section === "climax" ? 1.18 : section === "b" ? .95 : .78;
    for (const [interval, pan] of [[0, -.35], [3, .25], [7, .55]])
      addStereoTone(left, right, barAt, beat * 4, noteFrequency(recipe.root, chord + interval + 12), .044 * energy, recipe.pad, pan);
    for (const bassBeat of [0, 2]) {
      const at = barAt + bassBeat * beat;
      addStereoTone(left, right, at, beat * .72, noteFrequency(recipe.root, chord), .16 * energy, "triangle", -.08, .84);
    }
    const motif = section === "b" || section === "climax" ? recipe.motifB : recipe.motifA;
    if (section !== "intro" || bar === 1) for (let step = 0; step < 16; step++) {
      const note = motif[step];
      if (note === null) continue;
      const at = barAt + step * beat / 4, octaveLift = section === "climax" && step % 4 === 0 ? 12 : 0;
      const hz = noteFrequency(recipe.root, chord + note + 24 + octaveLift);
      addStereoTone(left, right, at, beat * (step % 4 === 0 ? .68 : .34), hz, .085 * energy, recipe.wave, step % 2 ? .32 : -.32, .985);
      addStereoTone(left, right, at + .012, beat * .24, hz * 2, .018 * energy, "sine", step % 2 ? .55 : -.55);
    }
    if (section !== "break") for (let eighth = 0; eighth < 8; eighth++) {
      const at = barAt + eighth * beat / 2;
      if (eighth === 0 || eighth === 4) {
        addStereoTone(left, right, at, .18, 72, .19 * recipe.drive * energy, "sine", 0, .38);
        addStereoNoise(left, right, at, .08, .052 * recipe.drive, hash(id) + bar * 31 + eighth, 0, 12);
      }
      if (eighth === 2 || eighth === 6) addStereoNoise(left, right, at, .16, .075 * recipe.drive * energy, hash(id) + bar * 43 + eighth, .12, 8);
      addStereoNoise(left, right, at, .045, .018 * recipe.drive * energy, hash(id) + bar * 71 + eighth, eighth % 2 ? .65 : -.65, 16);
    }
    if (section === "climax") for (let quarter = 0; quarter < 4; quarter++) {
      const arp = [0, 7, 3, 10][quarter];
      addStereoTone(left, right, barAt + quarter * beat, beat * .42, noteFrequency(recipe.root, chord + arp + 24), .034, "triangle", quarter % 2 ? .72 : -.72);
    }
    if ((bar === 5 || bar === 11) && id !== "shelter-network") addStereoNoise(left, right, barAt + beat * 3.4, beat * .55, .065, hash(id) + bar, rng() > .5 ? .5 : -.5, 2);
  }
  normalize(left, .76); normalize(right, .76);
  await writeFile(path.join(publicRoot, "bgm", path.basename(new URL(track.file, "http://local").pathname)), wavStereo(left, right));
}

const writeSfx = async (relative, samples, peak = .88) => {
  normalize(samples, peak);
  const target = path.join(publicRoot, "sfx", relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, wav(samples));
};
const makeImpact = (material, variant) => {
  const duration = material === "structure" ? .42 : .3,
    out = new Float32Array(Math.floor(sampleRate * duration)),
    seed = hash(`${material}-${variant}`),
    shift = (variant - 2) * .055;
  if (material === "human") {
    addTone(out, 0, .2, 82 + variant * 7, .72, "sine", .42);
    addNoise(out, .006, .12, .46, seed, 10);
    addTone(out, .025, .11, 185 + variant * 18, .22, "triangle", .7);
  } else if (material === "bugborn") {
    addNoise(out, 0, .19, .63, seed, 6);
    for (let click = 0; click < 3; click++) addTone(out, .012 + click * .027, .045, 690 + click * 310 + shift * 100, .3, "square", .62);
    addTone(out, .025, .22, 112 + variant * 9, .42, "saw", .54);
  } else if (material === "ai") {
    addNoise(out, 0, .075, .32, seed, 13);
    addTone(out, 0, .27, 430 + variant * 65, .48, "triangle", .72);
    addTone(out, .018, .22, 930 + variant * 91, .28, "sine", .86);
    addTone(out, .04, .12, 1580, .16, "square", .55);
  } else {
    addTone(out, 0, .34, 48 + variant * 5, .76, "sine", .34);
    addNoise(out, 0, .28, .68, seed, 5);
    for (let debris = 0; debris < 4; debris++) addTone(out, .045 + debris * .045, .08, 145 + debris * 73, .18, "triangle", .52);
  }
  return out;
};
for (const material of ["human", "bugborn", "ai", "structure"])
  for (let variant = 1; variant <= 3; variant++)
    await writeSfx(path.join("impact", `${material}-${variant}.wav`), makeImpact(material, variant));

for (let variant = 1; variant <= 3; variant++) {
  const out = new Float32Array(Math.floor(sampleRate * .5)), seed = hash(`critical-${variant}`);
  addTone(out, 0, .42, 44 + variant * 4, .92, "sine", .31);
  addNoise(out, 0, .24, .88, seed, 7);
  addTone(out, .018, .35, 170 + variant * 31, .42, "saw", .48);
  addTone(out, .035, .31, 720 + variant * 90, .24, "triangle", .74);
  await writeSfx(path.join("impact", `critical-${variant}.wav`), out, .94);
}

const makeDig = (material, variant) => {
  const duration = material === "rock" || material === "metal" ? .38 : .31,
    out = new Float32Array(Math.floor(sampleRate * duration)),
    seed = hash(`dig-${material}-${variant}`);
  if (material === "earth") {
    addNoise(out, 0, .29, .82, seed, 5);
    addTone(out, 0, .24, 58 + variant * 6, .7, "sine", .38);
    addNoise(out, .12, .14, .36, seed + 3, 9);
  } else if (material === "rock") {
    addTone(out, 0, .31, 105 + variant * 13, .68, "triangle", .46);
    addNoise(out, 0, .24, .74, seed, 8);
    for (let chip = 0; chip < 4; chip++) addTone(out, .025 + chip * .055, .07, 520 + chip * 170, .22, "square", .58);
  } else if (material === "metal") {
    addTone(out, 0, .36, 310 + variant * 37, .62, "triangle", .72);
    addTone(out, .015, .3, 870 + variant * 71, .38, "sine", .84);
    addNoise(out, 0, .11, .46, seed, 12);
    addTone(out, .09, .2, 1450, .2, "square", .65);
  } else {
    addTone(out, 0, .3, 188 + variant * 24, .58, "triangle", .61);
    addTone(out, .018, .27, 740 + variant * 95, .34, "sine", 1.08);
    addNoise(out, 0, .22, .56, seed, 7);
    addTone(out, .12, .18, 1220, .2, "triangle", 1.15);
  }
  return out;
};
for (const material of ["earth", "rock", "metal", "ore"])
  for (let variant = 1; variant <= 3; variant++)
    await writeSfx(path.join("dig", `${material}-${variant}.wav`), makeDig(material, variant), .93);

for (let variant = 1; variant <= 3; variant++) {
  const out = new Float32Array(Math.floor(sampleRate * .68)), seed = hash(`collapse-${variant}`);
  addTone(out, 0, .58, 42 + variant * 4, .88, "sine", .24);
  addNoise(out, 0, .54, .9, seed, 3.5);
  for (let debris = 0; debris < 6; debris++) {
    addTone(out, .07 + debris * .075, .12, 92 + debris * 47 + variant * 8, .25, "triangle", .43);
    addNoise(out, .07 + debris * .075, .08, .24, seed + debris * 13, 10);
  }
  await writeSfx(path.join("dig", `collapse-${variant}.wav`), out, .96);
}

const makeDown = (faction, variant) => {
  const out = new Float32Array(Math.floor(sampleRate * 1.12)), seed = hash(`down-${faction}-${variant}`);
  if (faction === "human") {
    addTone(out, .08, .62, 76 + variant * 5, .63, "sine", .28);
    addNoise(out, .08, .4, .54, seed, 5);
    addTone(out, .42, .38, 51, .42, "sine", .42);
    addNoise(out, .42, .34, .28, seed + 1, 7);
  } else if (faction === "bugborn") {
    addTone(out, 0, .75, 190 + variant * 17, .5, "saw", .25);
    addTone(out, .03, .66, 430 + variant * 29, .26, "square", .19);
    for (let crack = 0; crack < 5; crack++) addNoise(out, .1 + crack * .11, .08, .42, seed + crack, 14);
    addTone(out, .58, .46, 58, .72, "sine", .3);
  } else {
    addTone(out, 0, .9, 510 + variant * 38, .38, "square", .08);
    addTone(out, 0, .94, 115 + variant * 9, .48, "triangle", .32);
    for (let spark = 0; spark < 6; spark++) {
      addTone(out, .08 + spark * .13, .055, 1050 + spark * 130, .24, "square", .62);
      addNoise(out, .08 + spark * .13, .045, .22, seed + spark, 17);
    }
  }
  return out;
};
for (const faction of ["human", "bugborn", "ai"])
  for (let variant = 1; variant <= 2; variant++)
    await writeSfx(path.join("down", `${faction}-${variant}.wav`), makeDown(faction, variant), .92);

const victory = new Float32Array(Math.floor(sampleRate * 1.7));
for (const [at, hz] of [[0, 196], [.22, 246.94], [.44, 293.66], [.68, 392], [.94, 493.88]]) {
  addTone(victory, at, .7, hz, .34, "triangle", 1.01);
  addTone(victory, at, .58, hz * 2, .12, "sine", 1);
}
addNoise(victory, .66, .16, .18, hash("victory"), 12);
await writeSfx(path.join("result", "victory.wav"), victory, .9);

const defeat = new Float32Array(Math.floor(sampleRate * 1.8));
for (const [at, hz] of [[0, 196], [.28, 155.56], [.58, 116.54], [.92, 73.42]]) {
  addTone(defeat, at, .82, hz, .42, "saw", .78);
  addTone(defeat, at, .7, hz / 2, .34, "sine", .64);
}
addNoise(defeat, .88, .6, .28, hash("defeat"), 3);
await writeSfx(path.join("result", "defeat.wav"), defeat, .92);

for (const [heroId, lines] of Object.entries(HERO_VOICE_LINES)) {
  for (const [slotText, line] of Object.entries(lines)) {
    if (line.style !== "bugborn") continue;
    const slot = Number(slotText), duration = slot === 4 ? 1.45 : 0.82, out = new Float32Array(Math.floor(sampleRate * duration)), seed = hash(heroId) + slot * 997, rng = randomFor(seed), base = 105 + (seed % 95);
    for (let syllable = 0; syllable < (slot === 4 ? 6 : 3); syllable++) {
      const at = 0.05 + syllable * (duration - 0.12) / (slot === 4 ? 6 : 3), hz = base * (0.75 + rng() * 1.4);
      addTone(out, at, 0.13 + rng() * 0.11, hz, 0.34, syllable % 2 ? "saw" : "triangle", 1.8 + rng() * 1.5);
      addTone(out, at + 0.02, 0.1, hz * 2.03, 0.13, "square", 0.62);
      addNoise(out, at, 0.09, 0.13, seed + syllable, 8);
    }
    normalize(out, slot === 4 ? 0.9 : 0.76);
    const target = path.join(projectRoot, "public", line.file.replace(/^\//, ""));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, wav(out));
  }
}

console.log(`Generated ${Object.keys(MUSIC_TRACKS).length} BGM loops, 38 combat SFX, and 16 Bugborn voice cues.`);

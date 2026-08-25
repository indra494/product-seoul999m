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

const noteFrequency = (root, semitones) => root * 2 ** (semitones / 12);

const stereoGain = (pan) => {
  const angle = (Math.max(-1, Math.min(1, pan)) + 1) * Math.PI / 4;
  return [Math.cos(angle), Math.sin(angle)];
};

const addWarmPad = (left, right, start, duration, frequency, gain, pan = 0) => {
  const from = Math.max(0, Math.floor(start * sampleRate)), count = Math.floor(duration * sampleRate),
    [gainL, gainR] = stereoGain(pan);
  let phase = 0, phaseDetuned = 0;
  for (let n = 0; n < count && from + n < left.length; n++) {
    const p = n / count,
      envelope = Math.min(1, p * 3.2) * Math.min(1, (1 - p) * 3.8),
      drift = 1 + Math.sin((start + n / sampleRate) * .37) * .0018;
    phase += Math.PI * 2 * frequency * drift / sampleRate;
    phaseDetuned += Math.PI * 2 * frequency * 1.004 / sampleRate;
    const body = Math.sin(phase) * .72 + Math.sin(phaseDetuned) * .2 + Math.sin(phase * .5) * .08,
      sample = body * gain * envelope;
    left[from + n] += sample * gainL;
    right[from + n] += sample * gainR;
  }
};

const addFeltPiano = (left, right, start, duration, frequency, gain, pan = 0) => {
  const from = Math.max(0, Math.floor(start * sampleRate)), count = Math.floor(duration * sampleRate),
    [gainL, gainR] = stereoGain(pan);
  let phase = 0;
  for (let n = 0; n < count && from + n < left.length; n++) {
    const p = n / count,
      attack = 1 - Math.exp(-p * 80),
      envelope = attack * Math.exp(-p * 5.4) * Math.min(1, (1 - p) * 18);
    phase += Math.PI * 2 * frequency / sampleRate;
    const body = Math.sin(phase) * .74 + Math.sin(phase * 2.01 + .2) * .2 + Math.sin(phase * 3.98) * .06,
      sample = body * gain * envelope;
    left[from + n] += sample * gainL;
    right[from + n] += sample * gainR;
  }
};

const addPluckedString = (left, right, start, duration, frequency, gain, pan, seed) => {
  const from = Math.max(0, Math.floor(start * sampleRate)), count = Math.floor(duration * sampleRate),
    delay = Math.max(8, Math.round(sampleRate / frequency)), buffer = new Float32Array(delay),
    random = randomFor(seed), [gainL, gainR] = stereoGain(pan);
  for (let index = 0; index < delay; index++) buffer[index] = random() * 2 - 1;
  let cursor = 0, body = 0;
  for (let n = 0; n < count && from + n < left.length; n++) {
    const value = buffer[cursor], next = buffer[(cursor + 1) % delay];
    buffer[cursor] = (value + next) * .4987;
    cursor = (cursor + 1) % delay;
    body += (value - body) * .32;
    const release = Math.min(1, (count - n) / Math.max(1, sampleRate * .08)), sample = body * gain * release;
    left[from + n] += sample * gainL;
    right[from + n] += sample * gainR;
  }
};

const addFrameDrum = (left, right, start, gain, seed, pan = 0) => {
  const duration = .34, from = Math.floor(start * sampleRate), count = Math.floor(duration * sampleRate),
    random = randomFor(seed), [gainL, gainR] = stereoGain(pan);
  let phase = 0, lowNoise = 0;
  for (let n = 0; n < count && from + n < left.length; n++) {
    const p = n / count, hz = 76 - p * 34;
    phase += Math.PI * 2 * hz / sampleRate;
    lowNoise += ((random() * 2 - 1) - lowNoise) * .08;
    const envelope = (1 - Math.exp(-p * 70)) * Math.exp(-p * 6.8),
      sample = (Math.sin(phase) * .86 + lowNoise * .14) * gain * envelope;
    left[from + n] += sample * gainL;
    right[from + n] += sample * gainR;
  }
};

const addBrush = (left, right, start, duration, gain, seed, pan = 0) => {
  const from = Math.floor(start * sampleRate), count = Math.floor(duration * sampleRate), random = randomFor(seed),
    [gainL, gainR] = stereoGain(pan);
  let low = 0;
  for (let n = 0; n < count && from + n < left.length; n++) {
    const p = n / count, white = random() * 2 - 1;
    low += (white - low) * .055;
    const envelope = Math.sin(Math.PI * p) ** 1.6,
      sample = (white * .18 + low * .82) * gain * envelope;
    left[from + n] += sample * gainL;
    right[from + n] += sample * gainR;
  }
};

const addLoopRoom = (left, right) => {
  const dryL = left.slice(), dryR = right.slice(), length = left.length;
  for (const [seconds, gain, cross] of [[.137, .11, .15], [.223, .075, .22], [.349, .052, .28]]) {
    const delay = Math.round(seconds * sampleRate);
    for (let index = 0; index < length; index++) {
      const source = (index - delay + length) % length;
      left[index] += (dryL[source] * (1 - cross) + dryR[source] * cross) * gain;
      right[index] += (dryR[source] * (1 - cross) + dryL[source] * cross) * gain;
    }
  }
};

const musicRecipes = {
  "shelter-network": {
    root: 55, chords: [0, -5, 3, -2], rhythm: 0, texture: .48, lead: "piano",
    motif: [12, null, 15, null, 19, null, 17, null, 12, null, 10, null, 7, null, null, null],
  },
  "rust-rail-assault": {
    root: 55, chords: [0, -2, -5, -7], rhythm: .72, texture: .74, lead: "pluck",
    motif: [12, null, 19, 17, null, 15, 12, null, 10, 12, null, 7, 10, null, 5, null],
  },
  "flooded-pressure": {
    root: 49, chords: [0, -7, -5, -2], rhythm: .42, texture: .62, lead: "piano",
    motif: [12, null, null, 19, null, 17, null, null, 15, null, 12, null, 10, null, null, null],
  },
  "root-signal": {
    root: 51.91, chords: [0, 1, -5, -1], rhythm: .5, texture: .7, lead: "pluck",
    motif: [12, null, 13, 18, null, 17, 13, null, 12, null, 8, 11, null, 6, null, null],
  },
  "redline-siege": {
    root: 58.27, chords: [0, -2, -5, 3], rhythm: .84, texture: .78, lead: "pluck",
    motif: [12, null, 15, 19, 17, null, 15, 12, 10, null, 12, 15, null, 10, 7, null],
  },
};

await mkdir(path.join(publicRoot, "bgm"), { recursive: true });
for (const [id, track] of Object.entries(MUSIC_TRACKS)) {
  const bars = 12, beat = 60 / track.bpm, duration = bars * beat * 4;
  const left = new Float32Array(Math.floor(sampleRate * duration)), right = new Float32Array(left.length),
    recipe = musicRecipes[id], seed = hash(`organic-${id}`);
  for (let bar = 0; bar < bars; bar++) {
    const barAt = bar * beat * 4, chord = recipe.chords[bar % recipe.chords.length],
      energy = bar < 2 ? .68 : bar >= 8 ? .92 : .8;
    for (const [interval, pan] of [[0, -.32], [3, .18], [7, .48]])
      addWarmPad(left, right, barAt, beat * 4.12, noteFrequency(recipe.root, chord + interval + 12), .035 * recipe.texture * energy, pan);
    addPluckedString(left, right, barAt, beat * 2.4, noteFrequency(recipe.root, chord), .095 * energy, -.12, seed + bar * 37);
    if (id !== "shelter-network")
      addPluckedString(left, right, barAt + beat * 2, beat * 1.7, noteFrequency(recipe.root, chord + 7), .052 * energy, .2, seed + bar * 41);
    for (let step = 0; step < recipe.motif.length; step++) {
      const note = recipe.motif[(step + (bar % 4) * 2) % recipe.motif.length];
      if (note === null || (bar < 1 && step % 4 !== 0)) continue;
      const at = barAt + step * beat / 4, hz = noteFrequency(recipe.root, chord + note + 12), pan = step % 2 ? .28 : -.28;
      if (recipe.lead === "piano") addFeltPiano(left, right, at, beat * 1.55, hz, .062 * energy, pan);
      else addPluckedString(left, right, at, beat * 1.2, hz, .052 * energy, pan, seed + bar * 211 + step * 13);
    }
    if (recipe.rhythm > 0 && bar > 0) for (let quarter = 0; quarter < 4; quarter++) {
      const at = barAt + quarter * beat;
      if (quarter === 0 || quarter === 2)
        addFrameDrum(left, right, at, .105 * recipe.rhythm * energy, seed + bar * 71 + quarter, quarter === 2 ? .08 : -.05);
      else addBrush(left, right, at, beat * .72, .028 * recipe.rhythm * energy, seed + bar * 97 + quarter, quarter === 1 ? -.35 : .35);
    }
    addBrush(left, right, barAt, beat * 4, .006 * recipe.texture, seed + bar * 127, bar % 2 ? .7 : -.7);
  }
  addLoopRoom(left, right);
  normalize(left, .68); normalize(right, .68);
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

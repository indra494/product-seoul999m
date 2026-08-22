import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const workspaceRoot = path.resolve(projectRoot, "..", "..");
const audioRoot = path.join(workspaceRoot, "3. 설계", "영상", "프롤로그", "v10", "audio");
const inputPath = path.join(audioRoot, "narration-female-heami.wav");
const outputPath = path.join(audioRoot, "opening-final-mix.wav");
const timingPath = path.join(audioRoot, "narration-timings.json");
const wav = await readFile(inputPath);
const timings = JSON.parse((await readFile(timingPath, "utf8")).replace(/^\uFEFF/, ""));

let position = 12, format, pcm;
while (position + 8 <= wav.length) {
  const id = wav.toString("ascii", position, position + 4);
  const size = wav.readUInt32LE(position + 4);
  if (id === "fmt ") format = Buffer.from(wav.subarray(position + 8, position + 8 + size));
  if (id === "data") { pcm = Buffer.from(wav.subarray(position + 8, position + 8 + size)); break; }
  position += 8 + size + (size % 2);
}
if (!format || !pcm) throw new Error(`Invalid WAV: ${inputPath}`);
const audioFormat = format.readUInt16LE(0), channels = format.readUInt16LE(2);
const sampleRate = format.readUInt32LE(4), blockAlign = format.readUInt16LE(12), bitsPerSample = format.readUInt16LE(14);
if (audioFormat !== 1 || bitsPerSample !== 16) throw new Error("Expected PCM 16-bit narration WAV.");

const duration = 35, narrationStart = .35;
const normalEnd = timings.segments[4].end;
const nextSentenceStart = timings.segments[5].start;
const glitchStart = narrationStart + nextSentenceStart;
const glitchEnd = 30.6;
const frames = Math.round(duration * sampleRate), output = Buffer.alloc(frames * blockAlign);
const sourceFrames = Math.floor(pcm.length / blockAlign);
const copyFrames = Math.min(sourceFrames, Math.floor(normalEnd * sampleRate));
const destinationStart = Math.floor(narrationStart * sampleRate), fadeFrames = Math.floor(.045 * sampleRate);
for (let frame = 0; frame < copyFrames; frame++) {
  const fade = frame >= copyFrames - fadeFrames ? (copyFrames - frame) / fadeFrames : 1;
  for (let channel = 0; channel < channels; channel++) {
    const sourceOffset = frame * blockAlign + channel * 2;
    const destinationOffset = (frame + destinationStart) * blockAlign + channel * 2;
    output.writeInt16LE(Math.round(pcm.readInt16LE(sourceOffset) * .96 * fade), destinationOffset);
  }
}

const stutterSourceStart = Math.floor(nextSentenceStart * sampleRate);
const stutterChunkFrames = Math.floor(.105 * sampleRate);
const stutterFrames = Math.floor(.72 * sampleRate);
for (let frame = 0; frame < stutterFrames; frame++) {
  const repeatPosition = frame % stutterChunkFrames;
  const gate = repeatPosition < stutterChunkFrames * .78 ? 1 : 0;
  const decay = Math.max(0, 1 - frame / stutterFrames);
  for (let channel = 0; channel < channels; channel++) {
    const sourceOffset = (stutterSourceStart + repeatPosition) * blockAlign + channel * 2;
    const destinationOffset = (Math.floor(glitchStart * sampleRate) + frame) * blockAlign + channel * 2;
    const chopped = pcm.readInt16LE(sourceOffset) * 1.22 * gate * (.42 + .58 * decay);
    output.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(chopped))), destinationOffset);
  }
}

let randomState = 999;
const random = () => ((randomState = (randomState * 1664525 + 1013904223) >>> 0) / 4294967296);
const alarmStartFrame = Math.floor(glitchStart * sampleRate), alarmEndFrame = Math.floor(glitchEnd * sampleRate);
for (let frame = alarmStartFrame; frame < alarmEndFrame; frame++) {
  const local = (frame - alarmStartFrame) / sampleRate, pulse = Math.floor(local / .18), inside = local % .18;
  const frequency = pulse % 2 ? 1260 : 960;
  let envelope = 0;
  if (inside < .12) envelope = Math.min(1, inside / .008, (.12 - inside) / .025);
  const beep = Math.sin(2 * Math.PI * frequency * local) * .42 * envelope;
  const burst = Math.max(0, 1 - local / .11);
  const tearNoise = (random() * 2 - 1) * (.09 + .34 * burst);
  const surge = Math.sin(2 * Math.PI * (88 + 42 * local) * local) * .07 * Math.max(0, 1 - local / 2);
  const existing = output.readInt16LE(frame * blockAlign) / 32768;
  const sample = Math.round(Math.max(-.95, Math.min(.95, existing + beep + tearNoise + surge)) * 32767);
  for (let channel = 0; channel < channels; channel++) output.writeInt16LE(sample, frame * blockAlign + channel * 2);
}

const header = Buffer.alloc(12), fmtHeader = Buffer.alloc(8), dataHeader = Buffer.alloc(8);
header.write("RIFF", 0); header.writeUInt32LE(4 + 8 + format.length + 8 + output.length, 4); header.write("WAVE", 8);
fmtHeader.write("fmt ", 0); fmtHeader.writeUInt32LE(format.length, 4);
dataHeader.write("data", 0); dataHeader.writeUInt32LE(output.length, 4);
await writeFile(outputPath, Buffer.concat([header, fmtHeader, format, dataHeader, output]));

const rms = (start, end) => {
  let sum = 0, count = 0;
  for (let frame = Math.floor(start * sampleRate); frame < Math.floor(end * sampleRate); frame++) {
    const value = output.readInt16LE(frame * blockAlign) / 32768;
    sum += value * value; count++;
  }
  return Math.sqrt(sum / Math.max(1, count));
};
console.log(JSON.stringify({ outputPath, duration, sampleRate, channels, narrationStart, normalNarrationEnd: narrationStart + normalEnd, glitchStart, glitchEnd, rms: { preNarration: rms(0, .3), narration: rms(.5, glitchStart - .2), stutterAndStatic: rms(glitchStart, glitchStart + .8), alarm: rms(glitchStart + .8, glitchEnd), ending: rms(32, 35) } }, null, 2));

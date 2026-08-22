import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = path.resolve(import.meta.dirname, "..");
const workspaceRoot = path.resolve(projectRoot, "..", "..");
const videoPath = path.join(workspaceRoot, "3. 설계", "영상", "프롤로그", "v12", "seoul-999m-opening-v12.mp4");
const playwrightModule = "C:/Users/indra/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const { chromium } = await import(pathToFileURL(playwrightModule).href);
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ["--allow-file-access-from-files", "--disable-web-security"] });
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(videoPath).href);
  const result = await page.evaluate(async (url) => {
    const bytes = await (await fetch(url)).arrayBuffer();
    const context = new AudioContext();
    const buffer = await context.decodeAudioData(bytes);
    const data = buffer.getChannelData(0);
    const rms = (start, end) => {
      let sum = 0, count = 0;
      for (let index = Math.floor(start * buffer.sampleRate); index < Math.min(data.length, Math.floor(end * buffer.sampleRate)); index++) {
        sum += data[index] ** 2;
        count++;
      }
      return Math.sqrt(sum / Math.max(1, count));
    };
    let peak = 0;
    for (const sample of data) peak = Math.max(peak, Math.abs(sample));
    await context.close();
    return {
      duration: buffer.duration,
      sampleRate: buffer.sampleRate,
      channels: buffer.numberOfChannels,
      peak,
      rms: {
        preNarration: rms(0, .2),
        narration: rms(.35, 16.35),
        beforeGlitch: rms(16.35, 16.52),
        stutterAndEffects: rms(16.58, 18.25),
        logo: rms(18.4, 19.8)
      }
    };
  }, page.url());
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}

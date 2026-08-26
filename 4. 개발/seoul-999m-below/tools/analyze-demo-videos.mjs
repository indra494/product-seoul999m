import { existsSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const projectRoot = path.resolve(import.meta.dirname, "..");
const workspaceRoot = path.resolve(projectRoot, "..", "..");
const rawRoot = path.join(workspaceRoot, "5. 오픈", "영상", "raw");
const analysisRoot = path.join(workspaceRoot, "5. 오픈", "영상", "analysis");
const playwrightModule = process.env.CODEX_PLAYWRIGHT_MODULE ||
  "C:/Users/indra/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const chromePath = process.env.CHROME_EXECUTABLE ||
  "C:/Program Files/Google/Chrome/Application/chrome.exe";

if (!existsSync(playwrightModule)) throw new Error(`Playwright module not found: ${playwrightModule}`);
if (!existsSync(chromePath)) throw new Error(`Chrome executable not found: ${chromePath}`);

const { chromium } = await import(pathToFileURL(playwrightModule).href);
await mkdir(analysisRoot, { recursive: true });

const files = (await readdir(rawRoot, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /\.(mp4|webm|mov)$/i.test(entry.name))
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right, "ko"));

const safeName = (name) => name.replace(/\.[^.]+$/, "").replace(/[^0-9A-Za-z가-힣_-]+/g, "-");
const timeLabel = (seconds) => {
  const value = Math.max(0, Math.round(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = value % 60;
  return hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const sampleTimes = (duration) => {
  const values = new Set([0.5]);
  for (let time = 5; time <= Math.min(duration - 0.5, 60); time += 5) values.add(time);
  const interval = duration > 900 ? 30 : duration > 420 ? 20 : 15;
  for (let time = 75; time < duration - 0.5; time += interval) values.add(time);
  values.add(Math.max(0.5, duration - 1));
  return [...values].filter((time) => time < duration).sort((left, right) => left - right);
};

const tileWidth = 480;
const tileHeight = 300;
const frameHeight = 270;
const columns = 4;
const rows = 3;
const perSheet = columns * rows;
const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: ["--allow-file-access-from-files", "--disable-web-security", "--autoplay-policy=no-user-gesture-required"],
});

const results = [];
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  for (const file of files) {
    const filePath = path.join(rawRoot, file);
    await page.goto(pathToFileURL(filePath).href, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const video = page.locator("video");
    await video.waitFor({ state: "attached", timeout: 30_000 });
    const metadata = await video.evaluate((element) => new Promise((resolve, reject) => {
      const read = () => resolve({
        duration: element.duration,
        width: element.videoWidth,
        height: element.videoHeight,
        readyState: element.readyState,
      });
      if (element.readyState >= 1) read();
      else {
        element.addEventListener("loadedmetadata", read, { once: true });
        element.addEventListener("error", () => reject(new Error("Video metadata load failed")), { once: true });
      }
    }));
    await video.evaluate((element) => {
      element.controls = false;
      element.muted = true;
      Object.assign(element.style, {
        width: "960px",
        height: "540px",
        objectFit: "contain",
        background: "#050708",
      });
      document.body.style.margin = "0";
      document.body.style.background = "#050708";
    });

    const times = sampleTimes(metadata.duration);
    const tiles = [];
    for (const time of times) {
      await video.evaluate((element, requestedTime) => new Promise((resolve, reject) => {
        const done = () => resolve();
        const failed = () => reject(new Error(`Seek failed at ${requestedTime}`));
        element.addEventListener("seeked", done, { once: true });
        element.addEventListener("error", failed, { once: true });
        element.currentTime = Math.min(requestedTime, Math.max(0, element.duration - 0.1));
      }), time);
      const frame = await video.screenshot({ type: "jpeg", quality: 72 });
      const label = `${file.replace(/\.[^.]+$/, "")}  ${timeLabel(time)}`;
      const labelSvg = Buffer.from(`<svg width="${tileWidth}" height="30" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#0a0e10"/>
        <text x="12" y="21" fill="#f0d27a" font-family="Arial, Malgun Gothic, sans-serif" font-size="17" font-weight="700">${label.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>
      </svg>`);
      const tile = await sharp(frame)
        .resize(tileWidth, frameHeight, { fit: "contain", background: "#050708" })
        .extend({ bottom: 30, background: "#0a0e10" })
        .composite([{ input: labelSvg, top: frameHeight, left: 0 }])
        .jpeg({ quality: 80 })
        .toBuffer();
      tiles.push(tile);
    }

    const sheetPaths = [];
    for (let offset = 0; offset < tiles.length; offset += perSheet) {
      const pageTiles = tiles.slice(offset, offset + perSheet);
      const sheet = sharp({
        create: {
          width: tileWidth * columns,
          height: tileHeight * rows,
          channels: 3,
          background: "#050708",
        },
      });
      const composites = pageTiles.map((input, index) => ({
        input,
        left: (index % columns) * tileWidth,
        top: Math.floor(index / columns) * tileHeight,
      }));
      const sheetPath = path.join(analysisRoot, `${safeName(file)}-sheet-${String(Math.floor(offset / perSheet) + 1).padStart(2, "0")}.jpg`);
      await sheet.composite(composites).jpeg({ quality: 84 }).toFile(sheetPath);
      sheetPaths.push(sheetPath);
    }
    results.push({ file, filePath, ...metadata, sampleCount: times.length, times, sheetPaths });
    console.log(JSON.stringify({ file, duration: metadata.duration, size: `${metadata.width}x${metadata.height}`, samples: times.length, sheets: sheetPaths.length }));
  }
} finally {
  await browser.close();
}

await writeFile(path.join(analysisRoot, "video-metadata.json"), JSON.stringify(results, null, 2), "utf8");
console.log(JSON.stringify({ analysisRoot, files: results.length }, null, 2));

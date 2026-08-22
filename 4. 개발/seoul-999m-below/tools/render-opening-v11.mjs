import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = path.resolve(import.meta.dirname, "..");
const workspaceRoot = path.resolve(projectRoot, "..", "..");
const htmlPath = path.join(import.meta.dirname, "opening-v11-render.html");
const outputPath = path.join(workspaceRoot, "3. 설계", "영상", "프롤로그", "v11", "seoul-999m-opening-v11.mp4");
const playwrightModule = process.env.CODEX_PLAYWRIGHT_MODULE || "C:/Users/indra/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const chromePath = process.env.CHROME_EXECUTABLE || "C:/Program Files/Google/Chrome/Application/chrome.exe";
if (!existsSync(playwrightModule)) throw new Error(`Playwright module not found: ${playwrightModule}`);
if (!existsSync(chromePath)) throw new Error(`Chrome executable not found: ${chromePath}`);
const { chromium } = await import(pathToFileURL(playwrightModule).href);
await mkdir(path.dirname(outputPath), { recursive: true });
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ["--allow-file-access-from-files", "--disable-web-security", "--autoplay-policy=no-user-gesture-required"] });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(pathToFileURL(htmlPath).href);
  await page.waitForFunction(() => window.__openingReady === true || window.__openingError, undefined, { timeout: 30_000 });
  const error = await page.evaluate(() => window.__openingError || null);
  if (error) throw new Error(error);
  const downloadPromise = page.waitForEvent("download", { timeout: 45_000 });
  const resultPromise = page.evaluate(() => window.renderOpening());
  const download = await downloadPromise;
  const result = await resultPromise;
  await download.saveAs(outputPath);
  const check = await browser.newPage();
  await check.goto(pathToFileURL(outputPath).href);
  const metadata = await check.locator("video").evaluate((video) => new Promise((resolve, reject) => {
    const read = () => resolve({ duration: video.duration, width: video.videoWidth, height: video.videoHeight });
    if (video.readyState >= 1) read(); else { video.addEventListener("loadedmetadata", read, { once: true }); video.addEventListener("error", reject, { once: true }); }
  }));
  console.log(JSON.stringify({ outputPath, ...result, metadata }, null, 2));
} finally { await browser.close(); }

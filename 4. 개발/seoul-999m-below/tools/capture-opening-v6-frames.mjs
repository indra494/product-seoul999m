import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = path.resolve(import.meta.dirname, "..");
const workspaceRoot = path.resolve(projectRoot, "..", "..");
const htmlPath = path.join(import.meta.dirname, "opening-v6-render.html");
const outputRoot = path.join(workspaceRoot, "3. 설계", "영상", "프롤로그", "v6", "review");
const playwrightModule = process.env.CODEX_PLAYWRIGHT_MODULE || "C:/Users/indra/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const chromePath = process.env.CHROME_EXECUTABLE || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const { chromium } = await import(pathToFileURL(playwrightModule).href);
await mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ["--allow-file-access-from-files", "--disable-web-security"] });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(pathToFileURL(htmlPath).href);
  await page.waitForFunction(() => window.__openingReady === true, undefined, { timeout: 30_000 });
  for (const time of [2.4, 7.6, 12.5, 13.8, 15.9, 18]) {
    await page.evaluate((value) => window.draw(value), time);
    await page.locator("canvas").screenshot({ path: path.join(outputRoot, `frame-${String(time).replace(".", "-")}s.png`) });
  }
} finally { await browser.close(); }

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = path.resolve(import.meta.dirname, "..");
const workspaceRoot = path.resolve(projectRoot, "..", "..");
const outputRoot = path.join(workspaceRoot, "3. 설계", "영상", "프롤로그", "v11", "review");
const htmlPath = path.join(import.meta.dirname, "opening-v11-render.html");
const playwrightModule = "C:/Users/indra/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const chromePath = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const { chromium } = await import(pathToFileURL(playwrightModule).href);
await mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ["--allow-file-access-from-files", "--disable-web-security"] });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(htmlPath).href);
  await page.waitForFunction(() => window.__openingReady === true || window.__openingError);
  for (const second of [2.4, 12.8, 22.5, 25.8, 26.4, 29.2, 30.8]) {
    await page.evaluate((time) => window.draw(time), second);
    await page.screenshot({ path: path.join(outputRoot, `frame-${String(second).replace(".", "_")}s.png`) });
  }
  console.log(outputRoot);
} finally { await browser.close(); }

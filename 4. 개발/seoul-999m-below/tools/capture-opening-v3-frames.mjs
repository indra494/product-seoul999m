import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot = path.resolve(import.meta.dirname, "..");
const workspaceRoot = path.resolve(projectRoot, "..", "..");
const htmlPath = path.join(import.meta.dirname, "opening-v3-render.html");
const version = process.argv[2] || "v3";
const isV4 = version === "v4";
const outputRoot = path.join(workspaceRoot, "3. 설계", "영상", "프롤로그", version, "review");
const playwrightModule = process.env.CODEX_PLAYWRIGHT_MODULE || "C:/Users/indra/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const chromePath = process.env.CHROME_EXECUTABLE || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const { chromium } = await import(pathToFileURL(playwrightModule).href);

await mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({ executablePath: chromePath, headless: true, args: ["--allow-file-access-from-files", "--disable-web-security"] });
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const url = new URL(pathToFileURL(htmlPath).href);
  if (isV4) {
    url.searchParams.set("version", "v4");
    url.searchParams.set("duration", "42");
    url.searchParams.set("narrationStart", "0.45");
    url.searchParams.set("logoStart", "38.8");
    url.searchParams.set("musicGain", "0.58");
  }
  await page.goto(url.href);
  await page.waitForFunction(() => window.__openingReady === true, undefined, { timeout: 30_000 });
  const sampleTimes = isV4 ? [1.8, 13.2, 25.4, 35.6, 40.2] : [1.4, 8.8, 17.8, 25.8, 28.5];
  for (const time of sampleTimes) {
    await page.evaluate((value) => window.drawScene(value), time);
    await page.locator("canvas").screenshot({ path: path.join(outputRoot, `frame-${String(time).replace(".", "-")}s.png`) });
  }
} finally {
  await browser.close();
}

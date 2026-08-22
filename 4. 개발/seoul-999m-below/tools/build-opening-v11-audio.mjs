import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const projectRoot=path.resolve(import.meta.dirname,".."),workspaceRoot=path.resolve(projectRoot,"..","..");
const htmlPath=path.join(import.meta.dirname,"opening-v11-audio-builder.html"),audioRoot=path.join(workspaceRoot,"3. 설계","영상","프롤로그","v11","audio"),outputPath=path.join(audioRoot,"opening-final-mix.wav"),metadataPath=path.join(audioRoot,"opening-v11-timing.json");
const playwrightModule="C:/Users/indra/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs",chromePath="C:/Program Files/Google/Chrome/Application/chrome.exe";
if(!existsSync(playwrightModule)||!existsSync(chromePath))throw Error("Chrome rendering dependency missing.");
const{chromium}=await import(pathToFileURL(playwrightModule).href);await mkdir(audioRoot,{recursive:true});const browser=await chromium.launch({executablePath:chromePath,headless:true,args:["--allow-file-access-from-files","--disable-web-security","--autoplay-policy=no-user-gesture-required"]});
try{const page=await browser.newPage();await page.goto(pathToFileURL(htmlPath).href);await page.waitForFunction(()=>window.__audioBuilderReady===true);const downloadPromise=page.waitForEvent("download",{timeout:30000}),resultPromise=page.evaluate(()=>window.buildOpeningAudio()),download=await downloadPromise,result=await resultPromise;await download.saveAs(outputPath);await writeFile(metadataPath,JSON.stringify(result,null,2),"utf8");console.log(JSON.stringify({outputPath,...result},null,2))}finally{await browser.close()}

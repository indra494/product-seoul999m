import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const projectRoot=path.resolve(import.meta.dirname,".."),workspaceRoot=path.resolve(projectRoot,"..","..");
const version=process.env.DEMO_VERSION||"v5";
const videoName=process.env.DEMO_FILE||`seoul-999m-hackathon-demo-${version}.mp4`;
const videoPath=path.join(workspaceRoot,"5. 오픈","영상",videoName);
const sheetPath=path.join(workspaceRoot,"5. 오픈","영상","analysis",`${videoName.replace(/\.mp4$/i,"")}-contact-sheet.jpg`);
const playwrightModule=process.env.CODEX_PLAYWRIGHT_MODULE||"C:/Users/indra/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const chromePath=process.env.CHROME_EXECUTABLE||"C:/Program Files/Google/Chrome/Application/chrome.exe";
if(!existsSync(videoPath))throw new Error(`Missing video: ${videoPath}`);
const{chromium}=await import(pathToFileURL(playwrightModule).href),browser=await chromium.launch({executablePath:chromePath,headless:true,args:["--allow-file-access-from-files","--autoplay-policy=no-user-gesture-required"]});
try{const page=await browser.newPage({viewport:{width:960,height:540}});await page.goto(pathToFileURL(videoPath).href);const video=page.locator("video");await video.waitFor({state:"attached"});const metadata=await video.evaluate(v=>new Promise(resolve=>{const read=()=>resolve({duration:v.duration,width:v.videoWidth,height:v.videoHeight});if(v.readyState>=1)read();else v.addEventListener("loadedmetadata",read,{once:true})}));await video.evaluate(async v=>{v.muted=true;await v.play();await new Promise(r=>setTimeout(r,1200));v.pause()});const decodedAudioBytes=await video.evaluate(v=>v.webkitAudioDecodedByteCount??null);const times=[1,7,15,21,35,50,70,90,110,130,140,150,160,170,174],tiles=[];for(const time of times){await video.evaluate((v,t)=>new Promise(resolve=>{v.addEventListener("seeked",resolve,{once:true});v.currentTime=t}),time);const frame=await video.screenshot({type:"jpeg",quality:78});const label=Buffer.from(`<svg width="480" height="34" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#071011"/><text x="12" y="24" fill="#f0d27a" font-family="Arial, Malgun Gothic" font-size="19" font-weight="700">완성본 ${String(Math.floor(time/60)).padStart(2,"0")}:${String(time%60).padStart(2,"0")}</text></svg>`);tiles.push(await sharp(frame).resize(480,270,{fit:"contain",background:"#000"}).extend({bottom:34,background:"#071011"}).composite([{input:label,top:270,left:0}]).jpeg({quality:82}).toBuffer())}await sharp({create:{width:2400,height:912,channels:3,background:"#000"}}).composite(tiles.map((input,i)=>({input,left:(i%5)*480,top:Math.floor(i/5)*304}))).jpeg({quality:86}).toFile(sheetPath);console.log(JSON.stringify({videoPath,sheetPath,...metadata,decodedAudioBytes},null,2))}finally{await browser.close()}

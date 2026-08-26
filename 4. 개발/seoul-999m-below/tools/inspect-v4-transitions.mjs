import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

const workspaceRoot=path.resolve(import.meta.dirname,"..","..","..");
const videoPath=path.join(workspaceRoot,"5. 오픈","영상","seoul-999m-hackathon-demo-v4.mp4");
const outputPath=path.join(workspaceRoot,"5. 오픈","영상","analysis","seoul-999m-hackathon-demo-v4-transitions.jpg");
const playwrightModule="C:/Users/indra/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";
const{chromium}=await import(pathToFileURL(playwrightModule).href);
const browser=await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true,args:["--allow-file-access-from-files"]});
try{const page=await browser.newPage({viewport:{width:960,height:540}});await page.goto(pathToFileURL(videoPath).href);const video=page.locator("video");await video.waitFor({state:"attached"});const times=[1,2.15,2.6,167.15,167.65,168.35],tiles=[];for(const time of times){await video.evaluate((v,t)=>new Promise(resolve=>{v.addEventListener("seeked",resolve,{once:true});v.currentTime=t}),time);const frame=await video.screenshot({type:"jpeg",quality:82});const label=Buffer.from(`<svg width="640" height="38" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#071011"/><text x="14" y="27" fill="#f0d27a" font-family="Arial, Malgun Gothic" font-size="21" font-weight="700">${time.toFixed(2)}초</text></svg>`);tiles.push(await sharp(frame).resize(640,360,{fit:"contain",background:"#000"}).extend({bottom:38,background:"#071011"}).composite([{input:label,top:360,left:0}]).jpeg({quality:86}).toBuffer())}await sharp({create:{width:1920,height:796,channels:3,background:"#000"}}).composite(tiles.map((input,i)=>({input,left:(i%3)*640,top:Math.floor(i/3)*398}))).jpeg({quality:88}).toFile(outputPath);console.log(JSON.stringify({outputPath,times},null,2))}finally{await browser.close()}

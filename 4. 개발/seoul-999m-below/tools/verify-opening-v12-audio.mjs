import { readFile } from "node:fs/promises";
import path from "node:path";

const projectRoot=path.resolve(import.meta.dirname,".."),workspaceRoot=path.resolve(projectRoot,"..",".."),audioRoot=path.join(workspaceRoot,"3. 설계","영상","프롤로그","v12","audio");
const timing=JSON.parse(await readFile(path.join(audioRoot,"opening-v12-timing.json"),"utf8"));
const readWords=async(name)=>(await readFile(path.join(audioRoot,name),"utf8")).trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line).text);
const expectedNormal=["지상은","죽었다","하늘은","독성","먼지로","뒤덮였고","인류는","더","이상","그곳에서","숨을","쉴","수","없었다","살아남은","사람들은","땅속으로","내려갔다","지하","구백구십구","미터","과거에","건설된","공기","정화층이","아직","작동하는","생존","가능","구역이었다","서울도","그곳에","새로운","도시를","세웠다"];
const expectedNext=["각","도시의","연구자들은","언젠가","지상을","되살리기","위한","연구를","계속했다"];
const normalWords=await readWords("narration-normal-sunhi-neural.vtt"),nextWords=await readWords("narration-next-sunhi-neural.vtt");
if(JSON.stringify(normalWords)!==JSON.stringify(expectedNormal))throw Error("Normal narration word boundaries differ from approved text.");
if(JSON.stringify(nextWords)!==JSON.stringify(expectedNext))throw Error("Glitch-source narration word boundaries differ from approved text.");
const wav=await readFile(path.join(audioRoot,"opening-final-mix.wav"));let position=12,formatOffset,dataOffset,dataSize;
while(position+8<=wav.length){const id=wav.toString("ascii",position,position+4),size=wav.readUInt32LE(position+4);if(id==="fmt ")formatOffset=position+8;if(id==="data"){dataOffset=position+8;dataSize=size;break}position+=8+size+(size%2)}
if(!formatOffset||!dataOffset)throw Error("Invalid final WAV.");const channels=wav.readUInt16LE(formatOffset+2),sampleRate=wav.readUInt32LE(formatOffset+4),blockAlign=wav.readUInt16LE(formatOffset+12),bits=wav.readUInt16LE(formatOffset+14);if(bits!==16)throw Error("Expected 16-bit PCM.");
const stats=(start,end)=>{let sum=0,count=0,peak=0,clipped=0;for(let frame=Math.floor(start*sampleRate);frame<Math.min(Math.floor(end*sampleRate),Math.floor(dataSize/blockAlign));frame++){const value=wav.readInt16LE(dataOffset+frame*blockAlign)/32768,absolute=Math.abs(value);sum+=value*value;peak=Math.max(peak,absolute);if(absolute>=.999)clipped++;count++}return{rms:Math.sqrt(sum/Math.max(1,count)),peak,clippedSamples:clipped}};
const result={duration:dataSize/(sampleRate*blockAlign),sampleRate,channels,timing,words:{normal:`${normalWords.length}/${expectedNormal.length}`,glitchSource:`${nextWords.length}/${expectedNext.length}`},sections:{preNarration:stats(0,.2),normalNarration:stats(.35,timing.glitchStart-.15),stutterAndEffects:stats(timing.glitchStart+.03,timing.glitchEnd-.08),ending:stats(timing.logoStart,Math.min(timing.duration,timing.logoStart+1.4))}};
console.log(JSON.stringify(result,null,2));
if(result.sections.preNarration.rms>1e-5)throw Error("Unexpected sound before narration.");
if(result.sections.stutterAndEffects.rms<result.sections.normalNarration.rms*1.15)throw Error("Glitch effects are not clearly louder than narration.");
if(result.sections.stutterAndEffects.clippedSamples>0)throw Error("Glitch effects clip in the final mix.");

import sharp from "sharp";
import {dirname,resolve} from "node:path";
import {mkdir} from "node:fs/promises";

const jobs=[
 {source:"../../3. 설계/설치물/버그본/v1/bugborn-buildables-concept-v1.png",crop:{left:0,top:80,width:500,height:850},output:"public/assets/buildables/bugborn/bugborn-root-ambusher-v1-alpha.png"},
 {source:"../../3. 설계/설치물/버그본/v1/bugborn-buildables-concept-v1.png",crop:{left:555,top:45,width:440,height:900},output:"public/assets/buildables/bugborn/bugborn-venom-tree-v1-alpha.png"},
 {source:"../../3. 설계/설치물/버그본/v1/bugborn-buildables-concept-v1.png",crop:{left:1040,top:115,width:496,height:790},output:"public/assets/buildables/bugborn/bugborn-bone-wall-v1-alpha.png"},
 {source:"../../3. 설계/설치물/AI로봇/v1/ai-robot-buildables-concept-v1.png",crop:{left:0,top:95,width:520,height:805},output:"public/assets/buildables/ai/ai-laser-l1-v1-alpha.png"},
 {source:"../../3. 설계/설치물/AI로봇/v1/ai-robot-buildables-concept-v1.png",crop:{left:520,top:55,width:455,height:875},output:"public/assets/buildables/ai/ai-missile-m2-v1-alpha.png"},
 {source:"../../3. 설계/설치물/AI로봇/v1/ai-robot-buildables-concept-v1.png",crop:{left:1070,top:105,width:466,height:815},output:"public/assets/buildables/ai/ai-armor-wall-a6-v1-alpha.png"},
];

for(const job of jobs){
 const output=resolve(job.output);
 await mkdir(dirname(output),{recursive:true});
 await sharp(resolve(job.source))
  .extract(job.crop)
  .trim({background:{r:17,g:22,b:22},threshold:18})
  .resize(256,256,{fit:"contain",background:{r:0,g:0,b:0,alpha:0},kernel:"lanczos3"})
  .png({compressionLevel:9})
  .toFile(output);
 console.log(output);
}

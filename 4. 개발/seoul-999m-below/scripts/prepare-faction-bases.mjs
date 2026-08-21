import sharp from "sharp";
import {dirname,resolve} from "node:path";
import {mkdir} from "node:fs/promises";

const jobs=[
 {source:"../../3. 설계/거점/버그본/군체코어/v1/bugborn-hive-core-v1-source.png",output:"public/assets/bases/bugborn/bugborn-hive-core-v1-alpha.png"},
 {source:"../../3. 설계/거점/AI로봇/도시관제코어/v1/ai-city-control-core-v1-source.png",output:"public/assets/bases/ai/ai-city-control-core-v1-alpha.png"},
];

for(const job of jobs){
 const output=resolve(job.output);
 await mkdir(dirname(output),{recursive:true});
 await sharp(resolve(job.source))
  .trim({background:{r:0,g:0,b:0,alpha:0},threshold:8})
  .resize(512,512,{fit:"contain",background:{r:0,g:0,b:0,alpha:0},kernel:"lanczos3"})
  .png({compressionLevel:9})
  .toFile(output);
 console.log(output);
}

import sharp from "sharp";
import {mkdir} from "node:fs/promises";
import {resolve,dirname} from "node:path";

const specs=[
 {source:"../../3. 설계/케릭터/공통/게임스프라이트/v2/human-roster-vertical-v2-source.png",output:"public/assets/characters/sprites/roster-v2/human-roster-vertical-v2.png",height:384},
 {source:"../../3. 설계/케릭터/공통/게임스프라이트/v2/bugborn-roster-vertical-v2-source.png",output:"public/assets/characters/sprites/roster-v2/bugborn-roster-vertical-v2.png",height:512},
 {source:"../../3. 설계/케릭터/공통/게임스프라이트/v2/ai-roster-vertical-v2-source.png",output:"public/assets/characters/sprites/roster-v2/ai-roster-vertical-v2.png",height:512},
];

for(const spec of specs){
 const source=resolve(spec.source),output=resolve(spec.output);
 const {data,info}=await sharp(source).ensureAlpha().resize(512,spec.height,{fit:"fill",kernel:"lanczos3"}).raw().toBuffer({resolveWithObject:true});
 for(let i=3;i<data.length;i+=4)if(data[i]<10)data[i]=0;
 await mkdir(dirname(output),{recursive:true});
 await sharp(data,{raw:info}).png({compressionLevel:9,palette:true,quality:100}).toFile(output);
 console.log(`${spec.output}: ${info.width}x${info.height}`);
}

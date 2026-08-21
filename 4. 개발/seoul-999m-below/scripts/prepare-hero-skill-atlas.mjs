import sharp from "sharp";
import {mkdir} from "node:fs/promises";
import {resolve,dirname} from "node:path";

const specs=[
 {source:"../../3. 설계/케릭터/공통/게임스프라이트/v3/human-roster-skill-poses-v3-source.png",output:"public/assets/characters/sprites/roster-v3/human-roster-skill-poses-v3.png",width:1024,height:768,removeLightGrid:true},
 {source:"../../3. 설계/케릭터/공통/게임스프라이트/v3/bugborn-roster-skill-poses-v3-source.png",output:"public/assets/characters/sprites/roster-v3/bugborn-roster-skill-poses-v3.png",width:1024,height:1024,removeLightGrid:false},
 {source:"../../3. 설계/케릭터/공통/게임스프라이트/v3/ai-roster-skill-poses-v3-source.png",output:"public/assets/characters/sprites/roster-v3/ai-roster-skill-poses-v3.png",width:1024,height:1024,removeLightGrid:true},
];

const removeConnectedLightGrid=(data,width,height)=>{
 const seen=new Uint8Array(width*height),queue=new Int32Array(width*height);let head=0,tail=0;
 const lightNeutral=index=>{const i=index*4,r=data[i],g=data[i+1],b=data[i+2],a=data[i+3],hi=Math.max(r,g,b),lo=Math.min(r,g,b);return a>0&&lo>210&&hi-lo<22};
 const add=index=>{if(index<0||index>=seen.length||seen[index]||!lightNeutral(index))return;seen[index]=1;queue[tail++]=index};
 for(let x=0;x<width;x++){add(x);add((height-1)*width+x)}
 for(let y=0;y<height;y++){add(y*width);add(y*width+width-1)}
 while(head<tail){const index=queue[head++],x=index%width,y=Math.floor(index/width);if(x) add(index-1);if(x<width-1)add(index+1);if(y)add(index-width);if(y<height-1)add(index+width)}
 for(let index=0;index<seen.length;index++)if(seen[index])data[index*4+3]=0;
};

for(const spec of specs){
 const source=resolve(spec.source),output=resolve(spec.output);
 const {data,info}=await sharp(source).ensureAlpha().resize(spec.width,spec.height,{fit:"fill",kernel:"lanczos3"}).raw().toBuffer({resolveWithObject:true});
 if(spec.removeLightGrid)removeConnectedLightGrid(data,info.width,info.height);
 for(let i=3;i<data.length;i+=4)if(data[i]<18)data[i]=0;
 await mkdir(dirname(output),{recursive:true});
 await sharp(data,{raw:info}).png({compressionLevel:9}).toFile(output);
 console.log(`${spec.output}: ${info.width}x${info.height}`);
}

import sharp from "sharp";
import {resolve} from "node:path";
import {unlink} from "node:fs/promises";

const files=[
 "public/assets/minions/human/human-minion-actions-v1.png",
 "public/assets/minions/bugborn/bugborn-minion-actions-v1.png",
 "public/assets/minions/ai/ai-minion-actions-v1.png",
];

for(const file of files){
 const path=resolve(file),image=sharp(path),{data,info}=await image.ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const count=info.width*info.height,background=new Uint8Array(count),queue=new Int32Array(count);let head=0,tail=0;
 const enqueue=index=>{if(!background[index]){background[index]=1;queue[tail++]=index}};
 for(let x=0;x<info.width;x++){enqueue(x);enqueue((info.height-1)*info.width+x)}
 for(let y=0;y<info.height;y++){enqueue(y*info.width);enqueue(y*info.width+info.width-1)}
 const visit=(index,next)=>{if(next<0||next>=count||background[next])return;const p=index*4,n=next*4,diff=Math.abs(data[p]-data[n])+Math.abs(data[p+1]-data[n+1])+Math.abs(data[p+2]-data[n+2]);if(diff<22)enqueue(next)};
 while(head<tail){const index=queue[head++],x=index%info.width;visit(index,x?index-1:-1);visit(index,x<info.width-1?index+1:-1);visit(index,index-info.width);visit(index,index+info.width)}
 for(let index=0;index<count;index++){const p=index*4,r=data[p],g=data[p+1],b=data[p+2],neutralLight=r>225&&g>225&&b>225&&Math.max(r,g,b)-Math.min(r,g,b)<14;if(background[index]||neutralLight)data[p+3]=0}
 const height=Math.round(info.height*768/info.width);
 const prepared=`${path}.prepared.png`;
 await sharp(data,{raw:info}).resize(768,height,{kernel:"lanczos3"}).png({compressionLevel:9,palette:true,quality:100}).toFile(prepared);
 await sharp(prepared).toFile(path);
 await unlink(prepared);
}

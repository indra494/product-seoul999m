import sharp from "sharp";
import {resolve} from "node:path";

const source=resolve("../../3. 설계/케릭터/AI로봇/C-999국장/게임스프라이트/v2/ai-c999-director-actions-v2-source.png");
const output=resolve("public/assets/characters/sprites/roster-v1/ai-c999-director-actions-v2.png");

await sharp(source)
 .extract({left:0,top:82,width:2172,height:560})
 .resize(768,128,{kernel:"lanczos3",fit:"fill"})
 .png({compressionLevel:9,palette:true,quality:100})
 .toFile(output);

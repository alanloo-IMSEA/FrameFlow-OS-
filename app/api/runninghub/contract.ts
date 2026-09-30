export const RUNNINGHUB_UPSCALE_WORKFLOW_ID="2095002873376854017";
export const RUNNINGHUB_INPUT_NODE={nodeId:"145",fieldName:"image"}as const;
export const RUNNINGHUB_FINAL_NODE_ID="143";
export const UPSCALE_STATUSES=["UPSCALE_PENDING","UPSCALE_PROCESSING","UPSCALE_COMPLETED","UPSCALE_FAILED"]as const;

export function runningHubNodeInfo(fileName:string){return[{nodeId:RUNNINGHUB_INPUT_NODE.nodeId,fieldName:RUNNINGHUB_INPUT_NODE.fieldName,fieldValue:fileName}]}

export function imageDimensions(bytes:Uint8Array,mime=""){try{
 if((mime.includes("png")||bytes[0]===0x89)&&bytes.length>=24)return{width:(bytes[16]<<24)|(bytes[17]<<16)|(bytes[18]<<8)|bytes[19],height:(bytes[20]<<24)|(bytes[21]<<16)|(bytes[22]<<8)|bytes[23]};
 if((mime.includes("webp")||String.fromCharCode(...bytes.slice(8,12))==="WEBP")&&bytes.length>=30){const type=String.fromCharCode(...bytes.slice(12,16));if(type==="VP8X")return{width:1+bytes[24]+(bytes[25]<<8)+(bytes[26]<<16),height:1+bytes[27]+(bytes[28]<<8)+(bytes[29]<<16)}}
 if(mime.includes("jpeg")||mime.includes("jpg")||(bytes[0]===0xff&&bytes[1]===0xd8)){let offset=2;while(offset+8<bytes.length){if(bytes[offset]!==0xff){offset++;continue}const marker=bytes[offset+1],length=(bytes[offset+2]<<8)+bytes[offset+3];if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return{width:(bytes[offset+7]<<8)+bytes[offset+8],height:(bytes[offset+5]<<8)+bytes[offset+6]};if(length<2)break;offset+=2+length}}
 }catch{}return null}

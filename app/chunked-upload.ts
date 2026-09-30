"use client";

const CHUNK_BYTES=640*1024;

async function errorMessage(response:Response,fallback:string){
 try{const data=await response.json() as any;return data?.error||fallback}catch{return fallback}
}

export async function uploadFileInChunks(input:{file:File;projectId:string;phase:string;itemKey:string;replaceSet?:boolean;onProgress?:(percent:number)=>void}){
 const{file,projectId,phase,itemKey,replaceSet=false,onProgress}=input,uploadId=crypto.randomUUID(),totalParts=Math.max(1,Math.ceil(file.size/CHUNK_BYTES));
 for(let part=0;part<totalParts;part++){
  const body=file.slice(part*CHUNK_BYTES,Math.min(file.size,(part+1)*CHUNK_BYTES));
  const url=new URL("/api/uploads",window.location.origin);url.searchParams.set("action","chunk");url.searchParams.set("uploadId",uploadId);url.searchParams.set("part",String(part));url.searchParams.set("totalParts",String(totalParts));url.searchParams.set("projectId",projectId);url.searchParams.set("phase",phase);url.searchParams.set("itemKey",itemKey);
  let response:Response|null=null;
  for(let attempt=0;attempt<2;attempt++){response=await fetch(url,{method:"POST",headers:{"content-type":"application/octet-stream"},body});if(response.ok)break}
  if(!response?.ok)throw new Error(await errorMessage(response!,`Upload part ${part+1} failed (${response?.status||"network"})`));
  onProgress?.(Math.round(((part+1)/(totalParts+1))*100));
 }
 const response=await fetch("/api/uploads",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"complete-chunked-upload",uploadId,totalParts,projectId,phase,itemKey,fileName:file.name,mimeType:file.type||"application/octet-stream",sizeBytes:file.size,replaceSet})});
 if(!response.ok)throw new Error(await errorMessage(response,`Upload finalization failed (${response.status})`));
 onProgress?.(100);return response.json();
}

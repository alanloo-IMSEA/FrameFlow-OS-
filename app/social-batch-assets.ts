export type SocialBatchLike={id?:number|string|null;batchId?:number|string|null;batch_id?:number|string|null};

export function socialBatchAssetPrefix(batch:SocialBatchLike|number|string|null|undefined){
 const id=typeof batch==="object"&&batch!==null?(batch.id??batch.batchId??batch.batch_id):batch;
 return id===null||id===undefined||String(id).trim()===""?"":`batch-${String(id).trim()}-`;
}

export function socialBatchAssetKey(batch:SocialBatchLike|number|string|null|undefined,logicalItemKey:string){
 return `${socialBatchAssetPrefix(batch)}${logicalItemKey}`;
}

export function socialBatchAssetKeys(batch:SocialBatchLike|number|string|null|undefined,logicalItemKeys:string[]=[]){
 return Array.from(new Set(logicalItemKeys.map(itemKey=>socialBatchAssetKey(batch,itemKey)).filter(Boolean)));
}

export function socialBatchProductionAssetKeys(batch:SocialBatchLike|number|string|null|undefined,payload:any){
 const items=Array.isArray(payload?.production_items)?payload.production_items:[];
 return socialBatchAssetKeys(batch,items.flatMap((item:any,index:number)=>{
  const contentId=String(item.contentId||item.content_id||`content_${index+1}`),assets=Array.isArray(item.assets)?item.assets:[];
  return assets.map((asset:any,assetIndex:number)=>`${contentId}-asset-${Number(asset.assetNumber||asset.asset_number||assetIndex+1)}`);
 }));
}

export function socialBatchAssetPrefixFromKey(itemKey:string){
 return String(itemKey||"").match(/^(batch-[^-]+-)/)?.[1]||"";
}

export function socialBatchContentId(itemKey:string){
 return String(itemKey||"").replace(/^batch-[^-]+-/,"").replace(/-(?:asset-\d+|video)$/ ,"");
}

export function selectSocialProductionBatch(batches:any[]=[]){
 const ordered=[...batches].sort((a,b)=>Number(a.batchNumber||a.batch_number||0)-Number(b.batchNumber||b.batch_number||0));
 return ordered.find(batch=>["Planning","Reopened","Retake"].includes(String(batch.status)))||ordered.find(batch=>batch.status==="Active")||ordered.find(batch=>batch.status!=="Completed")||ordered.at(-1)||null;
}

export function contentId(value:any,index=0){return String(value?.id||value?.contentId||value?.content_id||`content_${index+1}`)}

export function plannedVisualCount(value:any){
 const raw=value?.visualAssetCount??value?.visual_asset_count??value?.assetCount??value?.asset_count??1;
 return Math.max(1,Math.floor(Number(raw)||1));
}

export function plannedVisuals(batchData:any){
 const items=Array.isArray(batchData?.content_items)?batchData.content_items:Array.isArray(batchData?.items)?batchData.items:[];
 return items.map((item:any,index:number)=>({contentId:contentId(item,index),count:plannedVisualCount(item)}));
}

export function productionAssetCountIssues(batchData:any,productionData:any){
 const productionItems=Array.isArray(productionData?.production_items)?productionData.production_items:Array.isArray(productionData?.items)?productionData.items:[];
 const byId=new Map(productionItems.map((item:any,index:number)=>[contentId(item,index),item]));
 const issues:string[]=[];
 for(const plan of plannedVisuals(batchData)){
  const item:any=byId.get(plan.contentId),assets=Array.isArray(item?.assets)?item.assets:[],numbers=new Set(assets.map((asset:any,index:number)=>Number(asset?.assetNumber??asset?.asset_number??index+1)).filter(Number.isFinite));
  if(!item){issues.push(`${plan.contentId}: missing Content Production item`);continue}
  for(let assetNumber=1;assetNumber<=plan.count;assetNumber++)if(!numbers.has(assetNumber))issues.push(`${plan.contentId}: missing visual ${assetNumber} of ${plan.count}`);
  for(const assetNumber of numbers)if(assetNumber<1||assetNumber>plan.count)issues.push(`${plan.contentId}: unexpected visual ${assetNumber}; approved plan requires ${plan.count}`);
 }
 return issues;
}

export function batchHasContinuationVisuals(batchData:any){return plannedVisuals(batchData).some(item=>item.count>1)}

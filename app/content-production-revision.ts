export function compactContentProductionRevisionDraft(value:any){
 const items=Array.isArray(value?.production_items)?value.production_items:Array.isArray(value?.items)?value.items:[];
 return{
  productionSummary:String(value?.productionSummary||value?.production_summary||""),
  technicalNotes:String(value?.technicalNotes||value?.technical_notes||""),
  items:items.map((item:any,index:number)=>({
   contentId:String(item?.contentId||item?.content_id||`content_${index+1}`),
   contentType:String(item?.contentType||item?.content_type||""),
   title:String(item?.title||""),hook:String(item?.hook||""),caption:String(item?.caption||item?.finalCaption||item?.final_caption||""),hashtags:String(item?.hashtags||""),
   assets:(Array.isArray(item?.assets)?item.assets:[]).map((asset:any,assetIndex:number)=>({
    assetNumber:Number(asset?.assetNumber||asset?.asset_number||assetIndex+1),
    assetRole:String(asset?.assetRole||asset?.asset_role||""),
    subjectPresence:String(asset?.subjectPresence||asset?.subject_presence||""),
    generationMode:String(asset?.visualPrompt?.generationMode||asset?.generationMode||asset?.generation_mode||""),
    shotPurpose:String(asset?.shotPurpose||asset?.shot_purpose||asset?.visualPrompt?.shotPurpose||""),
    referenceSwitches:asset?.visualPrompt?.referenceSwitches||asset?.referenceSwitches||asset?.reference_switches||{},
    wardrobe:asset?.wardrobe||{},
    structuredVisualAnchor:asset?.visualPrompt?.structuredAnchor||asset?.structuredVisualAnchor||asset?.structured_visual_anchor||{}
   }))
  }))
 }
}

export function contentProductionRetakeContentIds(fieldFeedback:Record<string,string>|undefined,currentDraft:any){
 const requested=new Set(Object.keys(fieldFeedback||{}).map(key=>key.match(/^production_items\.([^.]+)\./)?.[1]).filter(Boolean)as string[]);
 return compactContentProductionRevisionDraft(currentDraft).items.map((item:any)=>String(item.contentId)).filter((id:string)=>requested.has(id));
}

export function mergeContentProductionRevisionItems(currentDraft:any,revisedItems:any[],summary?:{productionSummary?:string;technicalNotes?:string}){
 const baseline=compactContentProductionRevisionDraft(currentDraft),byId=new Map((Array.isArray(revisedItems)?revisedItems:[]).map((item:any)=>[String(item?.contentId||item?.content_id||""),item]));
 return{
  productionSummary:String(summary?.productionSummary||baseline.productionSummary),
  technicalNotes:String(summary?.technicalNotes||baseline.technicalNotes),
  items:baseline.items.map((item:any)=>byId.get(String(item.contentId))||item)
 }
}

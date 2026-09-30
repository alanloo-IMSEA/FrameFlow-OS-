export type ReelFirstFrameAsset={
 id:number;
 itemKey:string;
 storageKey?:string;
 fileName?:string;
 mimeType?:string;
 sizeBytes?:number;
 version?:number;
 isCurrent?:number|boolean;
 createdAt?:string|null;
 sourceAssetId?:number|null;
 upscaleStatus?:string|null;
 [key:string]:unknown;
};

function beforeOrAt(value:string|null|undefined,limit:string|null|undefined){
 const valueTime=Date.parse(String(value||"")),limitTime=Date.parse(String(limit||""));
 return Number.isFinite(valueTime)&&Number.isFinite(limitTime)&&valueTime<=limitTime;
}

/** Resolve a Reel first frame inside one approved, Batch-scoped Content Item. */
export function selectApprovedReelFirstFrame(input:{
 requestedId?:number|null;
 approvedAnchorId?:number|null;
 approvedAt?:string|null;
 expectedItemKey:string;
 legacyItemKey?:string|null;
 assets:ReelFirstFrameAsset[];
}){
 const acceptedKeys=new Set([input.expectedItemKey,...(input.legacyItemKey?[input.legacyItemKey]:[])]),assets=input.assets.filter(asset=>acceptedKeys.has(asset.itemKey)),byId=new Map(assets.map(asset=>[Number(asset.id),asset])),explicitId=Number(input.approvedAnchorId||0),legacyApproved=assets.filter(asset=>beforeOrAt(asset.createdAt,input.approvedAt)).sort((left,right)=>Number(right.itemKey===input.expectedItemKey)-Number(left.itemKey===input.expectedItemKey)||Number(Boolean(right.isCurrent))-Number(Boolean(left.isCurrent))||Number(right.version||0)-Number(left.version||0)||Number(right.id)-Number(left.id))[0],approved=explicitId?byId.get(explicitId):legacyApproved;
 if(!approved)return null;
 const existedAtApproval=(asset:ReelFirstFrameAsset)=>Number(asset.id)===Number(approved.id)||beforeOrAt(asset.createdAt,input.approvedAt);
 const eligible=(asset:ReelFirstFrameAsset|undefined)=>{
  if(!asset||!acceptedKeys.has(asset.itemKey))return false;
  if(Number(asset.id)===Number(approved.id))return true;
  if(!asset.isCurrent)return false;
  if(existedAtApproval(asset))return true;
  const source=byId.get(Number(asset.sourceAssetId||0));
  return asset.upscaleStatus==="UPSCALE_COMPLETED"&&Boolean(source)&&existedAtApproval(source!);
 };
 const requested=byId.get(Number(input.requestedId||0));
 if(eligible(requested))return requested!;
 const current=assets.filter(asset=>Boolean(asset.isCurrent)).sort((left,right)=>Number(right.id)-Number(left.id)).find(eligible);
 return current||approved;
}

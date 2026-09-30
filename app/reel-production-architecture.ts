export const REEL_STYLES=[
 {key:"IMAGE_TO_VIDEO",label:"Image to Video",coreInput:"Approved Image",output:"One continuous shot",executionReady:true,workflowId:"2096500485405868034"},
 {key:"CINEMATIC_MULTI_SHOT",label:"Cinematic Multi-shot",coreInput:"Script + multiple Anchors",output:"Multiple independent shots",executionReady:false,workflowId:null},
 {key:"REFERENCE_MOTION",label:"Reference Motion",coreInput:"Image + Reference Video",output:"Motion transfer",executionReady:false,workflowId:null},
 {key:"TALKING_REEL",label:"Talking Reel",coreInput:"Image + Audio or Text",output:"Talking / lip sync",executionReady:false,workflowId:null},
 {key:"KINETIC_GRAPHIC",label:"Kinetic Graphic",coreInput:"Product plates + Edit plan",output:"Motion graphic / edit",executionReady:false,workflowId:null},
]as const;

export type ReelStyleKey=typeof REEL_STYLES[number]["key"];
export const reelStyleDefinition=(key:unknown)=>REEL_STYLES.find(style=>style.key===String(key));

function timestamp(value:unknown){const parsed=Date.parse(String(value||""));return Number.isFinite(parsed)?parsed:0}
export function unresolvedReelPromptRetake(latestRetakeAt:unknown,resolvedAt:unknown[]){const retake=timestamp(latestRetakeAt);return retake>0&&retake>Math.max(0,...resolvedAt.map(timestamp))}

export function reelRetakeContentIds(fieldFeedback:Record<string,string>|undefined,items:any[]=[]){
 const available=new Set(items.map((item:any)=>String(item?.contentId||item?.content_id||"")).filter(Boolean)),requested=new Set<string>();
 for(const key of Object.keys(fieldFeedback||{})){
  const match=key.match(/^reel_video_items\.([^.]+)(?:\.|$)/);
  if(match&&(!available.size||available.has(match[1])))requested.add(match[1]);
 }
 return[...requested];
}

export function approvedReelGenerationRetryData(value:any){
 const data=value&&typeof value==="object"?JSON.parse(JSON.stringify(value)):null,items=Array.isArray(data?.reel_video_items)?data.reel_video_items:[];
 if(!data||!items.length||items.some((item:any)=>!String(item.compiledVideoPrompt||"").trim()||!Number(item.firstFrameAssetId||item.first_frame_asset_id)||!Number(item.referenceAssetId||item.characterReferenceAssetId)))return null;
 data._reelStage="generation";
 for(const key of ["_videoGenerationParentJobId","_videoGenerationJobIds","_workingDraftStatus","_validationIssues","_workingDraftSavedAt","reviewNote","reviewFeedback","_acceptedReviewFields","_revisionFeedbackApplied"])delete data[key];
 for(const item of items)delete item.generationStatus;
 return data;
}

export function reelConfigurationIssues(item:any){
 const style=reelStyleDefinition(item?.reelStyle||item?.reelType),issues:string[]=[];
 if(!style)issues.push("Tier 0–1 must select a Reel Style before the Agent creates its prompt.");
 else if(!style.executionReady||!style.workflowId)issues.push(`${style.label} does not have a registered execution workflow yet.`);
 if(style&&String(item?.workflowId||"")!==String(style.workflowId||""))issues.push("The selected Reel workflow does not match the locked Workflow Registry.");
 return issues;
}

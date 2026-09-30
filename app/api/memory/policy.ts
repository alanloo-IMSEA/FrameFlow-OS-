export const MEMORY_POLICY_VERSION="frameflow.memory-policy.v1";

export const MEMORY_LAYERS={
 working:{authority:"WORKING_NOT_DURABLE",tables:["phase_records","generation_context_cache"]},
 approvedProject:{authority:"APPROVED_AUTHORITATIVE",tables:["approved_phase_snapshots"]},
 outcomeEvidence:{authority:"VERIFIED_EVIDENCE",tables:["publishing_records","social_performance_snapshots"]},
 learned:{authority:"EXPLICITLY_APPROVED_LEARNING",tables:["learning_differences","batch_learning_records"]},
 clientOrganization:{authority:"APPROVED_ORGANIZATIONAL",tables:["client_profiles"]},
 logsObservability:{authority:"NEVER_GENERATION_MEMORY",tables:["audit_log","production_events","agent_runs","orchestrator_job_events","publishing_attempts","agent_file_grant_events","drive_sync_queue"]},
}as const;

export const MEMORY_AUTHORITY_RULE="Only Approved authoritative data, Published outcomes, verified provider-synced performance evidence, and explicitly approved Learned Memory may influence future generation. Batch READY is usable only when approvedAt and approvedBy prove the approval gate.";
export const LOG_MEMORY_BOUNDARY="Log can provide evidence for Memory, but Log must never automatically become Memory.";
export const DEFAULT_CONTEXT_BUDGET={maxChars:96_000,maxEstimatedTokens:24_000,assumedContextWindow:64_000,reserveTokens:{systemPrompt:4_000,currentTask:4_000,finalPromptAndTools:4_000,modelResponse:16_000,total:28_000}};

export type MemoryProvenance={
 sourceType:string;
 sourceId:string;
 scope:{workspaceId?:string|null;projectId:string;phaseKey?:string|null;contentId?:string|null;taskId?:string|null};
 status:string;
 approvedBy?:string|null;
 effectiveAt?:string|null;
 supersedesId?:string|null;
};

export function provenance(input:MemoryProvenance){return input}
export function parseJson(value:any,fallback:any={}){try{return JSON.parse(value||"")}catch{return fallback}}
export function validLearningWindow(start:any,end:any){const a=Date.parse(String(start||"")),b=Date.parse(String(end||""));return Number.isFinite(a)&&Number.isFinite(b)&&b>=a}

export function dedupeBy<T>(rows:T[],key:(row:T)=>string){const seen=new Set<string>(),result:T[]=[];for(const row of rows){const id=key(row);if(!id||seen.has(id))continue;seen.add(id);result.push(row)}return result}

function size(value:any){return JSON.stringify(value).length}
export function estimateTokens(value:any){
 const source=typeof value==="string"?value:JSON.stringify(value),characters=Array.from(source);let ascii=0,cjk=0,other=0;
 for(const character of characters){const code=character.codePointAt(0)||0;if(code<=0x7f)ascii++;else if(code>=0x3400&&code<=0x9fff||code>=0xf900&&code<=0xfaff||code>=0x3040&&code<=0x30ff||code>=0xac00&&code<=0xd7af)cjk++;else other++}
 return Math.ceil(ascii/3.5+cjk*1.15+other*.8);
}
function trimLargeStrings(value:any,maxLength=8_000):any{
 if(typeof value==="string")return value.length>maxLength?value.slice(0,maxLength)+"\n[Context budget: remaining text omitted]":value;
 if(Array.isArray(value))return value.map(item=>trimLargeStrings(item,maxLength));
 if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,trimLargeStrings(item,maxLength)]));
 return value;
}

function omitVisualPriorities(value:any,priorities:Set<string>):any{
 if(Array.isArray(value))return value.map(item=>omitVisualPriorities(item,priorities)).filter(item=>item!==undefined);
 if(!value||typeof value!=="object")return value;
 if(priorities.has(String(value.priority||""))&&("value"in value||"fields"in value))return undefined;
 return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,omitVisualPriorities(item,priorities)]).filter(([,item])=>item!==undefined));
}

export function applyContextBudget(input:any,requested:number|Partial<typeof DEFAULT_CONTEXT_BUDGET>={}){
 const config=typeof requested==="number"?{...DEFAULT_CONTEXT_BUDGET,maxChars:requested}:{...DEFAULT_CONTEXT_BUDGET,...requested,reserveTokens:{...DEFAULT_CONTEXT_BUDGET.reserveTokens,...(requested as any)?.reserveTokens}},maximumChars=config.maxChars,maximumTokens=config.maxEstimatedTokens;
 let context=parseJson(JSON.stringify(input),{}),root=context?.frameflowProjectContext||{},memory=root.productionMemory||{};const omitted:string[]=[];
 root.referenceAssetManifest=dedupeBy(Array.isArray(root.referenceAssetManifest)?root.referenceAssetManifest:[],(row:any)=>String(row.id||row.storageKey||row.itemKey||""));
 root.currentPhaseInputContext=dedupeBy(Array.isArray(root.currentPhaseInputContext)?root.currentPhaseInputContext:[],(row:any)=>`${row.phaseKey||""}:${row.version||""}`);
 memory.learnedMemory=dedupeBy(Array.isArray(memory.learnedMemory)?memory.learnedMemory:[],(row:any)=>String(row?.provenance?.sourceId||row.id||""));
 memory.publishedResults=dedupeBy(Array.isArray(memory.publishedResults)?memory.publishedResults:[],(row:any)=>String(row?.provenance?.sourceId||row.id||row.providerPostId||""));
 memory.performanceEvidence=dedupeBy(Array.isArray(memory.performanceEvidence)?memory.performanceEvidence:[],(row:any)=>String(row?.provenance?.sourceId||row.id||""));

 const over=(value:any)=>size(value)>maximumChars||estimateTokens(value)>maximumTokens,pop=(rows:any[],label:string)=>{if(rows.length){rows.pop();if(!omitted.includes(label))omitted.push(label);return true}return false};
 if(over(context)){context=omitVisualPriorities(context,new Set(["P3_CREATIVE"]));root=context?.frameflowProjectContext||{};memory=root.productionMemory||{};omitted.push("P3 creative fields")}
 while(over(context)){
  if(pop(memory.performanceEvidence,"older performance evidence"))continue;
  if(pop(memory.publishedResults,"older published outcomes"))continue;
  if(pop(memory.learnedMemory,"older approved learning"))continue;
  if(pop(root.referenceAssetManifest,"unselected reference catalog entries"))continue;
  break;
 }
 let bounded=context;
 if(over(bounded)){bounded=omitVisualPriorities(bounded,new Set(["P2_FLEXIBLE"]));omitted.push("P2 flexible visual fields")}
 for(const stringLimit of[8_000,4_000,2_000,1_000,500,250,120,60]){
  if(!over(bounded))break;
  bounded=trimLargeStrings(bounded,stringLimit);
  if(!omitted.includes("long text fields truncated at hard context limit"))omitted.push("long text fields truncated at hard context limit");
 }
 if(over(bounded)){
  const root=bounded.frameflowProjectContext||{},memory=root.productionMemory||{};
  root.currentPhaseInputContext=(root.currentPhaseInputContext||[]).slice(0,1);
  root.referenceAssetManifest=(root.referenceAssetManifest||[]).slice(0,4);
  memory.learnedMemory=(memory.learnedMemory||[]).slice(0,2);
  memory.publishedResults=(memory.publishedResults||[]).slice(0,3);
  memory.performanceEvidence=(memory.performanceEvidence||[]).slice(0,4);
  bounded=trimLargeStrings(bounded,40);
  omitted.push("secondary context compacted to enforce the fixed hard limit");
 }
 const finalRoot=bounded.frameflowProjectContext||{};
 finalRoot.contextBudget={policy:"multilingual-estimate-with-reserve-v2",maxChars:maximumChars,maxEstimatedTokens:maximumTokens,assumedContextWindow:config.assumedContextWindow,reservedTokens:config.reserveTokens,actualChars:0,estimatedTokens:0,withinBudget:false,omitted};
 finalRoot.contextBudget.actualChars=size(bounded);
 finalRoot.contextBudget.estimatedTokens=estimateTokens(bounded);
 finalRoot.contextBudget.withinBudget=finalRoot.contextBudget.actualChars<=maximumChars&&finalRoot.contextBudget.estimatedTokens<=maximumTokens;
 return bounded;
}

export function scopeContentMemory(value:any,contentId?:string|null):any{
 if(!contentId)return value;
 if(Array.isArray(value))return value.map(item=>scopeContentMemory(item,contentId));
 if(!value||typeof value!=="object")return value;
 const result:any={};
 for(const[key,item]of Object.entries(value)){
  if(["content_items","production_items","reel_video_items","items"].includes(key)&&Array.isArray(item))result[key]=item.filter((row:any)=>String(row.id||row.contentId||row.content_id||"")===contentId).map(row=>scopeContentMemory(row,contentId));
  else result[key]=scopeContentMemory(item,contentId);
 }
 return result;
}

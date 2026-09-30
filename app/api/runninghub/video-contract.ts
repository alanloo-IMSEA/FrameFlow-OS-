export const RUNNINGHUB_H3_WORKFLOW_ID="2096500485405868034" as const;
export const RUNNINGHUB_H3_INSTANCE_TYPE="plus" as const;
export const RUNNINGHUB_H3_RECOMMENDED_MEGAPIXELS=0.5 as const;
export const RUNNINGHUB_WORKFLOW_JSON_PATH="/api/openapi/getJsonApiFormat" as const;
export const RUNNINGHUB_H3_CONTRACT_VERSION="RH-H3-I2V-2096500485405868034-V1" as const;
export const RUNNINGHUB_H3_ASPECT_RATIO_VALUES={"1:1":"1:1 (Square)","2:3":"2:3 (Portrait Photo)","3:2":"3:2 (Photo)","3:4":"3:4 (Portrait Standard)","4:3":"4:3 (Standard)","9:16":"9:16 (Portrait Widescreen)","16:9":"16:9 (Widescreen)","21:9":"21:9 (Ultrawide)"}as const;
export function runningHubH3AspectRatioValue(value:unknown){const raw=String(value||"").trim(),direct=Object.values(RUNNINGHUB_H3_ASPECT_RATIO_VALUES).find(label=>label===raw);if(direct)return direct;const mapped=RUNNINGHUB_H3_ASPECT_RATIO_VALUES[raw as keyof typeof RUNNINGHUB_H3_ASPECT_RATIO_VALUES];if(mapped)return mapped;throw Object.assign(new Error(`RunningHub Node 29 does not support the inherited first_frame aspect ratio '${raw||"missing"}'.`),{code:"RUNNINGHUB_H3_ASPECT_RATIO_UNSUPPORTED"})}

export type RunningHubNodeTarget={nodeId:string;fieldName:string};
export type RunningHubH3Mapping={
 workflowId:typeof RUNNINGHUB_H3_WORKFLOW_ID;
 workflowContractVerified:boolean;workflowContractVersion:string;workflowGraphFingerprint:string;
 firstFrame:RunningHubNodeTarget;characterReference:RunningHubNodeTarget;prompt:RunningHubNodeTarget;duration:RunningHubNodeTarget;
 resolution:{kind:"aspect_ratio";target:RunningHubNodeTarget;megapixels:RunningHubNodeTarget};finalNodeId:"21";
 lowConditioning:{nodeId:"7";taskType:"Hybrid";firstFrameNodeId:"6";characterReferenceNodeId:"35";resolutionNodeId:"29";durationNodeId:"30"};
 highConditioning:{nodeId:"14";taskType:"Ref2VA";referenceNodeId:"6";learnedLatentNodeId:"13";durationNodeId:"30";reconcileNodeId:"15"};
 durationConversion:{nodeId:"30";sourceNodeId:"27";ownedByWorkflow:true};
};

export const RUNNINGHUB_H3_LOCKED_MAPPING:RunningHubH3Mapping={
 workflowId:RUNNINGHUB_H3_WORKFLOW_ID,workflowContractVerified:false,workflowContractVersion:RUNNINGHUB_H3_CONTRACT_VERSION,workflowGraphFingerprint:"",
 firstFrame:{nodeId:"6",fieldName:"image"},characterReference:{nodeId:"35",fieldName:"image"},prompt:{nodeId:"28",fieldName:"prompt"},duration:{nodeId:"27",fieldName:"value"},resolution:{kind:"aspect_ratio",target:{nodeId:"29",fieldName:"aspect_ratio"},megapixels:{nodeId:"29",fieldName:"megapixels"}},finalNodeId:"21",
 lowConditioning:{nodeId:"7",taskType:"Hybrid",firstFrameNodeId:"6",characterReferenceNodeId:"35",resolutionNodeId:"29",durationNodeId:"30"},
 highConditioning:{nodeId:"14",taskType:"Ref2VA",referenceNodeId:"6",learnedLatentNodeId:"13",durationNodeId:"30",reconcileNodeId:"15"},durationConversion:{nodeId:"30",sourceNodeId:"27",ownedByWorkflow:true},
};

const stable=(value:any):string=>Array.isArray(value)?`[${value.map(stable).join(",")}]`:value&&typeof value==="object"?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`:JSON.stringify(value);
export function runningHubWorkflowFingerprint(graph:any){const value=stable(graph);let hash=2166136261;for(let index=0;index<value.length;index++){hash^=value.charCodeAt(index);hash=Math.imul(hash,16777619)}return`fnv1a32:${(hash>>>0).toString(16).padStart(8,"0")}:${value.length}`}
export function normalizeRunningHubH3Mapping(value:any):RunningHubH3Mapping{const raw=value&&typeof value==="object"?value:{};return{...RUNNINGHUB_H3_LOCKED_MAPPING,workflowContractVerified:raw.workflowContractVerified===true,workflowContractVersion:String(raw.workflowContractVersion||raw.contractVersion||RUNNINGHUB_H3_CONTRACT_VERSION),workflowGraphFingerprint:String(raw.workflowGraphFingerprint||raw.graphFingerprint||"")}}
export function runningHubH3MappingIssues(input:any){const mapping=normalizeRunningHubH3Mapping(input),issues:string[]=[];if(!mapping.workflowContractVerified)issues.push("Workflow 2096500485405868034 has not passed the immutable H3 contract verifier.");if(mapping.workflowContractVersion!==RUNNINGHUB_H3_CONTRACT_VERSION)issues.push(`Expected contract ${RUNNINGHUB_H3_CONTRACT_VERSION}, received ${mapping.workflowContractVersion||"no contract version"}.`);if(!mapping.workflowGraphFingerprint)issues.push("The verified workflow graph fingerprint is missing.");return issues}
export function runningHubH3NodeInfo(mappingInput:any,input:{firstFrameFileName:string;characterReferenceFileName?:string;compiledVideoPrompt:string;durationSeconds:number;width:number;height:number;aspectRatio:string;megapixels?:number}){const mapping=normalizeRunningHubH3Mapping(mappingInput),issues=runningHubH3MappingIssues(mapping),entry=(target:RunningHubNodeTarget,value:any)=>({nodeId:target.nodeId,fieldName:target.fieldName,fieldValue:value}),requestedMegapixels=Number(input.megapixels),megapixels=Number.isFinite(requestedMegapixels)&&requestedMegapixels>0?requestedMegapixels:RUNNINGHUB_H3_RECOMMENDED_MEGAPIXELS;if(issues.length)throw new Error(issues.join(" "));return[entry(mapping.firstFrame,input.firstFrameFileName),...(input.characterReferenceFileName?[entry(mapping.characterReference,input.characterReferenceFileName)]:[]),entry(mapping.prompt,input.compiledVideoPrompt),entry(mapping.duration,input.durationSeconds),entry(mapping.resolution.target,runningHubH3AspectRatioValue(input.aspectRatio)),entry(mapping.resolution.megapixels,megapixels)]}
export function runningHubH3SubmissionPayload(apiKey:string,nodeInfoList:any[]){return{apiKey,workflowId:RUNNINGHUB_H3_WORKFLOW_ID,nodeInfoList,instanceType:RUNNINGHUB_H3_INSTANCE_TYPE}}
export function runningHubAllocatedInstanceType(...values:any[]){const keys=new Set(["actualinstancetype","allocatedinstancetype","instancetype"]),visit=(value:any,depth=0):string=>{if(depth>5||value==null)return"";if(Array.isArray(value)){for(const item of value){const found=visit(item,depth+1);if(found)return found}return""}if(typeof value!=="object")return"";for(const[key,item]of Object.entries(value)){if(keys.has(key.toLowerCase().replace(/[^a-z]/g,""))&&typeof item==="string"&&item.trim())return item.trim().toLowerCase()}for(const item of Object.values(value)){const found=visit(item,depth+1);if(found)return found}return""};for(const value of values){const found=visit(value);if(found)return found}return""}
export function parseRunningHubWorkflowPrompt(result:any){const raw=result?.data?.prompt??result?.prompt??result?.data;if(raw&&typeof raw==="object")return raw;if(typeof raw!=="string")throw new Error("RunningHub workflow inspection returned no API-format prompt.");try{return JSON.parse(raw)}catch{throw new Error("RunningHub workflow inspection returned invalid API-format JSON.")}}

const inputSummary=(node:any)=>Object.fromEntries(Object.entries(node?.inputs||{}).map(([key,value])=>[key,Array.isArray(value)?`LINK:${value[0]}:${value[1]}`:value]));
const isLinkTuple=(value:any)=>Array.isArray(value)&&value.length>1&&["string","number"].includes(typeof value[0])&&["string","number"].includes(typeof value[1]);
const linkNode=(value:any)=>isLinkTuple(value)?String(value[0]):"";
const containsLink=(value:any,nodeId:string):boolean=>isLinkTuple(value)?String(value[0])===nodeId:Array.isArray(value)?value.some(item=>containsLink(item,nodeId)):Boolean(value&&typeof value==="object"&&Object.values(value).some(item=>containsLink(item,nodeId)));
const collectLinkNodes=(value:any,found:string[]=[]):string[]=>{if(isLinkTuple(value))found.push(String(value[0]));else if(Array.isArray(value))value.forEach(item=>collectLinkNodes(item,found));else if(value&&typeof value==="object")Object.values(value).forEach(item=>collectLinkNodes(item,found));return found};
const normalizedInputName=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,"");
const namedReferenceValues=(value:any,name:string,found:any[]=[]):any[]=>{if(!value||typeof value!=="object")return found;const normalizedName=normalizedInputName(name);for(const[key,item]of Object.entries(value)){if(normalizedInputName(key).includes(normalizedName))found.push(item);namedReferenceValues(item,name,found)}return found};
// RunningHub preserves dynamic ComfyUI inputs in more than one equivalent API-JSON
// shape: a named object, a flattened key, or an ordered ref_images collection.
// Resolve those serializations without changing the immutable workflow graph.
const referenceLinkNode=(inputs:any,name="ref_image_0")=>{const named=[...new Set(namedReferenceValues(inputs,name).flatMap(value=>collectLinkNodes(value)))];if(named.length===1)return named[0];const groups=Object.entries(inputs||{}).filter(([key])=>normalizedInputName(key).includes("refimages")).map(([,value])=>value),groupLinks=[...new Set(groups.flatMap(value=>collectLinkNodes(value)))];return groupLinks.length===1?groupLinks[0]:""};
const has=(graph:any,nodeId:string)=>Boolean(graph?.[nodeId]);
const className=(graph:any,nodeId:string)=>String(graph?.[nodeId]?.class_type||"");
const field=(graph:any,nodeId:string,name:string)=>Object.prototype.hasOwnProperty.call(graph?.[nodeId]?.inputs||{},name);

export function verifyRunningHubH3Graph(graph:any){
 const issues:string[]=[],low=graph?.["7"]?.inputs||{},high=graph?.["14"]?.inputs||{},reconcile=graph?.["15"]?.inputs||{},output=graph?.["21"]?.inputs||{};
 for(const id of["6","7","13","14","15","20","21","27","28","29","30","35"])if(!has(graph,id))issues.push(`Expected Node ${id}, but the node is missing.`);
 if(has(graph,"6")&&className(graph,"6")!=="LoadImage")issues.push(`Expected Node 6 LoadImage for first_frame, received ${className(graph,"6")||"no class_type"}.`);
 if(has(graph,"35")&&className(graph,"35")!=="LoadImage")issues.push(`Expected Node 35 LoadImage for ref_image_0, received ${className(graph,"35")||"no class_type"}.`);
 if(has(graph,"29")&&!/resolution/i.test(className(graph,"29")))issues.push(`Expected Node 29 ResolutionSelector, received ${className(graph,"29")||"no class_type"}.`);
 if(has(graph,"21")&&className(graph,"21")!=="VHS_VideoCombine")issues.push(`Expected Node 21 VHS_VideoCombine, received ${className(graph,"21")||"no class_type"}.`);
 for(const[nodeId,inputName]of[["6","image"],["35","image"],["28","prompt"],["27","value"],["29","aspect_ratio"],["29","megapixels"]])if(has(graph,nodeId)&&!field(graph,nodeId,inputName))issues.push(`Expected editable input Node ${nodeId}.${inputName}, but it is unavailable.`);
 if(has(graph,"7")&&String(low.task_type)!=="Hybrid")issues.push(`Expected Node 7 LOW task_type Hybrid, received ${String(low.task_type||"missing")}.`);
 if(has(graph,"7")&&linkNode(low.prompt)!=="28")issues.push(`Expected Node 7.prompt <- Node 28, but the edge is ${linkNode(low.prompt)||"missing"}.`);
 if(has(graph,"7")&&linkNode(low.width)!=="29")issues.push(`Expected Node 7.width <- Node 29.width, but the edge is ${linkNode(low.width)||"missing"}.`);
 if(has(graph,"7")&&linkNode(low.height)!=="29")issues.push(`Expected Node 7.height <- Node 29.height, but the edge is ${linkNode(low.height)||"missing"}.`);
 if(has(graph,"7")&&linkNode(low.length)!=="30")issues.push(`Expected Node 7.length <- Node 30, but the edge is ${linkNode(low.length)||"missing"}.`);
 if(has(graph,"7")&&linkNode(low.first_frame)!=="6")issues.push(`Expected Node 7.first_frame <- Node 6, but the edge is ${linkNode(low.first_frame)||"missing"}.`);
 if(has(graph,"7")&&referenceLinkNode(low)!=="35")issues.push(`Expected Node 7.ref_image_0 <- Node 35, but the edge is ${referenceLinkNode(low)||"missing"}.`);
 if(has(graph,"30")&&!containsLink(graph["30"].inputs,"27"))issues.push("Expected Node 30 derived frame-count logic to consume Node 27 duration, but that edge changed.");
 if(has(graph,"13")&&!/(latent|upscal|seedvr)/i.test(`${className(graph,"13")} ${graph["13"]?._meta?.title||""}`))issues.push(`Expected Node 13 learned latent upscale, received ${className(graph,"13")||"no class_type"}.`);
 if(has(graph,"14")&&String(high.task_type)!=="Ref2VA")issues.push(`Expected Node 14 HIGH task_type Ref2VA, received ${String(high.task_type||"missing")}.`);
 if(has(graph,"14")&&linkNode(high.prompt)!=="28")issues.push(`Expected Node 14.prompt <- Node 28, but the edge is ${linkNode(high.prompt)||"missing"}.`);
 if(has(graph,"14")&&linkNode(high.width)!=="13")issues.push(`Expected Node 14.width <- Node 13.width, but the edge is ${linkNode(high.width)||"missing"}.`);
 if(has(graph,"14")&&linkNode(high.height)!=="13")issues.push(`Expected Node 14.height <- Node 13.height, but the edge is ${linkNode(high.height)||"missing"}.`);
 if(has(graph,"14")&&linkNode(high.length)!=="30")issues.push(`Expected Node 14.length <- Node 30, but the edge is ${linkNode(high.length)||"missing"}.`);
 if(has(graph,"14")&&referenceLinkNode(high)!=="6")issues.push(`Expected Node 14.ref_image_0 <- Node 6, but the edge is ${referenceLinkNode(high)||"missing"}.`);
 if(has(graph,"15")&&!containsLink(reconcile,"13"))issues.push("Expected Node 15 HIGH latent reconcile to consume Node 13 learned latent, but that edge changed.");
 if(has(graph,"15")&&!containsLink(reconcile,"14"))issues.push("Expected Node 15 HIGH latent reconcile to consume Node 14 conditioning, but that edge changed.");
 if(has(graph,"21")&&output.save_output!==true)issues.push(`Expected Node 21.save_output = true, received ${String(output.save_output)}.`);
 if(has(graph,"21")&&!containsLink(output,"20"))issues.push("Expected Node 21 final video input from Node 20, but that edge changed.");
 const fingerprint=runningHubWorkflowFingerprint(graph),verified=issues.length===0,mapping={...RUNNINGHUB_H3_LOCKED_MAPPING,workflowContractVerified:verified,workflowGraphFingerprint:fingerprint};return{mapping,issues,workflowContractVerified:verified,workflowContractVersion:RUNNINGHUB_H3_CONTRACT_VERSION,workflowGraphFingerprint:fingerprint};
}
export function inspectRunningHubH3Graph(graph:any){const nodes=Object.fromEntries(["6","7","13","14","15","20","21","27","28","29","30","35"].map(nodeId=>[nodeId,graph?.[nodeId]?{classType:className(graph,nodeId),title:graph[nodeId]._meta?.title||"",inputs:inputSummary(graph[nodeId])}:null])),outputCandidates=Object.entries(graph||{}).filter(([,node]:any)=>/(save|video|combine|mux|output)/i.test(`${node?.class_type||""} ${node?._meta?.title||""}`)).map(([nodeId,node]:any)=>({nodeId,classType:node.class_type||"",title:node._meta?.title||"",inputs:inputSummary(node)}));return{workflowId:RUNNINGHUB_H3_WORKFLOW_ID,nodes,outputCandidates,verification:verifyRunningHubH3Graph(graph)}}

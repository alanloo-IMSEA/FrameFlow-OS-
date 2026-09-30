import{loadIntegration,saveIntegration}from"../integrations/_lib";
import{RUNNINGHUB_BASE_URL}from"./service";
import{normalizeRunningHubH3Mapping,parseRunningHubWorkflowPrompt,RUNNINGHUB_H3_WORKFLOW_ID,RUNNINGHUB_WORKFLOW_JSON_PATH,runningHubH3MappingIssues,verifyRunningHubH3Graph}from"./video-contract";

export async function verifyAndStoreRunningHubH3Contract(db:any,env:any){
 const saved=await loadIntegration(db,env,"runninghub");if(!saved?.secret)throw Object.assign(new Error("Connect RunningHub in Tier 0 System Connections before generating a Reel."),{status:409,code:"RUNNINGHUB_NOT_CONNECTED"});
 const response=await fetch(`${RUNNINGHUB_BASE_URL}${RUNNINGHUB_WORKFLOW_JSON_PATH}`,{method:"POST",headers:{authorization:`Bearer ${saved.secret}`,"content-type":"application/json"},body:JSON.stringify({apiKey:saved.secret,workflowId:RUNNINGHUB_H3_WORKFLOW_ID})}),result:any=await response.json().catch(()=>({}));
 if(!response.ok||Number(result?.code??0)!==0)throw Object.assign(new Error(result?.msg||`RunningHub workflow contract fetch returned HTTP ${response.status}.`),{status:502,code:"RUNNINGHUB_CONTRACT_FETCH_FAILED"});
 const graph=parseRunningHubWorkflowPrompt(result),verification=verifyRunningHubH3Graph(graph),config={...(saved.config||{}),h3VideoWorkflowId:RUNNINGHUB_H3_WORKFLOW_ID,h3VideoMapping:verification.mapping,h3WorkflowContract:{verified:verification.workflowContractVerified,version:verification.workflowContractVersion,fingerprint:verification.workflowGraphFingerprint,issues:verification.issues,verifiedAt:new Date().toISOString()}};
 await saveIntegration(db,env,"runninghub",saved.secret,config,saved.status||"Connected");
 if(verification.issues.length)throw Object.assign(new Error(`RunningHub workflow contract changed: ${verification.issues.join(" ")}`),{status:409,code:"RUNNINGHUB_CONTRACT_MISMATCH",issues:verification.issues,fingerprint:verification.workflowGraphFingerprint});
 return{saved:{...saved,config},graph,verification};
}

export async function ensureRunningHubH3Contract(db:any,env:any){const saved=await loadIntegration(db,env,"runninghub");if(!saved?.secret)throw Object.assign(new Error("Connect RunningHub in Tier 0 System Connections before generating a Reel."),{status:409,code:"RUNNINGHUB_NOT_CONNECTED"});const mapping=normalizeRunningHubH3Mapping(saved.config?.h3VideoMapping);if(!runningHubH3MappingIssues(mapping).length)return{saved,mapping,verifiedNow:false};const verified=await verifyAndStoreRunningHubH3Contract(db,env);return{saved:verified.saved,mapping:verified.verification.mapping,verifiedNow:true}}

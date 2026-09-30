import{ensureBusinessSchema}from"../projects/business-schema";
import{loadIntegration}from"../integrations/_lib";
import{assignments,recoverInterruptedAgentControls,relayAuthorized,resumeAgent,runProject,sendTelegram,stopAgent}from"./service";
import{failLatestRunningJob}from"../orchestrator/service";
import{notifyGenerationIncident}from"../orchestrator/generation-incidents";
import{runProductionJobScheduler}from"../production-jobs/scheduler";

const json=(value:any,status=200)=>Response.json(value,{status});
async function runtime(){const{env}=await import("cloudflare:workers");return env as any}
async function managementContext(req:Request,db:any){const email=(req.headers.get("oai-authenticated-user-email")||"").toLowerCase(),member=await db.prepare("SELECT tier FROM members WHERE email=?").bind(email).first<any>();return{email,tier:Number(member?.tier??99),allowed:Number(member?.tier??99)<=1}}
async function assignedToProject(db:any,projectId:string,email:string,tier:number){if(tier===0)return true;return Boolean(await db.prepare("SELECT 1 AS ok FROM project_members WHERE project_id=? AND member_email=?").bind(projectId,email).first())}

export async function GET(req:Request){const env=await runtime(),db=env.DB;await ensureBusinessSchema(db);const manager=await managementContext(req,db);if(!manager.allowed)return json({error:"Tier 0–1 Management access required"},403);await recoverInterruptedAgentControls(db);const production=await runProductionJobScheduler(db,env,new URL(req.url).origin);const rows=await assignments(db);if(manager.tier===0)return json({assignments:rows,production});const visible=[];for(const row of rows)if(await assignedToProject(db,row.id,manager.email,manager.tier))visible.push(row);return json({assignments:visible,production})}
export async function POST(req:Request){
 const env=await runtime(),db=env.DB;
 await ensureBusinessSchema(db);
 const manager=await managementContext(req,db);
 if(manager.allowed){const body=await req.json() as any;if(!body.projectId||!["run","stop","resume"].includes(body.action))return json({error:"Choose an Agent action and assigned Project."},400);if(!await assignedToProject(db,String(body.projectId),manager.email,manager.tier))return json({error:"Project access denied"},403);try{if(body.action==="stop")return json(await stopAgent(db,env,String(body.projectId)));if(body.action==="resume")return json(await resumeAgent(db,env,String(body.projectId)));return json(await runProject(db,env,String(body.projectId),true))}catch(error:any){const message=String(error.message||error),now=new Date().toISOString();await failLatestRunningJob(db,String(body.projectId),"AGENT_TASK","agent:milla-im",message);const failed=await db.prepare("SELECT COALESCE((SELECT c.id FROM orchestrator_jobs c WHERE c.parent_job_id=p.id AND c.job_type='LLM_TASK' AND c.status='FAILED' ORDER BY c.updated_at DESC LIMIT 1),p.id) AS id FROM orchestrator_jobs p WHERE p.project_id=? AND p.job_type='AGENT_TASK' AND p.status='FAILED' ORDER BY p.updated_at DESC LIMIT 1").bind(String(body.projectId)).first<any>();if(failed?.id)await notifyGenerationIncident(db,env,String(failed.id),message);await db.prepare("UPDATE agent_project_controls SET active=0,status='Needs Attention · Generation stopped',updated_at=?,last_error=? WHERE project_id=? AND agent_id='agent:milla-im'").bind(now,message,String(body.projectId)).run();return json({error:message,code:error.code},Number(error.status||500))}}
 if(!await relayAuthorized(req,db,env))return json({error:"Relay authorization failed"},401);
 const update=await req.json() as any,message=update?.message||update?.edited_message,chatId=String(message?.chat?.id||""),text=String(message?.text||"").trim(),telegram=await loadIntegration(db,env,"telegram"),allowedChat=String(telegram?.config?.chatId||"8009020714");if(chatId!==allowedChat)return json({ok:true,ignored:true});
 const match=text.match(/(?:\/run|\/work|开始|start)\s+(PRJ-\d+)/i);if(match){try{await runProject(db,env,match[1].toUpperCase(),true)}catch(error:any){await sendTelegram(db,env,`Agent could not start the task: ${error.message}`)}return json({ok:true})}
 const available=(await assignments(db)).filter((x:any)=>!String(x.autopilotStatus).includes("Scope Completed")),list=available.length?available.map((x:any)=>`${x.id} · ${x.client}\nReady: ${x.phaseLabel}`).join("\n\n"):"No assigned editable Social Project is ready.";
 await sendTelegram(db,env,`FrameFlow Agent Runner\n\n${list}\n\nTo start one Project, send:\n/run PRJ-0003\n\nAgent Autopilot owns Social strategy, Batch Ideas, image prompts and Reel Video Prompts. It follows management Retake feedback, keeps approved references attached and cannot approve its own work.`);return json({ok:true});
}

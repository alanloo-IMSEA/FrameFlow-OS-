import{requireMemoryManagement}from"../memory/management";
import{LOG_MEMORY_BOUNDARY}from"../memory/policy";

const parse=(value:any)=>{try{return JSON.parse(value||"{}")}catch{return value}};
export async function GET(req:Request){
 const{env}=await import("cloudflare:workers"),db=env.DB;
 try{
  const actor=await requireMemoryManagement(req,db),url=new URL(req.url),projectId=String(url.searchParams.get("projectId")||"").trim(),bind=(statement:any)=>projectId?statement.bind(projectId):statement,[audit,production,runs,jobs,attempts,grants,drive]=await Promise.all([
   bind(db.prepare(`SELECT id,project_id AS projectId,event_type AS eventType,actor_email AS actor,event_data AS data,created_at AS createdAt FROM audit_log${projectId?" WHERE project_id=?":""} ORDER BY created_at DESC LIMIT 5000`)).all(),
   bind(db.prepare(`SELECT id,project_id AS projectId,event_type AS eventType,actor_email AS actor,event_data AS data,created_at AS createdAt FROM production_events${projectId?" WHERE project_id=?":""} ORDER BY created_at DESC LIMIT 5000`)).all(),
   bind(db.prepare(`SELECT id,project_id AS projectId,'agent_run' AS eventType,agent_id AS actor,status AS data,started_at AS createdAt FROM agent_runs${projectId?" WHERE project_id=?":""} ORDER BY started_at DESC LIMIT 5000`)).all(),
   bind(db.prepare(`SELECT event.id,jobs.project_id AS projectId,event.event_type AS eventType,event.actor,event.event_data AS data,event.created_at AS createdAt FROM orchestrator_job_events event JOIN orchestrator_jobs jobs ON jobs.id=event.job_id${projectId?" WHERE jobs.project_id=?":""} ORDER BY event.created_at DESC LIMIT 5000`)).all(),
   bind(db.prepare(`SELECT id,project_id AS projectId,'publishing_attempt' AS eventType,platform AS actor,json_object('status',status,'errorCode',error_code,'errorMessage',error_message,'attemptNumber',attempt_number) AS data,started_at AS createdAt FROM publishing_attempts${projectId?" WHERE project_id=?":""} ORDER BY started_at DESC LIMIT 5000`)).all(),
   bind(db.prepare(`SELECT event.id,grant.project_id AS projectId,event.event_type AS eventType,grant.agent_id AS actor,event.event_data AS data,event.created_at AS createdAt FROM agent_file_grant_events event JOIN agent_file_grants grant ON grant.id=event.grant_id${projectId?" WHERE grant.project_id=?":""} ORDER BY event.created_at DESC LIMIT 5000`)).all(),
   bind(db.prepare(`SELECT id,project_id AS projectId,event_type AS eventType,actor_email AS actor,json_object('status',status,'attempts',attempts,'lastError',last_error) AS data,created_at AS createdAt FROM drive_sync_queue${projectId?" WHERE project_id=?":""} ORDER BY created_at DESC LIMIT 5000`)).all(),
  ]),streams=[["audit_log",audit],["production_events",production],["agent_runs",runs],["orchestrator_job_events",jobs],["publishing_attempts",attempts],["agent_file_grant_events",grants],["drive_sync_queue",drive]],lines:any[]=[{schema:"frameflow.production-activity-history.v1",exportedAt:new Date().toISOString(),exportedBy:actor.email,projectId:projectId||null,classification:"LOGS_OBSERVABILITY_ONLY",memoryBoundary:LOG_MEMORY_BOUNDARY,mayInfluenceGeneration:false}];
  for(const[logType,result]of streams as any[])for(const row of result.results as any[])lines.push({recordType:"observability_event",logType,...row,data:parse(row.data)});
  return new Response(lines.map(row=>JSON.stringify(row)).join("\n"),{headers:{"content-type":"application/x-ndjson; charset=utf-8","content-disposition":`attachment; filename="FrameFlow_Activity_History_${new Date().toISOString().slice(0,10)}.jsonl"`,"cache-control":"no-store"}});
 }catch(error:any){return Response.json({error:error?.message||"Activity history export failed."},{status:Number(error?.status)||500,headers:{"cache-control":"no-store"}})}
}

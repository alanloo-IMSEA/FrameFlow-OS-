export type SocialBatchMode="OVERLAP"|"SEQUENTIAL";

const parse=(value:any,fallback:any={})=>{try{return typeof value==="string"?JSON.parse(value||""):value||fallback}catch{return fallback}};
const stamp=()=>new Date().toISOString();

export function normalizeSocialBatchMode(config:any):SocialBatchMode{
 const value=String(parse(config,{}).batchOverlapMode||"OVERLAP").toUpperCase();
 return value==="SEQUENTIAL"?"SEQUENTIAL":"OVERLAP";
}

export function allowsOverlappingBatches(config:any){return normalizeSocialBatchMode(config)==="OVERLAP"}

export function previousBatchBlocksPlanning(config:any,previousBatch:any){
 return !allowsOverlappingBatches(config)&&Boolean(previousBatch)&&String(previousBatch.status)!=="Completed";
}

export async function ensureRequestedSocialBatchPolicies(db:any){
 const requested:Record<string,SocialBatchMode>={"PRJ-0001":"OVERLAP","PRJ-0002":"OVERLAP"};
 for(const [projectId,mode] of Object.entries(requested)){
  const row=await db.prepare("SELECT project_config AS projectConfig FROM projects WHERE id=?").bind(projectId).first<any>();
  if(!row)continue;const config=parse(row.projectConfig,{});if(normalizeSocialBatchMode(config)===mode&&config.batchOverlapMode===mode)continue;
  config.batchOverlapMode=mode;const now=stamp();await db.batch([
   db.prepare("UPDATE projects SET project_config=? WHERE id=?").bind(JSON.stringify(config),projectId),
   db.prepare("INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)").bind(projectId,"social_batch_policy_configured","system:lifecycle",JSON.stringify({batchOverlapMode:mode}),now),
  ]);
 }
}

export async function restorePrematureSequentialPlanning(db:any){
 const rows=await db.prepare("SELECT next.id AS nextBatchId,next.project_id AS projectId,next.batch_number AS nextBatchNumber,prior.id AS priorBatchId,prior.batch_number AS priorBatchNumber,prior.status AS priorStatus FROM production_batches next JOIN projects p ON p.id=next.project_id JOIN production_batches prior ON prior.project_id=next.project_id AND prior.batch_number=next.batch_number-1 WHERE next.status='Planning' AND prior.status!='Completed' AND json_extract(p.project_config,'$.batchOverlapMode')='SEQUENTIAL'").all(),restored:string[]=[],now=stamp();
 for(const row of rows.results as any[]){
  const marker=await db.prepare("SELECT 1 AS found FROM audit_log WHERE project_id=? AND event_type='sequential_batch_planning_rolled_back' AND json_extract(event_data,'$.nextBatchId')=? LIMIT 1").bind(row.projectId,row.nextBatchId).first<any>();if(marker)continue;
  const current=await db.prepare("SELECT phase_key AS phaseKey,status,data,version,opened_at AS openedAt,approved_at AS approvedAt FROM phase_records WHERE project_id=? AND phase_key IN ('batch-ideas','content-production','reel-video-production','publishing','batch-learning') ORDER BY position").bind(row.projectId).all();
  const snapshots=await db.prepare("SELECT phase_key AS phaseKey,approved_content AS content,version,approved_at AS approvedAt FROM approved_phase_snapshots WHERE project_id=? AND phase_key IN ('batch-ideas','content-production','reel-video-production') AND id IN (SELECT MAX(id) FROM approved_phase_snapshots WHERE project_id=? AND phase_key IN ('batch-ideas','content-production','reel-video-production') GROUP BY phase_key)").bind(row.projectId,row.projectId).all(),byPhase=new Map((snapshots.results as any[]).map(item=>[item.phaseKey,item]));
  if(!byPhase.has("batch-ideas")||!byPhase.has("content-production")||!byPhase.has("reel-video-production"))continue;
  const statements:any[]=[];for(const phaseKey of["batch-ideas","content-production","reel-video-production"]){const snapshot:any=byPhase.get(phaseKey);statements.push(db.prepare("UPDATE phase_records SET data=?,status='Approved',version=?,opened_at=COALESCE(opened_at,?),approved_at=?,updated_at=? WHERE project_id=? AND phase_key=?").bind(snapshot.content,Number(snapshot.version||1),snapshot.approvedAt||now,snapshot.approvedAt||now,now,row.projectId,phaseKey))}
  statements.push(
   db.prepare("UPDATE phase_records SET status='In Progress',opened_at=COALESCE(opened_at,?),approved_at=NULL,updated_at=? WHERE project_id=? AND phase_key='publishing'").bind(now,now,row.projectId),
   db.prepare("UPDATE phase_records SET status='Locked',opened_at=NULL,approved_at=NULL,updated_at=? WHERE project_id=? AND phase_key='batch-learning'").bind(now,row.projectId),
   db.prepare("UPDATE production_batches SET status='Active',gate_status='Approved' WHERE id=?").bind(row.priorBatchId),
   db.prepare("UPDATE production_batches SET status='Locked',gate_status='Locked' WHERE id=?").bind(row.nextBatchId),
   db.prepare("UPDATE projects SET project_status='Active',phase_status='In Progress',stage='Publishing · In Progress',assignment_stage='Publishing',assignment_status='Ongoing',approval_title=NULL,progress=90 WHERE id=?").bind(row.projectId),
   db.prepare("UPDATE agent_project_controls SET active=0,stop_phase_key='publishing',status='Scope Completed · Awaiting current Batch publishing',last_phase_key='publishing',last_error=NULL,updated_at=? WHERE project_id=?").bind(now,row.projectId),
   db.prepare("INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)").bind(row.projectId,"sequential_batch_planning_rolled_back","system:lifecycle",JSON.stringify({priorBatchId:Number(row.priorBatchId),priorBatchNumber:Number(row.priorBatchNumber),priorStatus:row.priorStatus,nextBatchId:Number(row.nextBatchId),nextBatchNumber:Number(row.nextBatchNumber),preservedPrematureDrafts:current.results,rule:"Next Batch stays locked until the current Batch is fully published."}),now),
  );
  await db.batch(statements);restored.push(String(row.projectId));
 }
 return restored;
}

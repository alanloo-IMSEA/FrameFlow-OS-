import{dispatchSystemJob}from"../orchestrator/service";
import{cleanupTemporaryPublishingAssets,deliverPendingPublishingNotifications,rebuildLearning,syncProfilePerformance,syncRecordPerformance}from"./service";
import{markMissedPublishingSchedules}from"./missed-schedules";
import{runProductionJobScheduler}from"../production-jobs/scheduler";

export async function runPublishingScheduler(db:any,env:any,origin:string){
 const now=new Date().toISOString();
 const production=await runProductionJobScheduler(db,env,origin);
 await db.batch([
  db.prepare("UPDATE publishing_records SET status='READY',error_code=NULL,error_message=NULL,retry_count=0,requires_human_action=0,updated_at=? WHERE scheduled_at IS NULL AND (status='NEEDS_ATTENTION' OR error_code='SCHEDULE_REQUIRED')").bind(now),
  db.prepare("UPDATE orchestrator_jobs SET status='QUEUED',attempt_count=0,last_error=NULL,updated_at=? WHERE job_type='PUBLISH_JOB' AND scheduled_for IS NULL AND (status IN ('FAILED','RETRY_PENDING') OR last_error LIKE 'SCHEDULE_REQUIRED:%')").bind(now),
 db.prepare("UPDATE publishing_records SET status=CASE WHEN scheduled_at>? THEN 'SCHEDULED' ELSE 'READY' END,error_code=NULL,error_message=NULL,retry_count=0,requires_human_action=0,updated_at=? WHERE error_code IN ('MEDIA_GATEWAY_NOT_CONFIGURED','MEDIA_GATEWAY_FAILED')").bind(now,now),
 db.prepare("UPDATE orchestrator_jobs SET status=CASE WHEN scheduled_for>? THEN 'SCHEDULED' ELSE 'QUEUED' END,attempt_count=0,last_error=NULL,updated_at=? WHERE job_type='PUBLISH_JOB' AND scheduled_for IS NOT NULL AND last_error LIKE 'MEDIA_GATEWAY_%'").bind(now,now),
  db.prepare("UPDATE publishing_records SET status='MANUAL_REQUIRED',error_code='LIVE_PUBLISHING_NOT_IMPLEMENTED',error_message='Live '||platform||' automatic publishing is not implemented. Publish manually and save the live link.',requires_human_action=1,updated_at=? WHERE platform IN ('Facebook Page','TikTok') AND status='NEEDS_ATTENTION' AND error_code='CONNECTOR_NOT_SUPPORTED'").bind(now),
  db.prepare("UPDATE orchestrator_jobs SET status='BLOCKED_CAPABILITY',last_error='Live publishing is not implemented for this provider. Publish manually and save the live link.',updated_at=? WHERE job_type='PUBLISH_JOB' AND status='WAITING_PROVIDER' AND id IN (SELECT job_id FROM publishing_records WHERE platform IN ('Facebook Page','TikTok') AND status='MANUAL_REQUIRED' AND error_code='LIVE_PUBLISHING_NOT_IMPLEMENTED')").bind(now),
 ]);
 await markMissedPublishingSchedules(db);
 await cleanupTemporaryPublishingAssets(db,env);
 const rows=await db.prepare("SELECT id FROM orchestrator_jobs WHERE job_type='PUBLISH_JOB' AND status IN ('QUEUED','SCHEDULED','RETRY_PENDING') AND scheduled_for IS NOT NULL AND scheduled_for<=? ORDER BY scheduled_for LIMIT 20").bind(now).all(),results=[];
 for(const row of rows.results as any[])results.push(await dispatchSystemJob(db,env,String(row.id),origin));
 const notifications=await deliverPendingPublishingNotifications(db,env);
 return{...production,checkedAt:now,processed:results.length,notifications:notifications.length,results:results.map((job:any)=>({id:job.id,status:job.status,lastError:job.lastError}))};
}

export async function runAutomaticPerformanceSync(db:any,env:any){
 const startedAt=new Date().toISOString(),projectRows=await db.prepare("SELECT DISTINCT project_id AS projectId FROM project_social_connections WHERE status='Connected' AND platform IN ('Instagram','Threads') UNION SELECT DISTINCT project_id AS projectId FROM publishing_records WHERE status='PUBLISHED' AND platform IN ('Instagram','Threads')").all(),projects=[] as any[];
 for(const projectRow of projectRows.results as any[]){const projectId=String(projectRow.projectId||"");if(!projectId)continue;let recordsSynced=0,profilesSynced=0,failures=0;
  const records=await db.prepare("SELECT * FROM publishing_records WHERE project_id=? AND status='PUBLISHED' AND provider_media_id IS NOT NULL ORDER BY published_at DESC LIMIT 100").bind(projectId).all();
  for(const record of records.results as any[])try{await syncRecordPerformance(db,env,record);recordsSynced++}catch(error:any){failures++;await db.prepare("UPDATE publishing_records SET performance_sync_status='NEEDS_ATTENTION',error_message=?,updated_at=? WHERE id=?").bind(String(error?.message||error),new Date().toISOString(),record.id).run()}
  const connections=await db.prepare("SELECT connection_id AS socialConnectionId,platform FROM project_social_connections WHERE project_id=? AND status='Connected' AND platform IN ('Instagram','Threads')").bind(projectId).all();
  for(const connection of connections.results as any[])try{await syncProfilePerformance(db,env,projectId,String(connection.platform),String(connection.socialConnectionId));profilesSynced++}catch{failures++}
  const batchIds=[...new Set((records.results as any[]).map(record=>Number(record.batch_id||0)).filter(Boolean))],learningCandidates=[];for(const batchId of batchIds)learningCandidates.push(await rebuildLearning(db,projectId,batchId));
  const completedAt=new Date().toISOString(),summary={recordsSynced,profilesSynced,failures,learningCandidates:learningCandidates.filter(item=>item.saved).length,startedAt,completedAt,cadenceMinutes:30};await db.prepare("INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)").bind(projectId,"performance_auto_synced","system:scheduler",JSON.stringify(summary),completedAt).run();projects.push({projectId,...summary});
 }
 return{startedAt,completedAt:new Date().toISOString(),projects};
}

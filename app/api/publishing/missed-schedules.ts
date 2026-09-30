export const MISSED_SCHEDULE_GRACE_MINUTES=15;

export async function markMissedPublishingSchedules(db:any,projectId?:string){
 const now=new Date().toISOString(),missedBefore=new Date(Date.now()-MISSED_SCHEDULE_GRACE_MINUTES*60_000).toISOString(),projectClause=projectId?" AND project_id=?":"",values=projectId?[missedBefore,projectId]:[missedBefore],message="Scheduled time passed. Choose a new future time or confirm Publish now.";
 const jobs=await db.prepare(`SELECT id FROM orchestrator_jobs WHERE job_type='PUBLISH_JOB' AND status IN ('QUEUED','SCHEDULED','RETRY_PENDING') AND scheduled_for IS NOT NULL AND scheduled_for<?${projectClause}`).bind(...values).all(),ids=(jobs.results as any[]).map(row=>String(row.id));
 if(!ids.length)return{count:0,missedBefore};
 const marks=ids.map(()=>"?").join(","),updatedAt=new Date().toISOString();
 await db.batch([
  db.prepare(`UPDATE orchestrator_jobs SET status='WAITING_PROVIDER',last_error=?,updated_at=? WHERE id IN (${marks})`).bind(`MISSED_SCHEDULE: ${message}`,updatedAt,...ids),
  db.prepare(`UPDATE publishing_records SET status='NEEDS_ATTENTION',error_code='MISSED_SCHEDULE',error_message=?,requires_human_action=1,updated_at=? WHERE job_id IN (${marks}) AND status NOT IN ('PUBLISHED','MANUAL_EXCEPTION','CANCELLED') AND platform IN ('Instagram','Threads')`).bind(message,updatedAt,...ids),
 ]);
 return{count:ids.length,missedBefore};
}

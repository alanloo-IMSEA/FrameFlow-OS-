import{dispatchSystemJob,queueApprovedImageUpscales,updateSystemJob}from"../orchestrator/service";
import{acceptedImageItemKeys}from"../projects/image-review";
import{socialBatchAssetKeys}from"../../social-batch-assets";
import{notifyGenerationIncident}from"../orchestrator/generation-incidents";

/**
 * Provider production is intentionally independent from AutoPost.
 * This runner owns only image, video, and upscale jobs; it never reads,
 * creates, dispatches, or repairs social publishing records.
 */
export async function runProductionJobScheduler(db:any,env:any,origin:string){
 const now=new Date().toISOString();
 const partialReviews=await db.prepare("SELECT project_id AS projectId,data FROM phase_records WHERE phase_key='content-production' AND status IN ('Retake','In Progress','Reviewing')").all();
 for(const phase of partialReviews.results as any[]){let data:any={};try{data=JSON.parse(phase.data||"{}")}catch{}const batch=await db.prepare("SELECT id FROM production_batches WHERE project_id=? ORDER BY CASE WHEN status='Planning' THEN 0 WHEN status='Active' THEN 1 ELSE 2 END,batch_number DESC LIMIT 1").bind(String(phase.projectId)).first<any>(),acceptedKeys=socialBatchAssetKeys(Number(batch?.id)||null,acceptedImageItemKeys(data._acceptedReviewFields));if(acceptedKeys.length)await queueApprovedImageUpscales(db,null,String(phase.projectId),"system:production-scheduler",acceptedKeys,origin)}
 const upscaleRows=await db.prepare("SELECT id FROM orchestrator_jobs WHERE job_type='IMAGE_UPSCALE' AND status IN ('QUEUED','RETRY_PENDING','WAITING_PROVIDER') ORDER BY created_at LIMIT 20").all(),upscaleResults=[];
 for(const row of upscaleRows.results as any[])upscaleResults.push(await dispatchSystemJob(db,env,String(row.id),origin));
 const staleBefore=new Date(Date.now()-5*60_000).toISOString(),staleImages=await db.prepare("SELECT id,project_id AS projectId,parent_job_id AS parentJobId,attempt_count AS attemptCount,max_attempts AS maxAttempts FROM orchestrator_jobs WHERE job_type='IMAGE_GENERATION' AND status='RUNNING' AND updated_at<? ORDER BY updated_at LIMIT 20").bind(staleBefore).all();
 for(const job of staleImages.results as any[]){const error="IMAGE_GENERATION_EXECUTION_WINDOW_EXCEEDED · automatic retry disabled";await updateSystemJob(db,String(job.id),"FAILED","system:production-scheduler",{error});await notifyGenerationIncident(db,env,String(job.id),error);if(job.parentJobId)await updateSystemJob(db,String(job.parentJobId),"WAITING_PROVIDER","system:production-scheduler",{error:null})}
 const imageRows=await db.prepare("SELECT id,parent_job_id AS parentJobId FROM orchestrator_jobs WHERE job_type='IMAGE_GENERATION' AND status IN ('QUEUED','RETRY_PENDING','WAITING_PROVIDER') AND (scheduled_for IS NULL OR scheduled_for<=?) ORDER BY COALESCE(scheduled_for,created_at),created_at LIMIT 1").bind(now).all(),imageResults=[];
 for(const row of imageRows.results as any[]){const result=await dispatchSystemJob(db,env,String(row.id),origin);imageResults.push(result);if(row.parentJobId){const{reconcileContentImageGeneration}=await import("../agent-runner/service");await reconcileContentImageGeneration(db,env,String(row.parentJobId))}}
 const waitingParents=await db.prepare("SELECT DISTINCT p.id FROM orchestrator_jobs p JOIN orchestrator_jobs c ON c.parent_job_id=p.id AND c.job_type='IMAGE_GENERATION' WHERE p.job_type='AGENT_TASK' AND p.status IN ('RUNNING','WAITING_PROVIDER') LIMIT 20").all();
 if(waitingParents.results.length){const{reconcileContentImageGeneration}=await import("../agent-runner/service");for(const parent of waitingParents.results as any[])await reconcileContentImageGeneration(db,env,String(parent.id))}
 const videoRows=await db.prepare("SELECT id,parent_job_id AS parentJobId FROM orchestrator_jobs WHERE job_type='VIDEO_GENERATION' AND status IN ('QUEUED','RETRY_PENDING','WAITING_PROVIDER') AND (scheduled_for IS NULL OR scheduled_for<=?) ORDER BY COALESCE(scheduled_for,created_at),created_at LIMIT 1").bind(now).all(),videoResults=[];
 for(const row of videoRows.results as any[]){const result=await dispatchSystemJob(db,env,String(row.id),origin);videoResults.push(result);if(row.parentJobId){const{reconcileReelVideoGeneration}=await import("../agent-runner/service");await reconcileReelVideoGeneration(db,env,String(row.parentJobId))}}
 const waitingVideoParents=await db.prepare("SELECT DISTINCT p.id FROM orchestrator_jobs p JOIN orchestrator_jobs c ON c.parent_job_id=p.id AND c.job_type='VIDEO_GENERATION' WHERE p.job_type='AGENT_TASK' AND p.status IN ('RUNNING','WAITING_PROVIDER') LIMIT 20").all();
 if(waitingVideoParents.results.length){const{reconcileReelVideoGeneration}=await import("../agent-runner/service");for(const parent of waitingVideoParents.results as any[])await reconcileReelVideoGeneration(db,env,String(parent.id))}
 return{checkedAt:now,staleImagesRecovered:staleImages.results.length,imagesProcessed:imageResults.length,videosProcessed:videoResults.length,upscalesProcessed:upscaleResults.length,imageResults:imageResults.map((job:any)=>({id:job.id,status:job.status,lastError:job.lastError})),videoResults:videoResults.map((job:any)=>({id:job.id,status:job.status,lastError:job.lastError})),upscaleResults:upscaleResults.map((job:any)=>({id:job.id,status:job.status,lastError:job.lastError}))};
}

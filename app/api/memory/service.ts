import{applyContextBudget,LOG_MEMORY_BOUNDARY,MEMORY_AUTHORITY_RULE,MEMORY_LAYERS,MEMORY_POLICY_VERSION,parseJson,provenance,scopeContentMemory,validLearningWindow}from"./policy";

const phaseInputs:Record<string,string[]>={
 "market-research":["client-brief"],
 references:["client-brief","market-research"],
 "creative-direction":["client-brief","market-research","references"],
 "strategy-direction":["client-brief","market-research","references"],
 "monthly-direction":["client-brief","market-research","references"],
 "batch-ideas":["client-brief","market-research","references","creative-direction","strategy-direction","monthly-direction"],
 "content-production":["client-brief","references","creative-direction","strategy-direction","monthly-direction","batch-ideas"],
 "reel-video-production":["client-brief","references","creative-direction","strategy-direction","monthly-direction","batch-ideas","content-production"],
};

function item(row:any,scope:any,status="Approved"){
 return{...row,provenance:provenance({sourceType:String(row.sourceType||"unknown"),sourceId:String(row.sourceId||row.id||""),scope,status,approvedBy:row.approvedBy||null,effectiveAt:row.effectiveAt||row.approvedAt||row.updatedAt||null,supersedesId:row.supersedesId?String(row.supersedesId):null})};
}

async function sources(db:any,projectId:string,currentPhaseKey:string,requestedScope:{contentId?:string|null;taskId?:string|null}={}){
 const project=await db.prepare("SELECT id,team_id AS workspaceId,client,project_type_code AS projectType,project_mode AS mode,purpose,project_duration AS duration,project_config AS config,deliverables,restrictions FROM projects WHERE id=?").bind(projectId).first<any>();
 if(!project)throw Object.assign(new Error("Project not found."),{status:404});
 const scope={workspaceId:project.workspaceId||null,projectId,phaseKey:currentPhaseKey||null,contentId:requestedScope.contentId||null,taskId:requestedScope.taskId||null};
 const[approvedRows,currentPhase,referenceFiles,learnedRows,publishingRows,performanceRows,socialRows,batchLearning,productionBatch]=await Promise.all([
  db.prepare(`SELECT s.id AS sourceId,s.phase_key AS phaseKey,s.phase_label AS phaseLabel,s.version,s.approved_content AS content,s.approved_by AS approvedBy,s.approved_at AS approvedAt,s.formula_id AS formulaId,s.formula_version AS formulaVersion,s.generation_method AS generationMethod,
   (SELECT previous.id FROM approved_phase_snapshots previous WHERE previous.project_id=s.project_id AND previous.phase_key=s.phase_key AND previous.version<s.version ORDER BY previous.version DESC,previous.id DESC LIMIT 1) AS supersedesId
   FROM approved_phase_snapshots s
   WHERE s.project_id=? AND s.version=(SELECT MAX(latest.version) FROM approved_phase_snapshots latest WHERE latest.project_id=s.project_id AND latest.phase_key=s.phase_key)
   ORDER BY s.phase_key`).bind(projectId).all(),
  db.prepare("SELECT id,phase_key AS phaseKey,label,status,data,version,updated_at AS updatedAt FROM phase_records WHERE project_id=? AND phase_key=?").bind(projectId,currentPhaseKey).first<any>(),
  db.prepare("SELECT id AS sourceId,item_key AS itemKey,version,storage_key AS storageKey,file_name AS fileName,mime_type AS mimeType,size_bytes AS sizeBytes,drive_sync_status AS driveSyncStatus,created_at AS createdAt FROM visual_asset_revisions WHERE project_id=? AND phase='references' AND is_current=1 ORDER BY item_key,version DESC LIMIT 40").bind(projectId).all(),
  db.prepare("SELECT id AS sourceId,content_kind AS contentKind,extracted_pattern AS extractedPattern,learning_status AS learningStatus,created_at AS createdAt FROM learning_differences WHERE project_id=? AND learning_status='Approved' AND extracted_pattern IS NOT NULL AND trim(extracted_pattern)!='' ORDER BY created_at DESC,id DESC LIMIT 20").bind(projectId).all(),
  db.prepare("SELECT id AS sourceId,batch_id AS batchId,content_item_id AS contentItemId,content_key AS contentKey,platform,published_at AS publishedAt,provider_post_id AS providerPostId,provider_media_id AS providerMediaId,post_url AS postUrl,result FROM publishing_records WHERE project_id=? AND status='PUBLISHED' AND published_at IS NOT NULL ORDER BY published_at DESC,id DESC LIMIT 30").bind(projectId).all(),
  db.prepare(`SELECT s.id AS sourceId,s.batch_id AS batchId,s.platform,s.social_connection_id AS socialConnectionId,s.publishing_record_id AS publishingRecordId,s.scope,s.captured_at AS capturedAt,s.normalized_metrics AS metrics
   FROM social_performance_snapshots s
   LEFT JOIN publishing_records published ON published.id=s.publishing_record_id
   LEFT JOIN project_social_connections profile ON profile.project_id=s.project_id AND profile.connection_id=s.social_connection_id
   WHERE s.project_id=? AND ((s.publishing_record_id IS NOT NULL AND published.status='PUBLISHED' AND published.performance_sync_status='SYNCED') OR (s.scope='PROFILE' AND profile.status='Connected'))
   ORDER BY s.captured_at DESC,s.id DESC LIMIT 60`).bind(projectId).all(),
  db.prepare("SELECT connection_id AS socialConnectionId,platform,handle,account_type AS accountType,status,is_default AS isDefault FROM project_social_connections WHERE project_id=? ORDER BY platform,is_default DESC,connected_at").bind(projectId).all(),
  db.prepare(`SELECT candidate.id AS sourceId,candidate.batch_key AS batchKey,candidate.source_window_start AS sourceWindowStart,candidate.source_window_end AS sourceWindowEnd,candidate.keep_json AS keepJson,candidate.improve_json AS improveJson,candidate.test_next_json AS testNextJson,candidate.evidence_json AS evidenceJson,candidate.approved_by AS approvedBy,candidate.approved_at AS approvedAt,candidate.updated_at AS updatedAt,
   (SELECT previous.id FROM batch_learning_records previous WHERE previous.project_id=candidate.project_id AND previous.batch_key=candidate.batch_key AND previous.id<candidate.id ORDER BY previous.id DESC LIMIT 1) AS supersedesId
   FROM batch_learning_records candidate
   WHERE candidate.project_id=? AND candidate.status='READY' AND candidate.approved_at IS NOT NULL AND candidate.approved_by IS NOT NULL AND trim(candidate.approved_by)!='' AND candidate.source_window_start IS NOT NULL AND candidate.source_window_end IS NOT NULL AND datetime(candidate.source_window_end)>=datetime(candidate.source_window_start)
   AND NOT EXISTS(SELECT 1 FROM batch_learning_records newer WHERE newer.project_id=candidate.project_id AND newer.batch_key=candidate.batch_key AND newer.id>candidate.id AND newer.status='READY' AND newer.approved_at IS NOT NULL AND newer.approved_by IS NOT NULL AND trim(newer.approved_by)!='' AND newer.source_window_start IS NOT NULL AND newer.source_window_end IS NOT NULL AND datetime(newer.source_window_end)>=datetime(newer.source_window_start))
   ORDER BY candidate.approved_at DESC,candidate.id DESC LIMIT 1`).bind(projectId).first<any>(),
  db.prepare("SELECT id,batch_number AS batchNumber,starts_at AS startsAt,ends_at AS endsAt,status FROM production_batches WHERE project_id=? AND status!='Locked' ORDER BY CASE WHEN status='Planning' THEN 0 WHEN status='Active' THEN 1 ELSE 2 END,batch_number DESC LIMIT 1").bind(projectId).first<any>(),
 ]);
 const latest:Record<string,any>={};for(const row of approvedRows.results as any[])latest[row.phaseKey]=item({...row,sourceType:"approved_phase_snapshot",content:parseJson(row.content,{})},scope,"Approved");
 const currentData=parseJson(currentPhase?.data,{}),isRevision=["Retake","Reopened"].includes(String(currentPhase?.status))||Boolean(currentData.reviewNote||currentData.reviewFeedback||currentData._revisionFeedbackApplied),lastApproved=latest[currentPhaseKey]||null,currentWorkingVersion={...currentData};for(const key of["reviewNote","reviewFeedback","_acceptedReviewFields","_revisionFeedbackApplied"])delete currentWorkingVersion[key];
 const authoritative=(key:string)=>isRevision&&key===currentPhaseKey?null:latest[key]||null,firstAuthoritative=(keys:string[])=>keys.map(authoritative).find(Boolean)||null,referenceAssets=(referenceFiles.results as any[]).map(row=>item({...row,sourceType:"visual_asset_revision",category:String(row.itemKey||"").replace(/-reference$/,""),effectiveAt:row.createdAt},scope,"Approved Reference")),allowedInputs=new Set(phaseInputs[currentPhaseKey]||[]),currentPhaseInputContext=Object.values(latest).filter((row:any)=>allowedInputs.has(row.phaseKey));
 const learnedMemory=(learnedRows.results as any[]).map(row=>item({...row,sourceType:"learning_difference",pattern:parseJson(row.extractedPattern,row.extractedPattern),effectiveAt:row.createdAt},scope,String(row.learningStatus)));
 const publishedResults=(publishingRows.results as any[]).map(row=>item({...row,sourceType:"publishing_record",result:parseJson(row.result,{})},scope,"Published"));
 const performanceEvidence=(performanceRows.results as any[]).map(row=>item({...row,sourceType:"social_performance_snapshot",metrics:parseJson(row.metrics,{}),effectiveAt:row.capturedAt},scope,"Verified"));
 const nextBatchLearning=batchLearning&&validLearningWindow(batchLearning.sourceWindowStart,batchLearning.sourceWindowEnd)?item({sourceType:"batch_learning_record",...batchLearning,keep:parseJson(batchLearning.keepJson,[]),improve:parseJson(batchLearning.improveJson,[]),testNext:parseJson(batchLearning.testNextJson,[]),evidence:parseJson(batchLearning.evidenceJson,{}),effectiveAt:batchLearning.approvedAt},scope,"READY · APPROVAL VERIFIED"):null;
 return{project,scope,latest,currentPhase,currentData,isRevision,lastApproved,currentWorkingVersion,authoritative,firstAuthoritative,referenceAssets,currentPhaseInputContext,learnedMemory,publishedResults,performanceEvidence,socialRows:socialRows.results as any[],nextBatchLearning,productionBatch};
}

export async function buildGenerationContext(db:any,projectId:string,currentPhaseKey:string,options:{contentId?:string|null;taskId?:string|null;cache?:boolean;includeWorking?:boolean;maxChars?:number;maxEstimatedTokens?:number}={}){
 const loaded=await sources(db,projectId,currentPhaseKey,options),{project,scope,authoritative,firstAuthoritative,referenceAssets,currentPhaseInputContext,learnedMemory,publishedResults,performanceEvidence,socialRows,nextBatchLearning,productionBatch}=loaded,includeWorking=options.includeWorking!==false;
 const revisionContext=includeWorking&&loaded.isRevision?{mode:"REVISION",memoryLayer:"Working Memory",authority:"WORKING_NOT_DURABLE",lastApprovedVersion:loaded.lastApproved?{...loaded.lastApproved,authority:"REFERENCE_ONLY"}:null,revisionComments:{general:String(loaded.currentData.reviewNote||""),fields:loaded.currentData.reviewFeedback||{},authority:"AUTHORITATIVE_REVISION_INSTRUCTIONS"},currentWorkingVersion:{content:loaded.currentWorkingVersion,authority:"EDITABLE_NOT_APPROVED"},conflictRule:"REVISION COMMENTS override LAST APPROVED VERSION and CURRENT WORKING VERSION. Working content never becomes durable Memory until approved."}:null;
 let context:any={frameflowProjectContext:{
  memoryPolicy:{version:MEMORY_POLICY_VERSION,authorityRule:MEMORY_AUTHORITY_RULE,logBoundary:LOG_MEMORY_BOUNDARY,layers:MEMORY_LAYERS,scope},
  projectMetadata:{projectId:project.id,workspaceId:project.workspaceId||null,projectName:project.client,projectType:project.projectType,mode:project.mode,purpose:project.purpose,duration:project.duration,deliverables:project.deliverables,projectConfig:parseJson(project.config,{})},
  productionBatch:productionBatch?{id:Number(productionBatch.id),batchNumber:Number(productionBatch.batchNumber),startsAt:productionBatch.startsAt,endsAt:productionBatch.endsAt,status:productionBatch.status,authority:"DATABASE_BATCH_BOUNDARY",rule:"Every publishing date for this production run must fall inside startsAt through endsAt in the Project timezone."}:null,
  clientOrganizationMemory:{authority:"APPROVED_ORGANIZATIONAL",status:"NO_EXPLICIT_APPROVED_PROJECT_LINK",items:[],rule:"Client / Organization Memory is injected only after an explicit approved Project link exists; brand-name inference is prohibited."},
  publishingProfiles:{rule:"Agent must use the default connected Profile unless a Content Item explicitly requires an approved override.",connected:socialRows.filter(row=>row.status==="Connected"),defaults:socialRows.filter(row=>row.status==="Connected"&&Number(row.isDefault)===1)},
  approvedClientBrief:authoritative("client-brief"),approvedMarketResearch:firstAuthoritative(["market-research","research-style"]),approvedReferences:authoritative("references"),approvedCreativeDirection:firstAuthoritative(["creative-direction","strategy-direction","monthly-direction","mv-direction"]),approvedStorySource:firstAuthoritative(["script","idea-hook-story","batch-ideas","lyrics-style","storyboard-keyshots"]),
  currentContinuityRequirements:authoritative("creative-direction")?.content?.continuityRequirements||authoritative("mv-direction")?.content?.continuityRules||authoritative("references")?.content?.referenceRule||null,
  productionConstraints:{duration:project.duration,restrictions:project.restrictions},currentPhase:currentPhaseKey,currentPhaseInputContext,revisionContext,referenceAssetManifest:referenceAssets,
  productionMemory:{authorityRule:MEMORY_AUTHORITY_RULE,learnedMemory,publishedResults,performanceEvidence,nextBatchLearning},
 }};
 if(options.contentId)context=scopeContentMemory(context,options.contentId);
 context=applyContextBudget(context,{...(options.maxChars?{maxChars:options.maxChars}:{}),...(options.maxEstimatedTokens?{maxEstimatedTokens:options.maxEstimatedTokens}:{})});
 if(options.cache!==false)await db.prepare("INSERT INTO generation_context_cache(project_id,current_phase_key,context_json,built_at) VALUES(?,?,?,?) ON CONFLICT(project_id,current_phase_key) DO UPDATE SET context_json=excluded.context_json,built_at=excluded.built_at").bind(projectId,currentPhaseKey,JSON.stringify(context),new Date().toISOString()).run();
 return context;
}

export async function buildScopedAgentMemory(db:any,projectId:string,input:{phaseKey?:string|null;contentId?:string|null;taskId?:string|null;includeApproved?:boolean;includeLearning?:boolean;includePerformance?:boolean}={}){
 let phaseKey=String(input.phaseKey||"");if(!phaseKey){const row=await db.prepare("SELECT phase_key AS phaseKey FROM phase_records WHERE project_id=? AND status!='Approved' ORDER BY position LIMIT 1").bind(projectId).first<any>();phaseKey=String(row?.phaseKey||"client-brief")}
 const context=await buildGenerationContext(db,projectId,phaseKey,{contentId:input.contentId,taskId:input.taskId,cache:false,includeWorking:false}),root=context.frameflowProjectContext,memory=root.productionMemory||{};
 return{schema:"frameflow.scoped-memory.v1",policy:root.memoryPolicy,scope:root.memoryPolicy.scope,project:root.projectMetadata,clientOrganizationMemory:input.includeApproved===false?undefined:root.clientOrganizationMemory,approvedProjectMemory:input.includeApproved===false?undefined:{clientBrief:root.approvedClientBrief,marketResearch:root.approvedMarketResearch,references:root.approvedReferences,creativeDirection:root.approvedCreativeDirection,storySource:root.approvedStorySource,currentPhaseInput:root.currentPhaseInputContext,continuityRequirements:root.currentContinuityRequirements,productionConstraints:root.productionConstraints},learnedMemory:input.includeLearning===false?undefined:{items:memory.learnedMemory||[],nextBatch:memory.nextBatchLearning||null},outcomeEvidence:input.includePerformance===false?undefined:{published:memory.publishedResults||[],performance:memory.performanceEvidence||[]},contextBudget:root.contextBudget};
}

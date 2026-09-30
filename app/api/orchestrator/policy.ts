export const ORCHESTRATOR_POLICY={
 name:"FrameFlow System Orchestrator",
 version:"1.0",
 sourceOfTruth:"FRAMEFLOW_OS",
 publicEntryPoints:["/api/ai/run","/api/jobs","/api/jobs/callback"],
 rules:{
  osOwns:["PROJECT","TASK","APPROVAL","ASSET","CALENDAR","VERSION","PRODUCTION_MEMORY","PUBLISH_STATUS","AUDIT"],
  orchestratorOwns:["API_ROUTING","PERMISSION_CHECK","JOB_QUEUE","AGENT_DISPATCH","PROVIDER_ROUTING","COST_RECORDING","RETRY","CALLBACK","RESULT_WRITEBACK"],
  executorCannot:["APPROVE","FINALIZE_PROJECT","CHANGE_LOCKED_PROVIDER_CONFIG","CHANGE_WORKFLOW_PHASES"],
  secrets:"SERVER_ONLY_ENCRYPTED_CONNECTION_STORE_OR_RUNTIME_SECRET",
  finalApprovalRequiredForPublish:true,
  stopRetakeReopenRevokesJobs:true,
 },
}as const;

export const JOB_TYPES=["LLM_TASK","IMAGE_GENERATION","IMAGE_UPSCALE","VIDEO_GENERATION","AGENT_TASK","PUBLISH_JOB"]as const;
export type JobType=(typeof JOB_TYPES)[number];

export const ACTIVE_JOB_STATUSES=["QUEUED","SCHEDULED","RUNNING","WAITING_PROVIDER","WAITING_CALLBACK","RETRY_PENDING"]as const;

export const PROVIDER_ROUTES={
 LLM_TASK:{primary:"gemini",fallback:"openai",adapter:"openai-compatible-chat",modelPolicy:"server-configured"},
 IMAGE_GENERATION:{primary:"runninghub",fallback:null,adapter:"runninghub-qwen-image-2.1-workflow",modelPolicy:"workflow-locked"},
 IMAGE_UPSCALE:{primary:"runninghub",fallback:null,adapter:"runninghub-fixed-workflow",modelPolicy:"workflow-locked"},
 VIDEO_GENERATION:{primary:"runninghub",fallback:null,adapter:"minimax-h3-image-to-video",modelPolicy:"locked-workflow"},
 AGENT_TASK:{primary:"milla-im",fallback:null,adapter:"frameflow-agent",modelPolicy:"orchestrator-routed"},
 PUBLISH_JOB:{primary:"platform-connector",fallback:null,adapter:"social-publish",modelPolicy:"not-applicable"},
}as const;

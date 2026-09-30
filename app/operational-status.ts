export type OperationalTone="active"|"reviewing"|"attention"|"complete"|"paused";

export type OperationalState={
 status:"Active"|"Reviewing"|"Needs Attention"|"Completed"|"Paused";
 tone:OperationalTone;
 reason:string;
 nextAction:string;
 phase:string;
 batch:any|null;
};

const has=(value:unknown,pattern:RegExp)=>pattern.test(String(value||""));

export function currentOperationalBatch(project:any){
 const batches=[...(project?.batches||[])].sort((a:any,b:any)=>Number(a.batchNumber)-Number(b.batchNumber));
 return batches.find((batch:any)=>batch.status==="Overdue")||batches.find((batch:any)=>batch.status==="Active")||batches.find((batch:any)=>batch.status==="Planning")||[...batches].reverse().find((batch:any)=>batch.status!=="Locked")||null;
}

export function operationalState(project:any):OperationalState{
 const phases=Array.isArray(project?.phaseRecords)?project.phaseRecords:[],batch=currentOperationalBatch(project),phase=String(project?.assignmentStage||project?.stage||"Project setup").split(" · ")[0],retake=phases.find((row:any)=>["Retake","Reopened"].includes(row.status)),review=phases.find((row:any)=>["Reviewing","Client Reviewing"].includes(row.status));
 if(has(project?.projectStatus,/completed|archived/i))return{status:"Completed",tone:"complete",reason:"All required work is complete.",nextAction:"Open Task Files",phase,batch};
 if(has(project?.projectStatus,/paused|waiting payment/i))return{status:"Paused",tone:"paused",reason:String(project.projectStatus),nextAction:has(project?.projectStatus,/payment/i)?"Update payment":"Resume when ready",phase,batch};
 if(retake||project?.actionRequired||has(project?.assignmentStatus,/revision|needs attention|failed/i))return{status:"Needs Attention",tone:"attention",reason:String(project?.attentionReason||retake?.label||project?.assignmentStatus||"A correction is required."),nextAction:retake?`Open ${retake.label}`:"Open required action",phase:retake?.label||phase,batch};
 if(batch?.status==="Overdue")return{status:"Needs Attention",tone:"attention",reason:`Batch ${String(batch.batchNumber).padStart(2,"0")} is overdue${batch.deadlineReminder?` · ${batch.deadlineReminder}`:""}.`,nextAction:Number(batch.plannedCount||0)?"Review overdue Batch":"Add Content or close Batch",phase,batch};
 if(review||has(project?.assignmentStatus,/awaiting approval/i))return{status:"Reviewing",tone:"reviewing",reason:String(review?.label||project?.approvalTitle||"Management review is waiting."),nextAction:"Open approval",phase:review?.label||phase,batch};
 return{status:"Active",tone:"active",reason:String(project?.stage||"Work is in progress."),nextAction:has(project?.assignmentStatus,/ready/i)?"Start ready phase":"Continue current phase",phase,batch};
}

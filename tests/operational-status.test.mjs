import test from "node:test";
import assert from "node:assert/strict";
import {currentOperationalBatch,operationalState} from "../app/operational-status.ts";

test("one operational state prioritizes overdue work and keeps its Batch",()=>{
 const project={id:"P1",stage:"Content Production",batches:[
  {id:1,batchNumber:1,status:"Completed",plannedCount:4},
  {id:2,batchNumber:2,status:"Overdue",plannedCount:3,deadlineReminder:"2 days late"},
  {id:3,batchNumber:3,status:"Planning",plannedCount:0},
 ]};
 assert.equal(currentOperationalBatch(project).id,2);
 assert.deepEqual(operationalState(project),{
  status:"Needs Attention",tone:"attention",reason:"Batch 02 is overdue · 2 days late.",nextAction:"Review overdue Batch",phase:"Content Production",batch:project.batches[1],
 });
});

test("review and retake override ordinary active work",()=>{
 assert.equal(operationalState({stage:"Production",phaseRecords:[{label:"Internal Review",status:"Reviewing"}]}).status,"Reviewing");
 const retake=operationalState({stage:"Production",phaseRecords:[{label:"Reel 02",status:"Retake"}]});
 assert.equal(retake.status,"Needs Attention");
 assert.equal(retake.nextAction,"Open Reel 02");
});

test("completed and paused projects remain unambiguous",()=>{
 assert.equal(operationalState({projectStatus:"Completed"}).status,"Completed");
 assert.equal(operationalState({projectStatus:"Waiting Payment"}).nextAction,"Update payment");
});

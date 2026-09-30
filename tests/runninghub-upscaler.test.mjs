import test from"node:test";
import assert from"node:assert/strict";
import{readFileSync}from"node:fs";
import{imageDimensions,RUNNINGHUB_FINAL_NODE_ID,RUNNINGHUB_INPUT_NODE,RUNNINGHUB_UPSCALE_WORKFLOW_ID,runningHubNodeInfo,UPSCALE_STATUSES}from"../app/api/runninghub/contract.ts";
import{acceptedImageItemKeys}from"../app/api/projects/image-review.ts";

test("RunningHub Upscaler uses one locked workflow input",()=>{
 assert.equal(RUNNINGHUB_UPSCALE_WORKFLOW_ID,"2095002873376854017");
 assert.deepEqual(RUNNINGHUB_INPUT_NODE,{nodeId:"145",fieldName:"image"});
 assert.equal(RUNNINGHUB_FINAL_NODE_ID,"143");
 assert.deepEqual(runningHubNodeInfo("api/approved.png"),[{nodeId:"145",fieldName:"image",fieldValue:"api/approved.png"}]);
 assert.deepEqual(UPSCALE_STATUSES,["UPSCALE_PENDING","UPSCALE_PROCESSING","UPSCALE_COMPLETED","UPSCALE_FAILED"]);
});

test("image dimension metadata reads PNG headers",()=>{
 const bytes=new Uint8Array(24);bytes.set([0x89,0x50,0x4e,0x47],0);bytes.set([0,0,4,0],16);bytes.set([0,0,5,0],20);
 assert.deepEqual(imageDimensions(bytes,"image/png"),{width:1024,height:1280});
});

test("approved images trigger upscale and block publishing until completion",()=>{
 const projectRoute=readFileSync(new URL("../app/api/projects/route.ts",import.meta.url),"utf8"),orchestrator=readFileSync(new URL("../app/api/orchestrator/service.ts",import.meta.url),"utf8"),scheduler=readFileSync(new URL("../app/api/production-jobs/scheduler.ts",import.meta.url),"utf8");
 assert.match(projectRoute,/queueApprovedImageUpscales/);
 assert.match(orchestrator,/upscaleStatus!=="UPSCALE_COMPLETED"/);
 assert.match(scheduler,/job_type='IMAGE_UPSCALE'/);
});

test("partially accepted Review images are routed independently from Retakes",()=>{
 assert.deepEqual(acceptedImageItemKeys(["production_items.content_3.asset.1","production_items.content_3.copy","production_items.content_6.asset.1","production_items.content_6.asset.1"]),["content_3-asset-1","content_6-asset-1"]);
 const runner=readFileSync(new URL("../app/api/agent-runner/service.ts",import.meta.url),"utf8"),scheduler=readFileSync(new URL("../app/api/production-jobs/scheduler.ts",import.meta.url),"utf8");
 assert.match(runner,/agent_image_generation_queued/);
 assert.match(runner,/reconcileContentImageGeneration/);
 assert.doesNotMatch(runner,/Promise\.all\(Array\.from\(\{length:Math\.min\(3,jobs\.length\)/);
 assert.match(scheduler,/IMAGE_GENERATION_EXECUTION_WINDOW_EXCEEDED · automatic retry disabled/);
 assert.match(scheduler,/LIMIT 1/);
});

test("social image generation uses the locked RunningHub Qwen workflow",()=>{
 const runner=readFileSync(new URL("../app/api/agent-runner/service.ts",import.meta.url),"utf8"),orchestrator=readFileSync(new URL("../app/api/orchestrator/service.ts",import.meta.url),"utf8");
 assert.match(runner,/provider:"runninghub"/);
 assert.match(runner,/resolution:"1K"/);
 assert.match(runner,/max_input_references:FRAMEFLOW_IMAGE_REFERENCE_LIMIT/);
 assert.match(orchestrator,/dispatchRunningHubQwenImage/);
 assert.doesNotMatch(orchestrator,/openrouter-image/);
});

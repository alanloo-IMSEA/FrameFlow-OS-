import assert from"node:assert/strict";
import test from"node:test";
import{readFileSync}from"node:fs";
import{imageProviderFailureDecision}from"../app/image-generation-retry.ts";

test("all image provider failures stop after one attempt",()=>{
 assert.deepEqual(imageProviderFailureDecision(502,1,3),{retry:false,retryDelayMs:0,nextStatus:"FAILED"});
 assert.deepEqual(imageProviderFailureDecision(429,1,3),{retry:false,retryDelayMs:0,nextStatus:"FAILED"});
 assert.deepEqual(imageProviderFailureDecision(0,1,3),{retry:false,retryDelayMs:0,nextStatus:"FAILED"});
 assert.equal(imageProviderFailureDecision(400,1,3).nextStatus,"FAILED");
});

test("continuations use the approved generation source instead of a large upscaled master",()=>{
 const runner=readFileSync(new URL("../app/api/agent-runner/service.ts",import.meta.url),"utf8");
 assert.match(runner,/upscale\.derived_asset_id=cur\.id/);
 assert.match(runner,/source\.id=upscale\.source_asset_id/);
 assert.match(runner,/COALESCE\(source\.storage_key,cur\.storage_key\)/);
 assert.match(runner,/approved-generation-source/);
});

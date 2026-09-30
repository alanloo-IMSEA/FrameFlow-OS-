import test from"node:test";
import assert from"node:assert/strict";
import{readFileSync}from"node:fs";
import{RUNNINGHUB_ACCOUNT_STATUS_PATH,RUNNINGHUB_BASE_URL,testRunningHubConnection}from"../app/api/runninghub/service.ts";

test("RunningHub account status test follows the official request contract",async()=>{
 let captured;
 const result=await testRunningHubConnection("rh-secret-key",async(url,init)=>{captured={url,init};return new Response(JSON.stringify({code:0,msg:"success",data:{remainCoins:"999"}}),{status:200,headers:{"content-type":"application/json"}})});
 assert.equal(result.connected,true);
 assert.equal(result.status,"Connected");
 assert.equal(captured.url,`${RUNNINGHUB_BASE_URL}${RUNNINGHUB_ACCOUNT_STATUS_PATH}`);
 assert.equal(captured.init.method,"POST");
 assert.equal(captured.init.headers.authorization,"Bearer rh-secret-key");
 assert.deepEqual(JSON.parse(captured.init.body),{apikey:"rh-secret-key"});
});

test("RunningHub rejection is normalized to Failed",async()=>{
 const result=await testRunningHubConnection("bad-key",async()=>new Response(JSON.stringify({code:804,msg:"API key invalid"}),{status:200,headers:{"content-type":"application/json"}}));
 assert.equal(result.connected,false);
 assert.equal(result.status,"Failed");
 assert.equal(result.message,"API key invalid");
});

test("Tier 0 RunningHub status response never exposes the saved API Key",()=>{
 const source=readFileSync(new URL("../app/api/integrations/route.ts",import.meta.url),"utf8");
 const runningHubStatus=source.match(/runningHub:\{\.\.\.runningHub,[^\n]+/)?.[0]||"";
 assert.match(source,/const runningHubConfig=.*workflowExecutionEnabled:true/);
 assert.match(source,/workflowId:RUNNINGHUB_UPSCALE_WORKFLOW_ID/);
 assert.match(source,/h3VideoWorkflowId:RUNNINGHUB_H3_WORKFLOW_ID/);
 assert.doesNotMatch(runningHubStatus,/secret|apiKey/);
});

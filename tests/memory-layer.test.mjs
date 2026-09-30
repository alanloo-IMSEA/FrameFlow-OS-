import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  applyContextBudget,
  dedupeBy,
  estimateTokens,
  LOG_MEMORY_BOUNDARY,
  MEMORY_LAYERS,
  validLearningWindow,
} from "../app/api/memory/policy.ts";
import { requireAgentAccess, requireAssignedProject } from "../app/api/agent-access/service.ts";

test("observability sources are classified as never-generation Memory",()=>{
  assert.equal(MEMORY_LAYERS.logsObservability.authority,"NEVER_GENERATION_MEMORY");
  assert.ok(MEMORY_LAYERS.logsObservability.tables.includes("audit_log"));
  assert.ok(MEMORY_LAYERS.logsObservability.tables.includes("publishing_attempts"));
  assert.equal(LOG_MEMORY_BOUNDARY,"Log can provide evidence for Memory, but Log must never automatically become Memory.");
});

test("learning windows reject missing, malformed, and reversed ranges",()=>{
  assert.equal(validLearningWindow("2026-08-01T00:00:00Z","2026-08-14T00:00:00Z"),true);
  assert.equal(validLearningWindow("2026-08-14T00:00:00Z","2026-08-01T00:00:00Z"),false);
  assert.equal(validLearningWindow(null,"2026-08-14T00:00:00Z"),false);
  assert.equal(validLearningWindow("not-a-date","2026-08-14T00:00:00Z"),false);
});

test("context budget is multilingual, reserves model space, and protects authority before P3/evidence",()=>{
  const repeated="x".repeat(20_000),context={frameflowProjectContext:{approvedClientBrief:{content:{brief:repeated}},approvedMarketResearch:{content:{research:repeated}},referenceAssetManifest:Array.from({length:20},(_,id)=>({id,fileName:`${id}.png`})),currentPhaseInputContext:[{phaseKey:"client-brief",version:1,content:repeated},{phaseKey:"client-brief",version:1,content:repeated}],productionMemory:{learnedMemory:[{id:1,provenance:{sourceId:"1"}},{id:1,provenance:{sourceId:"1"}}],publishedResults:[],performanceEvidence:[]}}};
  const bounded=applyContextBudget(context),root=bounded.frameflowProjectContext;
  assert.equal(root.currentPhaseInputContext.length,1);
  assert.equal(root.productionMemory.learnedMemory.length,1);
  assert.ok(JSON.stringify(bounded).length<=96_000);
  assert.ok(root.contextBudget.estimatedTokens<=24_000);
  assert.equal(root.contextBudget.policy,"multilingual-estimate-with-reserve-v2");
  assert.equal(root.contextBudget.reservedTokens.total,28_000);
  assert.equal(root.contextBudget.withinBudget,true);
  assert.ok(estimateTokens("中".repeat(1_000))>1_000);
});

test("budget pruning removes P3 and older evidence before Approved authority",()=>{
  const context={frameflowProjectContext:{approvedClientBrief:{content:{fact:"APPROVED FACT MUST SURVIVE"}},currentTask:{instruction:"CURRENT TASK MUST SURVIVE"},visual:{priority:"P3_CREATIVE",fields:{decoration:{priority:"P3_CREATIVE",value:"z".repeat(8_000)}}},productionMemory:{learnedMemory:[],publishedResults:[],performanceEvidence:Array.from({length:20},(_,id)=>({id,metric:"e".repeat(2_000),provenance:{sourceId:String(id)}}))}}};
  const bounded=applyContextBudget(context,{maxChars:8_000,maxEstimatedTokens:2_500}),root=bounded.frameflowProjectContext;
  assert.equal(root.approvedClientBrief.content.fact,"APPROVED FACT MUST SURVIVE");
  assert.equal(root.currentTask.instruction,"CURRENT TASK MUST SURVIVE");
  assert.equal(root.visual,undefined);
  assert.equal(root.contextBudget.withinBudget,true);
  assert.ok(root.contextBudget.omitted.includes("P3 creative fields"));
});

test("dedupe preserves newest-first order",()=>{
  assert.deepEqual(dedupeBy([{id:"new",key:"a"},{id:"old",key:"a"},{id:"b",key:"b"}],row=>row.key).map(row=>row.id),["new","b"]);
});

test("runtime loader excludes Pending Learning and raw observability tables",async()=>{
  const source=await readFile(new URL("../app/api/memory/service.ts",import.meta.url),"utf8");
  assert.match(source,/learning_status='Approved'/);
  assert.match(source,/candidate\.status='READY'.*candidate\.approved_at IS NOT NULL.*candidate\.approved_by IS NOT NULL/s);
  assert.match(source,/published\.performance_sync_status='SYNCED'/);
  assert.match(source,/FROM publishing_records WHERE project_id=\? AND status='PUBLISHED'/);
  for(const table of["audit_log","production_events","agent_runs","orchestrator_job_events","publishing_attempts","agent_file_grant_events","drive_sync_queue"]){
    assert.equal(source.includes(`FROM ${table}`),false,`${table} must not feed generation context`);
  }
});

test("sync creates Pending Review candidate and only explicit approval can create usable READY",async()=>{
  const source=await readFile(new URL("../app/api/publishing/service.ts",import.meta.url),"utf8");
  assert.match(source,/VALUES\([^\n]+,'PENDING_REVIEW',NULL,NULL/);
  assert.match(source,/export async function approveBatchLearning/);
  assert.match(source,/SET status='READY',approved_by=\?,approved_at=\?/);
  assert.doesNotMatch(source,/INSERT INTO batch_learning_records[^\n]+READY/);
});

test("file grants route by reference switches and reject expiry/content mismatch",async()=>{
  const source=await readFile(new URL("../app/api/agent-files/service.ts",import.meta.url),"utf8");
  assert.match(source,/referenceTypesFromSwitches\(switches\)/);
  assert.match(source,/requestedContentId!==String\(grant\.contentId/);
  assert.match(source,/Date\.parse\(grant\.expiresAt\)<=Date\.now\(\)/);
  assert.match(source,/Agent File Grant expired/);
});

test("agent scope blocks old projects:read tokens and cross-project access",async()=>{
  const token=`ffa_${"b".repeat(64)}`,db={prepare(sql){return{bind(){return{first:async()=>sql.includes("FROM agent_api_tokens")?{id:"token_1",agentId:"agent@example.com",scopesJson:'["projects:read"]',expiresAt:null,name:"Agent"}:null,run:async()=>({success:true})}}}}};
  const req=new Request("https://example.test/api/agent/projects/PRJ-1/memory",{headers:{authorization:`Bearer ${token}`}});
  await assert.rejects(()=>requireAgentAccess(req,db,["memory:read:approved"]),error=>error.status===403&&error.missingScopes.includes("memory:read:approved"));
  await assert.rejects(()=>requireAssignedProject(db,"agent@example.com","PRJ-OTHER"),error=>error.status===403);
});

test("unknown raw/all/log layers are rejected rather than falling back",async()=>{
  const source=await readFile(new URL("../app/api/agent/projects/[projectId]/memory/route.ts",import.meta.url),"utf8");
  assert.match(source,/unknown=rawRequested\.filter/);
  assert.match(source,/Unknown Memory layer/);
  assert.doesNotMatch(source,/allowedLayers\.has\(layer\)\)\s*\?\s*layer\s*:\s*"approved"/);
});

test("model context exposes reference availability without injecting approved files",async()=>{
  const source=await readFile(new URL("../app/api/autofill/engine.ts",import.meta.url),"utf8");
  assert.match(source,/authority:"AVAILABLE_NOT_INJECTED"/);
  assert.match(source,/root\.referenceAssetManifest=\[\]/);
  assert.match(source,/root\.approvedReferences=\{phaseKey:"references",status:"AVAILABLE_NOT_INJECTED"/);
  assert.match(source,/phaseKey\|\|""\)!=="references"/);
  assert.match(source,/root\.currentContinuityRequirements=null/);
  assert.match(source,/modelContext=contextForModel\(context\)/);
  assert.match(source,/JSON\.stringify\(modelContext\)/);
});

test("ComfyUI/provider job input is built from enabled switches through the two-reference policy",async()=>{
  const source=await readFile(new URL("../app/api/agent-runner/service.ts",import.meta.url),"utf8");
  assert.match(source,/referenceTypes=referenceTypesFromSwitches\(architecture\.referenceSwitches\)/);
  assert.match(source,/selectFrameFlowImageReferences\(\{references,referenceTypes,continuityWithFirstImage,approvedAnchor\}\)/);
  assert.match(source,/reference_switches:architecture\.referenceSwitches/);
});

test("reopened work keeps the last Approved snapshot as authority",async()=>{
  const [memory,autofill]=await Promise.all([
    readFile(new URL("../app/api/memory/service.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/autofill/engine.ts",import.meta.url),"utf8"),
  ]);
  assert.match(memory,/FROM approved_phase_snapshots/);
  assert.match(memory,/s\.version=\(SELECT MAX\(latest\.version\) FROM approved_phase_snapshots latest WHERE latest\.project_id=s\.project_id AND latest\.phase_key=s\.phase_key\)/);
  assert.match(autofill,/LAST APPROVED VERSION — FOR REFERENCE ONLY/);
  assert.match(autofill,/CURRENT WORKING VERSION — EDITABLE \/ NOT APPROVED/);
});

test("exports keep trusted Memory and activity history separate with strict auth",async()=>{
  const [memory,history,management]=await Promise.all([
    readFile(new URL("../app/api/production-memory/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/production-history/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/memory/management.ts",import.meta.url),"utf8"),
  ]);
  assert.match(memory,/containsRawLogs:false/);
  assert.match(history,/LOGS_OBSERVABILITY_ONLY/);
  assert.doesNotMatch(management,/OWNER|fallback/i);
  assert.match(management,/Authentication required/);
});

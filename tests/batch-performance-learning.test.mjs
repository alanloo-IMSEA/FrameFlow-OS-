import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  batchDataMaturity,
  buildBatchTrend,
  compareBatchTotals,
  metricObject,
  rankBatchContent,
  selectCurrentBatch,
  sumBatchMetrics,
} from "../app/api/publishing/batch-performance.ts";
import {
  batchHasContinuationVisuals,
  productionAssetCountIssues,
} from "../app/social-production-plan.ts";
import {
  dateInTimeZone,
  selectSocialBatchLifecycle,
  socialBatchPlanningWindow,
} from "../app/social-batch-lifecycle.ts";
import {
  allowsOverlappingBatches,
  previousBatchBlocksPlanning,
} from "../app/social-batch-policy.ts";

test("Batch totals and ranking use each Publishing Record's latest normalized metrics", () => {
  const records = [
    {
      id: 1,
      status: "PUBLISHED",
      platform: "Instagram",
      normalizedMetrics: JSON.stringify({
        views: 100,
        reach: 80,
        engagement: 10,
        saves: 2,
        shares: 1,
      }),
    },
    {
      id: 2,
      status: "PUBLISHED",
      platform: "Threads",
      metrics: { views: 50, reach: 40, engagement: 8, saves: 1, shares: 3 },
    },
    { id: 3, status: "SCHEDULED", metrics: { views: 999, engagement: 999 } },
  ];
  assert.deepEqual(
    sumBatchMetrics(records.filter((row) => row.status === "PUBLISHED")),
    {
      views: 150,
      reach: 120,
      likes: 0,
      comments: 0,
      shares: 4,
      saves: 3,
      engagement: 18,
    },
  );
  assert.equal(rankBatchContent(records)[0].id, 1);
  assert.deepEqual(metricObject("not-json"), {
    views: 0,
    reach: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    engagement: 0,
  });
});

test("Batch trend replaces repeated snapshots instead of double-counting them", () => {
  const trend = buildBatchTrend([
    {
      publishingRecordId: 1,
      capturedAt: "2026-09-01T01:00:00Z",
      metrics: { views: 100 },
    },
    {
      publishingRecordId: 1,
      capturedAt: "2026-09-01T02:00:00Z",
      metrics: { views: 120 },
    },
    {
      publishingRecordId: 2,
      capturedAt: "2026-09-01T02:30:00Z",
      metrics: { views: 40 },
    },
    {
      publishingRecordId: 1,
      capturedAt: "2026-09-02T02:00:00Z",
      metrics: { views: 180 },
    },
  ]);
  assert.equal(trend[0].views, 160);
  assert.equal(trend[1].views, 220);
});

test("Previous Batch comparison and Data Maturity are deterministic", () => {
  const current = metricObject({ views: 150, reach: 80 }),
    previous = metricObject({ views: 100, reach: 100 });
  const comparison = compareBatchTotals(current, previous);
  assert.equal(comparison.views.percent, 50);
  assert.equal(comparison.reach.percent, -20);
  const now = Date.parse("2026-09-20T00:00:00Z"),
    maturity = batchDataMaturity(
      [
        {
          status: "PUBLISHED",
          publishedAt: "2026-09-01T00:00:00Z",
          performanceSyncStatus: "SYNCED",
        },
      ],
      now,
    );
  assert.equal(maturity.code, "MATURE");
  assert.equal(maturity.windows.d14, 1);
});

test("Current Batch selection prefers Active and otherwise the next incomplete Batch", () => {
  assert.equal(
    selectCurrentBatch([
      { id: 1, batchNumber: 1, status: "Completed" },
      { id: 2, batchNumber: 2, status: "Active" },
      { id: 3, batchNumber: 3, status: "Locked" },
    ]).id,
    2,
  );
  assert.equal(
    selectCurrentBatch([
      { id: 1, batchNumber: 1, status: "Completed" },
      { id: 2, batchNumber: 2, status: "Locked" },
    ]).id,
    2,
  );
});

test("Recurring lifecycle keeps the completed Batch visible until the next Batch becomes Active", () => {
  const waiting = selectSocialBatchLifecycle([
    { id: 1, batchNumber: 1, status: "Completed" },
    { id: 2, batchNumber: 2, status: "Planning" },
  ]);
  assert.equal(waiting.current.id, 1);
  assert.equal(waiting.next.id, 2);
  const started = selectSocialBatchLifecycle([
    { id: 1, batchNumber: 1, status: "Completed" },
    { id: 2, batchNumber: 2, status: "Active" },
  ]);
  assert.equal(started.current.id, 2);
  assert.equal(started.next, null);
});

test("Recurring lifecycle prefers the active Batch over an older overdue Batch", () => {
  const lifecycle = selectSocialBatchLifecycle([
    { id: 1, batchNumber: 1, status: "Completed" },
    { id: 2, batchNumber: 2, status: "Overdue" },
    { id: 3, batchNumber: 3, status: "Active" },
  ]);
  assert.equal(lifecycle.current.id, 3);
  assert.equal(lifecycle.next, null);
});

test("Recurring lifecycle opens a timezone-aware Planning window six days before the formal Batch start", () => {
  assert.deepEqual(socialBatchPlanningWindow("2026-09-12", "2026-09-06"), {
    planningStartsAt: "2026-09-06",
    isPlanningOpen: true,
    isActive: false,
  });
  assert.deepEqual(socialBatchPlanningWindow("2026-09-12", "2026-09-12"), {
    planningStartsAt: "2026-09-06",
    isPlanningOpen: false,
    isActive: true,
  });
  assert.equal(
    dateInTimeZone(new Date("2026-09-05T16:30:00Z"), "Asia/Kuala_Lumpur"),
    "2026-09-06",
  );
});

test("Batch policy allows overlap while preserving an optional sequential mode", () => {
  assert.equal(allowsOverlappingBatches({ batchOverlapMode: "OVERLAP" }), true);
  assert.equal(
    previousBatchBlocksPlanning(
      { batchOverlapMode: "OVERLAP" },
      { status: "Active" },
    ),
    false,
  );
  assert.equal(
    previousBatchBlocksPlanning(
      { batchOverlapMode: "SEQUENTIAL" },
      { status: "Active" },
    ),
    true,
  );
  assert.equal(
    previousBatchBlocksPlanning(
      { batchOverlapMode: "SEQUENTIAL" },
      { status: "Completed" },
    ),
    false,
  );
});

test("Dashboard human attention and social Batch completion use explicit authority gates", async () => {
  const [projects, page] = await Promise.all([
    readFile(new URL("../app/api/projects/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(projects, /reconcileCompletedSocialBatches/);
  assert.match(projects, /status IN \('PUBLISHED','MANUAL_EXCEPTION'\)/);
  assert.match(projects, /pr\.requires_human_action=1/);
  assert.match(projects, /Performance sync does not block completion/);
  assert.match(projects, /reconcileSocialBatchPlanning/);
  assert.match(projects, /social_batch_planning_opened/);
  assert.match(projects, /status='Planning'/);
  assert.match(projects, /phase_key='batch-learning' AND status='Approved'/);
  assert.match(projects, /assignment_stage='Batch Performance & Learning'/);
  assert.match(projects, /batch\.status='Planning'/);
  assert.match(projects, /startReadySocialBatchPlanningAgents/);
  assert.match(projects, /Agent Starting · Batch/);
  assert.match(page, /operationalState\(p\)\.status\s*===\s*"Needs Attention"/);
  assert.match(
    page,
    /actionLabel\s*=\s*\(p:\s*P\)\s*=>\s*operationalState\(p\)\.reason/,
  );
  assert.doesNotMatch(
    page,
    /\["Ongoing","Revision Requested"\]\.includes\(p\.assignmentStatus\)/,
  );
});

test("Dormant AutoPost keeps historical learning code but removes it from the active Social workflow", async () => {
  const [
    workflow,
    projects,
    publishing,
    service,
    scheduler,
    ui,
    projectUi,
    orchestrator,
  ] = await Promise.all([
    readFile(new URL("../app/workflow-definition.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/projects/route.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/publishing/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/api/publishing/service.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/api/publishing/scheduler.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/canonical-phase-workspace.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/canonical-project-workspace.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/api/orchestrator/service.ts", import.meta.url),
      "utf8",
    ),
  ]);
  assert.equal(
    (
      workflow.match(
        /key:"batch-learning",label:"Batch Performance & Learning"/g,
      ) || []
    ).length,
    0,
  );
  assert.equal(
    (workflow.match(/key:"publishing",label:"Task Files"/g) || []).length,
    2,
  );
  assert.match(projects, /ensureSocialBatchLearningPhases/);
  assert.match(projects, /await ensureSocialBatchLearningPhases\(db\)/);
  assert.match(publishing, /WHERE project_id=\? AND batch_id=\?/);
  assert.match(
    publishing,
    /WHERE project_id=\? AND batch_key=\? AND status='READY'/,
  );
  assert.match(publishing, /scope:"PROJECT_BATCH"/);
  assert.match(publishing, /range==="14d"\?14:range==="30d"\?30:null/);
  assert.match(
    publishing,
    /range:rangeDays\?`LAST_\$\{rangeDays\}_DAYS`:"ALL_TIME"/,
  );
  assert.match(publishing, /nextBatchLearningInput:approved/);
  assert.match(
    service,
    /rebuildLearning\(db:any,projectId:string,requestedBatchId:number\|null=null\)/,
  );
  assert.match(service, /status='PENDING_REVIEW'/);
  assert.match(scheduler, /rebuildLearning\(db,projectId,batchId\)/);
  for (const label of [
    "Top Content",
    "Batch Trend",
    "Previous Batch Comparison",
    "Data Maturity",
    "Agent Learning",
    "Next Batch Learning Input",
    "Scope boundary",
  ])
    assert.ok(ui.includes(label), `${label} must be visible`);
  assert.match(projectUi, /ProjectBatchPerformance/);
  assert.match(projectUi, /Cumulative Performance & Learning/);
  assert.match(projectUi, /<select\s+value=\{selected\s*\|\|\s*""\}/);
  assert.doesNotMatch(projectUi, /6-Batch Master/);
  assert.match(
    publishing,
    /batchId=Number\(url\.searchParams\.get\("batchId"\)/,
  );
  assert.match(
    publishing,
    /WHERE project_id=\? AND batch_id=\? AND status!='CANCELLED'/,
  );
  assert.match(ui, /View Batch/);
  assert.match(ui, /Only one Batch is shown at a time/);
  assert.match(ui, /"Instagram", "TikTok", "Threads", "Facebook Page"/);
  assert.match(orchestrator, /BLOCKED_CAPABILITY/);
  assert.match(orchestrator, /LIVE_PUBLISHING_NOT_IMPLEMENTED/);
  assert.doesNotMatch(orchestrator, /\["instagram","threads"\]\.includes/);
  assert.match(publishing, /PROJECT_ALL_BATCHES/);
  assert.doesNotMatch(publishing, /PROJECT_LAST_6_COMPLETED_BATCHES/);
});

test("Publishing history stays read-only, Batch-scoped, and supports verified manual posts", async () => {
  const [publishing, phaseUi, projectUi, phaseBar] = await Promise.all([
    readFile(
      new URL("../app/api/publishing/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/canonical-phase-workspace.tsx", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/canonical-project-workspace.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/project-phase-bar.tsx", import.meta.url), "utf8"),
  ]);
  const getHandler = publishing.slice(
    publishing.indexOf("export async function GET"),
    publishing.indexOf("export async function POST"),
  );
  for (const mutation of [
    "ensureRequestedSocialBatchPolicies",
    "queueApprovedSocialPublishJobs",
    "repairLegacyHanaPublishingBatch",
    "markMissedPublishingSchedules",
    "ensurePublishingRecord",
  ])
    assert.doesNotMatch(
      getHandler,
      new RegExp(mutation),
      `${mutation} must not run while viewing Publishing history`,
    );
  assert.match(
    publishing,
    /WHERE project_id=\? AND batch_id=\? AND status!='CANCELLED'/,
  );
  assert.match(publishing, /if\(requestedBatchId&&!visibleBatches\.some/);
  assert.match(publishing, /action==="mark_manual_published"/);
  assert.match(
    publishing,
    /\["TikTok","Facebook Page"\]\.includes\(record\.platform\)/,
  );
  assert.match(publishing, /MANAGEMENT_CONFIRMED_MANUAL_PUBLISH/);
  assert.match(publishing, /postUrl\.protocol!=="https:"/);
  assert.match(phaseUi, /Only one Batch is shown at a time/);
  assert.match(
    phaseUi,
    /\["Active", "Overdue", "Completed"\]\.includes\(batch\.status\)/,
  );
  assert.match(phaseUi, /Live post URL/);
  assert.match(phaseUi, /Open \{row\.platform\}/);
  assert.match(
    phaseUi,
    /\["NEEDS_ATTENTION", "MANUAL_EXCEPTION", "MANUAL_REQUIRED"\]\.includes\(row\.status\)/,
  );
  assert.doesNotMatch(
    phaseUi,
    /publish_now_test|Run Sandbox test|sandboxPublishing/,
  );
  assert.match(phaseUi, /publishKey = `publish_now\$\{row\.jobId\}`/);
  assert.match(phaseUi, /Boolean\(row\.socialConnectionId\)/);
  assert.match(
    phaseUi,
    /Choose a connected Destination Profile before publishing/,
  );
  assert.doesNotMatch(phaseUi, /prompt\("Paste the live/);
  assert.match(
    projectUi,
    /\["Active",\s*"Overdue",\s*"Completed"\]\.includes\(batch\.status\)/,
  );
  assert.match(projectUi, /View project totals across all Batches/);
  assert.match(phaseBar, /Batch history/);
});

test("Premature future-Batch records are cancelled only when their date violates that Batch", async () => {
  const [projects, publishing] = await Promise.all([
    readFile(new URL("../app/api/projects/route.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/publishing/route.ts", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(projects, /cancelOutOfWindowPrematurePublishingRecords/);
  assert.match(projects, /b\.status IN \('Planning','Locked'\)/);
  assert.match(
    projects,
    /localDate\s*<\s*row\.startsAt\s*\|\|\s*localDate\s*>\s*row\.endsAt/,
  );
  assert.match(projects, /premature_out_of_window_publishing_cancelled/);
  assert.match(projects, /error_code='OUT_OF_BATCH_WINDOW'/);
  assert.match(
    publishing,
    /!\["Locked","Planning"\]\.includes\(String\(batch\.status\)\)/,
  );
  assert.match(publishing, /status NOT IN \('Locked','Planning'\)/);
});

test("Content Production must match every visual in the Approved Batch before Reel Production", () => {
  const batch = {
    content_items: [
      { id: "content_1", visualAssetCount: 1 },
      { id: "content_2", visualAssetCount: 3 },
    ],
  };
  const incomplete = {
    production_items: [
      { contentId: "content_1", assets: [{ assetNumber: 1 }] },
      { contentId: "content_2", assets: [{ assetNumber: 1 }] },
    ],
  };
  assert.deepEqual(productionAssetCountIssues(batch, incomplete), [
    "content_2: missing visual 2 of 3",
    "content_2: missing visual 3 of 3",
  ]);
  assert.equal(batchHasContinuationVisuals(batch), true);
  const complete = {
    production_items: [
      { contentId: "content_1", assets: [{ assetNumber: 1 }] },
      {
        contentId: "content_2",
        assets: [{ assetNumber: 1 }, { assetNumber: 2 }, { assetNumber: 3 }],
      },
    ],
  };
  assert.deepEqual(productionAssetCountIssues(batch, complete), []);
});

test("Project Calendar and recurring Project pages expose the Current and Next Batch lifecycle", async () => {
  const [page, projectUi] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../app/canonical-project-workspace.tsx", import.meta.url),
      "utf8",
    ),
  ]);
  assert.doesNotMatch(page, /Content Calendar/);
  assert.match(page, /Project Calendar/);
  for (const label of [
    "DATES ·",
    "CURRENT BATCH",
    "NEXT BATCH START",
    "AGENT PREPARATION",
  ])
    assert.ok(
      page.includes(label),
      `${label} must be visible in Project Calendar`,
    );
  assert.match(
    page,
    /p\.projectMode\s*===\s*"recurring"\s*\|\|\s*p\.projectMode\s*===\s*"continuous"/,
  );
  assert.match(projectUi, /Content Production Batches/);
  assert.match(projectUi, /BATCH CONTROL CENTER/);
  assert.match(projectUi, /Batch records stay isolated from every other Batch/);
  assert.match(projectUi, /Locked until current Batch completes/);
  assert.match(projectUi, /View Task Files/);
});

test("Social Agent opens the registered Reel workflow after approved Content without a blanket upscale gate", async () => {
  const [agent, projects, integrations, orchestrator] = await Promise.all([
    readFile(
      new URL("../app/api/agent-runner/service.ts", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/api/projects/route.ts", import.meta.url), "utf8"),
    readFile(
      new URL("../app/api/integrations/route.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/api/orchestrator/service.ts", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(
    agent,
    /generateReelVideos\(db,env,projectId,payload,agentJob\.id\)/,
  );
  assert.match(agent, /reconcileReelVideoGeneration/);
  assert.match(agent, /FF-VIDEO-I2V-01/);
  assert.match(agent, /stop_phase_key='reel-video-production'/);
  assert.match(projects, /nfillar_reel_redesign_reset_20260905/);
  assert.match(projects, /await clearNFillarReelForRedesign\(db\)/);
  assert.match(
    projects,
    /async function openRegisteredSocialReelProduction\(db:\s*any\)/,
  );
  assert.match(projects, /await openRegisteredSocialReelProduction\(db\)/);
  assert.match(projects, /Ready · Tier 0–1 Reel Style Selection/);
  assert.match(agent, /waitingForReelConfiguration:true/);
  assert.doesNotMatch(agent, /awaiting RunningHub upscale/);
  assert.doesNotMatch(
    projects,
    /Reel Video Production is blocked until every approved source image/,
  );
  assert.match(
    projects,
    /async function repairIncompleteSocialProduction\(db:\s*any\)\s*\{\s*const now\s*=\s*new Date\(\)\.toISOString\(\)/,
  );
  assert.match(
    projects,
    /async function recoverEmptyContinuationReview\(db:\s*any\)/,
  );
  assert.match(projects, /empty_continuation_review_recovered/);
  assert.match(agent, /!assetCountIssues\.length/);
  assert.match(
    agent,
    /preserveAcceptedReviewBlocks\(payload,currentData,recoveryAcceptedFields\)/,
  );
  assert.match(
    projects,
    /preserved:\s*"Content Production images and upscaled masters"/,
  );
  assert.doesNotMatch(integrations, /stopPhase:"reel-video-production"/);
  assert.match(integrations, /stopPhase:"content-production"/);
  assert.match(
    orchestrator,
    /phase_key='reel-video-production' AND status IN \('In Progress','Reopened','Retake'\)/,
  );
});

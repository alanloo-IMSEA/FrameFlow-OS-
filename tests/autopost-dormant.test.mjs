import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("AutoPost is fail-closed while task production and Telegram stay active", async () => {
  const [mode, orchestrator, scheduler, productionScheduler, agentRoute, publishing, runner, workspace, facebookCallback, instagramCallback, threadsCallback, tiktokCallback] = await Promise.all([
    readFile(new URL("../app/autopost-mode.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/orchestrator/service.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/publishing/run-due/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/production-jobs/scheduler.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/agent-runner/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/publishing/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/agent-runner/service.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/canonical-phase-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/facebook/callback/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/instagram/callback/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/threads/callback/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/tiktok/callback/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(mode, /AUTOPOST_ENABLED = false/);
  assert.match(orchestrator, /if\(!AUTOPOST_ENABLED\)return\[\]/);
  assert.match(scheduler, /if\(!AUTOPOST_ENABLED\)return autoPostNotFound/);
  assert.match(agentRoute, /runProductionJobScheduler/);
  assert.match(productionScheduler, /job_type='IMAGE_GENERATION'/);
  assert.match(productionScheduler, /job_type='VIDEO_GENERATION'/);
  assert.match(productionScheduler, /job_type='IMAGE_UPSCALE'/);
  assert.doesNotMatch(productionScheduler, /PUBLISH_JOB|publishing_records|deliverPendingPublishingNotifications/);
  assert.match(publishing, /if\(!AUTOPOST_ENABLED\)return autoPostNotFound/);
  assert.doesNotMatch(workspace, /fetch\("\/api\/publishing\/run-due"/);
  assert.match(runner, /sendTelegram/);
  assert.match(runner, /Task Files/);
  for (const callback of [facebookCallback, instagramCallback, threadsCallback, tiktokCallback]) {
    assert.match(callback, /if\(!AUTOPOST_ENABLED\)return autoPostNotFound\(\)/);
  }
});

test("Content planning is format-only and Task Files replaces Publishing", async () => {
  const [workflow, workspace, formula, autofill, projects] = await Promise.all([
    readFile(new URL("../app/workflow-definition.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/canonical-phase-workspace.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/formula-library.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/autofill/engine.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/projects/route.ts", import.meta.url), "utf8"),
  ]);
  assert.equal((workflow.match(/key:"publishing",label:"Task Files"/g) || []).length, 2);
  assert.match(workspace, /\["Image", "Reel", "Carousel", "Text Only"\]/);
  assert.match(workspace, /<TaskFilesEditor p=\{p\}/);
  assert.doesNotMatch(workspace, /Agent must select at least one available Project platform/);
  assert.match(formula, /Do not select a social platform, destination, publishing date or publishing schedule/);
  assert.doesNotMatch(autofill, /PLATFORM_SELECTION_REQUIRED/);
  assert.doesNotMatch(autofill, /missing\.push\(`items\[\$\{index\}\]\.hashtags`\)/);
  assert.match(projects, /Batch Ideas requires at least one Content Item/);
  assert.match(workspace, /disabled=\{reviewSubmitting \|\| reviewKeys\.length === 0 \|\| hasFieldRetake\}/);
});

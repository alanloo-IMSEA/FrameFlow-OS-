import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("production UI contains no permission simulator, Demo label, or Sandbox publisher", async () => {
  const [page, workspace] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/canonical-phase-workspace.tsx"),
  ]);
  for (const artifact of [
    "demoProfiles",
    "TEST MODE",
    "PREVIEW PERMISSION",
    "DEMO DATA",
    "Creating demo project",
    "Test Telegram login",
  ])
    assert.doesNotMatch(page, new RegExp(artifact, "i"));
  assert.doesNotMatch(
    workspace,
    /publish_now_test|Run Sandbox test|sandboxPublishing|FrameFlow Sandbox Publishing/,
  );
});

test("production UI exposes only active Social project types without deleting dormant workflows", async () => {
  const [page, rules] = await Promise.all([
    source("../app/page.tsx"),
    source("../app/business-rules.ts"),
  ]);
  assert.match(
    rules,
    /ACTIVE_PROJECT_TYPES=\["Internal Social Account","Client Social Account"\]/,
  );
  assert.match(page, /setPs\(visibleProjects\)/);
  assert.match(page, /ACTIVE_PROJECT_TYPES\.map\(\(type\) =>/);
  assert.doesNotMatch(page, /<option>AI Video<\/option>/);
  assert.match(rules, /PROJECT_TYPES=\["AI Video","AI Reels"/);
});

test("sample review route and simulated publisher are absent", async () => {
  await assert.rejects(
    access(new URL("../app/review/sample/page.tsx", import.meta.url)),
  );
  await assert.rejects(
    access(new URL("../app/api/publishing/sandbox.ts", import.meta.url)),
  );
});

test("new and existing projects are promoted safely to production", async () => {
  const [schema, projects, launch, drive] = await Promise.all([
    source("../db/schema.ts"),
    source("../app/api/projects/route.ts"),
    source("../app/api/projects/production-launch.ts"),
    source("../app/api/google-drive/drive.ts"),
  ]);
  assert.match(
    schema,
    /isDemo: integer\("is_demo"\)\.notNull\(\)\.default\(0\)/,
  );
  assert.match(projects, /INSERT INTO projects\(id,client,type,is_demo/);
  assert.match(projects, /b\.client\.trim\(\),\s*projectType,\s*0,/);
  assert.match(launch, /UPDATE projects SET is_demo=0/);
  assert.doesNotMatch(launch, /DELETE FROM projects/);
  assert.match(launch, /production_batch_consistency_repaired/);
  assert.match(launch, /COUNT\(DISTINCT COALESCE/);
  assert.match(launch, /SET label='Task Files'/);
  assert.match(drive, /environment:"production"/);
  assert.doesNotMatch(drive, /FRAMEFLOW_DEMO_MODE|\[DEMO\]_/);
});

test("historical Batches open read-only Task Files instead of current production", async () => {
  const project = await source("../app/canonical-project-workspace.tsx");
  assert.match(project, /BATCH HISTORY · READ ONLY/);
  assert.match(project, /Historical Task Files remain available/);
  assert.match(project, /browsingHistoricalBatch && step !== "publishing"/);
  assert.match(project, /setStep\("publishing"\)/);
});

test("user APIs fail closed instead of impersonating the owner", async () => {
  const files = await Promise.all([
    source("../app/api/projects/route.ts"),
    source("../app/api/session/route.ts"),
    source("../app/api/uploads/route.ts"),
    source("../app/api/assets-library/route.ts"),
    source("../app/api/autofill/route.ts"),
    source("../app/api/song-upload/route.ts"),
    source("../app/api/agent-files/route.ts"),
    source("../app/api/orchestrator/access.ts"),
    source("../app/api/google-drive/_lib.ts"),
  ]);
  for (const file of files)
    assert.doesNotMatch(
      file,
      /oai-authenticated-user-email[^\n]*\|\|[^\n]*alanloo927@gmail\.com/,
    );
});

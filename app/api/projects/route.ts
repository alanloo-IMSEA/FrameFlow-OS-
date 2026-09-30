import {
  createProjectDrive,
  queueProjectDriveRecord,
} from "../google-drive/drive";
import { ensureBusinessSchema } from "./business-schema";
import {
  AI_VIDEO_PURPOSES,
  PROJECT_TYPES,
  allowedModes,
} from "../../business-rules";
import { initialProjectStatus, workflowFor } from "../../workflow-definition";
import {
  followsProductionImageFormula,
  followsReelPromptFormula,
  lockReelVideoPrompt,
  wardrobeValidationIssues,
} from "../../social-production-formula";
import { saveApprovedSnapshot } from "./autofill-architecture";
import { continueAfterReview, runProject } from "../agent-runner/service";
import {
  completePhaseAgentFileGrants,
  revokeProjectAgentFileGrants,
} from "../agent-files/service";
import {
  cancelProjectJobs,
  failLatestRunningJob,
  queueApprovedImageUpscales,
  queueApprovedSocialPublishJobs,
} from "../orchestrator/service";
import { notifyGenerationIncident } from "../orchestrator/generation-incidents";
import {
  deleteProjectObjects,
  prepareProductionWorkspace,
} from "./production-launch";
import { requestUserEmail } from "../../chatgpt-auth";
import {
  canonicalSocialPlatform,
  configuredSchedulePlatforms,
  platformAllowedForContent,
} from "../../social-scheduling-platforms";
import {
  batchHasContinuationVisuals,
  productionAssetCountIssues,
} from "../../social-production-plan";
import {
  dateInTimeZone,
  socialBatchPlanningWindow,
} from "../../social-batch-lifecycle";
import {
  i2vValidationIssues,
  normalizeI2VPromptItem,
} from "../../video-prompt-architecture";
import { imageDimensions } from "../runninghub/contract";
import {
  socialBatchAssetKey,
  socialBatchProductionAssetKeys,
} from "../../social-batch-assets";
import {
  approvedReelGenerationRetryData,
  reelConfigurationIssues,
  reelRetakeContentIds,
  unresolvedReelPromptRetake,
} from "../../reel-production-architecture";
import {
  freshReelSetup,
  reelCheckpointEnvelope,
  reelCheckpointMatchesApproved,
  reelRetakeMatchesApproved,
} from "../../reel-checkpoint-integrity";
import { ensureRunningHubH3Contract } from "../runninghub/workflow-registry";
import {
  allowsOverlappingBatches,
  ensureRequestedSocialBatchPolicies,
  previousBatchBlocksPlanning,
} from "../../social-batch-policy";
import { AUTOPOST_ENABLED } from "../../autopost-mode";
const baseColumns =
  "id,client,type,is_demo AS isDemo,project_type_code AS projectType,project_mode AS projectMode,purpose,mv_entry AS mvEntry,project_config AS projectConfig,payment_confirmed AS paymentConfirmed,payment_percentage AS paymentPercentage,delivery_confirmed AS deliveryConfirmed,payment_cleared AS paymentCleared,legacy_type AS legacyType,status,project_status AS projectStatus,phase_status AS phaseStatus,stage,progress,recurring,project_nature AS projectNature,project_duration AS projectDuration,frequency_count AS frequencyCount,frequency_unit AS frequencyUnit,project_start_date AS projectStartDate,project_end_date AS projectEndDate,assignment_members AS assignmentMembers,assignment_stage AS assignmentStage,assignment_status AS assignmentStatus,assigned_at AS assignedAt,assignment_due_at AS assignmentDueAt,revision_note AS revisionNote,drive_url AS driveUrl,approval_title AS approvalTitle,brief_owner AS briefOwner,client_name AS clientName,brand_overview AS brandOverview,project_goal AS projectGoal,audience,deliverables,key_message AS keyMessage,tone,due_date AS dueDate,restrictions,brief_status AS briefStatus,brief_doc_url AS briefDocUrl,research_assignee AS researchAssignee,trend_assignee AS trendAssignee,market_snapshot AS marketSnapshot,market_opportunities AS marketOpportunities,market_direction AS marketDirection,market_references AS marketReferences,market_status AS marketStatus,trend_observations AS trendObservations,trend_fit AS trendFit,trend_references AS trendReferences,trend_status AS trendStatus,creative_concept AS creativeConcept,creative_objective AS creativeObjective,content_pillars AS contentPillars,visual_style AS visualStyle,tone_mood AS toneMood,key_takeaway AS keyTakeaway,format_direction AS formatDirection,foundation_status AS foundationStatus,foundation_version AS foundationVersion,script_data AS scriptData,script_status AS scriptStatus,script_version AS scriptVersion,team_id AS teamId,brief_version AS briefVersion,research_version AS researchVersion,drive_sync_status AS driveSyncStatus,created_at AS createdAt";
const seed: any[] = [];
async function runtimeDb() {
  const { env } = await import("cloudflare:workers");
  return env.DB;
}
async function runManagedProject(db:any,env:any,projectId:string,activate=true){
  try{return await runProject(db,env,projectId,activate)}catch(error:any){
    const message=String(error?.message||error),stamp=new Date().toISOString();
    await failLatestRunningJob(db,projectId,"AGENT_TASK","agent:milla-im",message);
    const failed=await db.prepare("SELECT id FROM orchestrator_jobs WHERE project_id=? AND job_type='AGENT_TASK' AND status='FAILED' ORDER BY updated_at DESC LIMIT 1").bind(projectId).first<any>();
    if(failed?.id)await notifyGenerationIncident(db,env,String(failed.id),message);
    await db.prepare("UPDATE agent_project_controls SET active=0,status='Needs Attention · Generation stopped',updated_at=?,last_error=? WHERE project_id=? AND agent_id='agent:milla-im'").bind(stamp,message,projectId).run();
    throw error;
  }
}
async function ready() {
  const runtime = await import("cloudflare:workers");
  return runtime.env.DB;
  const { env } = await import("cloudflare:workers");
  const db = env.DB;
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY,client TEXT NOT NULL,type TEXT NOT NULL,status TEXT NOT NULL,stage TEXT NOT NULL,progress INTEGER NOT NULL DEFAULT 0,recurring TEXT,drive_url TEXT,approval_title TEXT,brief_owner TEXT,client_name TEXT,brand_overview TEXT,project_goal TEXT,audience TEXT,deliverables TEXT,key_message TEXT,tone TEXT,due_date TEXT,restrictions TEXT,brief_status TEXT NOT NULL DEFAULT 'Draft',brief_doc_url TEXT,research_assignee TEXT,trend_assignee TEXT,market_snapshot TEXT,market_opportunities TEXT,market_direction TEXT,market_references TEXT,market_status TEXT NOT NULL DEFAULT 'Locked',trend_observations TEXT,trend_fit TEXT,trend_references TEXT,trend_status TEXT NOT NULL DEFAULT 'Locked',creative_concept TEXT,creative_objective TEXT,content_pillars TEXT,visual_style TEXT,tone_mood TEXT,key_takeaway TEXT,format_direction TEXT,script_data TEXT,script_status TEXT NOT NULL DEFAULT 'Locked',team_id INTEGER,brief_version INTEGER NOT NULL DEFAULT 0,research_version INTEGER NOT NULL DEFAULT 0,drive_sync_status TEXT NOT NULL DEFAULT 'Not connected',created_at TEXT NOT NULL)`,
    )
    .run();
  try {
    await db
      .prepare("ALTER TABLE projects ADD COLUMN project_duration TEXT")
      .run();
  } catch {}
  try {
    await db
      .prepare(
        "ALTER TABLE projects ADD COLUMN foundation_status TEXT NOT NULL DEFAULT 'Locked'",
      )
      .run();
  } catch {}
  try {
    await db
      .prepare(
        "ALTER TABLE projects ADD COLUMN foundation_version INTEGER NOT NULL DEFAULT 0",
      )
      .run();
  } catch {}
  await ensureBusinessSchema(db);
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS document_versions (id INTEGER PRIMARY KEY AUTOINCREMENT,project_id TEXT NOT NULL,document_type TEXT NOT NULL,version INTEGER NOT NULL,snapshot TEXT NOT NULL,approved_by TEXT,created_at TEXT NOT NULL)",
    )
    .run();
  const row = await db
    .prepare("SELECT COUNT(*) AS count FROM projects")
    .first<{ count: number }>();
  if (!row?.count)
    for (const p of seed)
      await db
        .prepare(
          "INSERT INTO projects(id,client,type,status,stage,progress,recurring,drive_url,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
        )
        .bind(...p)
        .run();
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS app_migrations (id TEXT PRIMARY KEY,applied_at TEXT NOT NULL)",
    )
    .run();
  const reopen = await db
    .prepare(
      "SELECT id FROM app_migrations WHERE id='v30_reopen_id_visual_generation'",
    )
    .first();
  if (!reopen) {
    const p = await db
      .prepare("SELECT script_data AS data FROM projects WHERE id='PRJ-0002'")
      .first<any>();
    let data: any = {};
    try {
      data = JSON.parse(p?.data || "{}");
      delete data.productionReviews;
    } catch {}
    await db
      .prepare(
        "UPDATE projects SET script_data=?,assignment_stage='Visual Development & Image Generation',assignment_status='Ongoing',approval_title=NULL,revision_note=NULL,stage='Visual Development & Image Generation · In Progress',progress=78 WHERE id='PRJ-0002'",
      )
      .bind(JSON.stringify(data))
      .run();
    await db
      .prepare(
        "INSERT INTO app_migrations(id,applied_at) VALUES('v30_reopen_id_visual_generation',?)",
      )
      .bind(new Date().toISOString())
      .run();
  }
  const socialStage = await db
    .prepare(
      "SELECT id FROM app_migrations WHERE id='v36_fix_hana_image_stage'",
    )
    .first();
  if (!socialStage) {
    await db
      .prepare(
        "UPDATE projects SET assignment_stage='Image Generation',assignment_status='Ongoing',approval_title=NULL,revision_note=NULL,stage='Image Generation · In Progress',progress=66 WHERE id='PRJ-0001'",
      )
      .run();
    await db
      .prepare(
        "INSERT INTO app_migrations(id,applied_at) VALUES('v36_fix_hana_image_stage',?)",
      )
      .bind(new Date().toISOString())
      .run();
  }
  const briefTasks = await db
    .prepare(
      "SELECT id FROM app_migrations WHERE id='v37_restore_new_project_brief_tasks'",
    )
    .first();
  if (!briefTasks) {
    const now = new Date().toISOString(),
      owner = JSON.stringify([OWNER_EMAIL]);
    await db
      .prepare(
        "UPDATE projects SET assignment_members=?,assignment_stage='Client Brief',assignment_status='Ongoing',assigned_at=COALESCE(assigned_at,?),assignment_due_at=COALESCE(assignment_due_at,project_end_date),brief_owner=COALESCE(NULLIF(brief_owner,''),'Hana Lim'),due_date=COALESCE(due_date,project_end_date),stage='Client Brief · In Progress' WHERE brief_status='Draft' AND (assignment_members IS NULL OR assignment_members='' OR assignment_members='[]')",
      )
      .bind(owner, now)
      .run();
    await db
      .prepare(
        "INSERT INTO app_migrations(id,applied_at) VALUES('v37_restore_new_project_brief_tasks',?)",
      )
      .bind(now)
      .run();
  }
  const mvGate = await db
    .prepare(
      "SELECT id FROM app_migrations WHERE id='v39_reopen_incomplete_mv_scripts'",
    )
    .first();
  if (!mvGate) {
    const submitted = await db
      .prepare(
        "SELECT id,script_data AS data FROM projects WHERE type='MV' AND script_status='Submitted'",
      )
      .all();
    for (const row of submitted.results as any[]) {
      let d: any = {};
      try {
        d = JSON.parse(row.data || "{}");
      } catch {}
      if (
        !String(d.songLyrics || "").trim() ||
        !String(d.songStyle || "").trim()
      )
        await db
          .prepare(
            "UPDATE projects SET script_status='Draft',assignment_status='Ongoing',approval_title=NULL,stage='Script · In Progress',progress=50 WHERE id=?",
          )
          .bind(row.id)
          .run();
    }
    await db
      .prepare(
        "INSERT INTO app_migrations(id,applied_at) VALUES('v39_reopen_incomplete_mv_scripts',?)",
      )
      .bind(new Date().toISOString())
      .run();
  }
  const mvOrder = await db
    .prepare(
      "SELECT id FROM app_migrations WHERE id='v43_mv_storyboard_before_visual_script'",
    )
    .first();
  if (!mvOrder) {
    const rows = await db
      .prepare(
        "SELECT id,script_data AS data,stage FROM projects WHERE type='MV'",
      )
      .all();
    for (const row of rows.results as any[]) {
      let d: any = {};
      try {
        d = JSON.parse(row.data || "{}");
      } catch {}
      if (
        d.mvMusic?.songStatus === "approved" &&
        String(row.stage || "").includes("MV Visual Script") &&
        !d.storyboardStatus
      ) {
        d.storyboardStatus = "draft";
        await db
          .prepare(
            "UPDATE projects SET script_data=?,script_status='Music Approved',assignment_stage='Storyboard',assignment_status='Ongoing',approval_title=NULL,stage='Storyboard · Ready',progress=62 WHERE id=?",
          )
          .bind(JSON.stringify(d), row.id)
          .run();
      }
    }
    await db
      .prepare(
        "INSERT INTO app_migrations(id,applied_at) VALUES('v43_mv_storyboard_before_visual_script',?)",
      )
      .bind(new Date().toISOString())
      .run();
  }
  const splitFoundation = await db
    .prepare("SELECT id FROM app_migrations WHERE id='v48_split_mv_foundation'")
    .first();
  if (!splitFoundation) {
    await db
      .prepare(
        "UPDATE projects SET market_status='Approved',trend_status='Approved',foundation_status=CASE WHEN lower(stage) LIKE '%mv music%' OR lower(stage) LIKE '%storyboard%' OR lower(stage) LIKE '%visual script%' OR lower(stage) LIKE '%production design%' THEN 'Approved' ELSE 'Draft' END,assignment_stage=CASE WHEN research_version>0 AND (lower(stage) LIKE '%foundation%' OR lower(stage) LIKE '%research%' OR lower(stage) LIKE '%assign%') THEN 'Foundation' ELSE assignment_stage END,assignment_status=CASE WHEN research_version>0 AND (lower(stage) LIKE '%foundation%' OR lower(stage) LIKE '%research%' OR lower(stage) LIKE '%assign%') THEN 'Ongoing' ELSE assignment_status END,approval_title=CASE WHEN research_version>0 AND (lower(stage) LIKE '%foundation%' OR lower(stage) LIKE '%research%' OR lower(stage) LIKE '%assign%') THEN NULL ELSE approval_title END,stage=CASE WHEN research_version>0 AND (lower(stage) LIKE '%foundation%' OR lower(stage) LIKE '%research%' OR lower(stage) LIKE '%assign%') THEN 'Foundation · In Progress' ELSE stage END WHERE type='MV' AND research_version>0",
      )
      .run();
    await db
      .prepare(
        "INSERT INTO app_migrations(id,applied_at) VALUES('v48_split_mv_foundation',?)",
      )
      .bind(new Date().toISOString())
      .run();
  }
  return db;
}
const OWNER_EMAIL = "alanloo927@gmail.com";
function parseJson(value: any, fallback: any) {
  try {
    return JSON.parse(value || "");
  } catch {
    return fallback;
  }
}
function batchPlatformError(data: any, projectConfig: any, batch?: any) {
  const items = Array.isArray(data?.content_items)
    ? data.content_items
    : Array.isArray(data?.items)
      ? data.items
      : [];
  if (!items.length) return "Batch Ideas requires at least one Content Item.";
  if (!AUTOPOST_ENABLED) return null;
  const config =
      typeof projectConfig === "string"
        ? parseJson(projectConfig, {})
        : projectConfig || {},
    allowed = configuredSchedulePlatforms(config.authorizedPlatforms),
    startsAt = String(batch?.startsAt || batch?.starts_at || ""),
    endsAt = String(batch?.endsAt || batch?.ends_at || ""),
    timeZone = String(config.timezone || "Asia/Kuala_Lumpur");
  for (const [index, item] of items.entries()) {
    const contentType = String(item.contentType || item.content_type || ""),
      platforms = (
        Array.isArray(item.platforms)
          ? item.platforms
          : Array.isArray(item.plannedPlatforms)
            ? item.plannedPlatforms
            : Array.isArray(item.planned_platforms)
              ? item.planned_platforms
              : []
      ).map(canonicalSocialPlatform);
    if (!platforms.length)
      return `Content ${index + 1} requires at least one Planned Platform.`;
    const invalid = platforms.filter(
      (platform: string) => !allowed.includes(platform),
    );
    if (invalid.length)
      return `Content ${index + 1} selected unavailable Project Platforms: ${invalid.join(", ")}.`;
    if (
      platforms.includes("TikTok") &&
      !platformAllowedForContent("TikTok", contentType)
    )
      return `Content ${index + 1} can use TikTok only when Content Type is Reel.`;
    const schedules = Array.isArray(item.publishingSchedule)
      ? item.publishingSchedule
      : Array.isArray(item.publishing_schedule)
        ? item.publishing_schedule
        : [];
    for (const platform of platforms) {
      const row = schedules.find(
          (entry: any) => canonicalSocialPlatform(entry.platform) === platform,
        ),
        scheduledAt = String(row?.scheduledAt || row?.scheduled_at || ""),
        scheduled = Date.parse(scheduledAt);
      if (!scheduledAt || !Number.isFinite(scheduled))
        return `Content ${index + 1} requires a valid Publishing Date and Time for ${platform}.`;
      const localDate = dateInTimeZone(new Date(scheduled), timeZone);
      if (startsAt && endsAt && (localDate < startsAt || localDate > endsAt))
        return `Content ${index + 1} ${platform} schedule must stay inside Batch ${String(batch?.batchNumber || "").padStart(2, "0")} (${startsAt} to ${endsAt}, ${timeZone}). The preparation window is not a publishing window.`;
    }
  }
  return null;
}
async function batchProfileError(db: any, projectId: string, data: any) {
  if (!AUTOPOST_ENABLED) return null;
  const items = Array.isArray(data?.content_items)
    ? data.content_items
    : Array.isArray(data?.items)
      ? data.items
      : [];
  for (const [index, item] of items.entries()) {
    const platforms = (
        Array.isArray(item.platforms)
          ? item.platforms
          : Array.isArray(item.plannedPlatforms)
            ? item.plannedPlatforms
            : Array.isArray(item.planned_platforms)
              ? item.planned_platforms
              : []
      ).map(canonicalSocialPlatform),
      schedules = Array.isArray(item.publishingSchedule)
        ? item.publishingSchedule
        : Array.isArray(item.publishing_schedule)
          ? item.publishing_schedule
          : [];
    for (const platform of platforms) {
      const schedule =
          schedules.find(
            (row: any) => canonicalSocialPlatform(row.platform) === platform,
          ) || {},
        requested = String(
          schedule.socialConnectionId || schedule.social_connection_id || "",
        ),
        rows = await db
          .prepare(
            "SELECT connection_id AS connectionId FROM project_social_connections WHERE project_id=? AND platform=? AND status='Connected'",
          )
          .bind(projectId, platform)
          .all(),
        profiles = rows.results as any[];
      if (!profiles.length)
        return `Content ${index + 1} cannot be approved until ${platform} has a connected Project Profile.`;
      if (profiles.length > 1 && !requested)
        return `Content ${index + 1} must select which ${platform} Profile will publish this post.`;
      if (requested && !profiles.some((row) => row.connectionId === requested))
        return `Content ${index + 1} selected a ${platform} Profile that is not connected to this Project.`;
    }
  }
  return null;
}
async function ensureAssetTable(_db: any) {
  return;
}
async function ensureNextContinuousBatch(db: any) {
  const projects = await db
    .prepare(
      "SELECT id FROM projects WHERE project_type_code IN ('Internal Social Account','Client Social Account') AND project_mode='continuous'",
    )
    .all();
  for (const project of projects.results as any[]) {
    const active = await db
      .prepare(
        "SELECT id,cycle_id AS cycleId,batch_number AS batchNumber,ends_at AS endsAt,planned_count AS plannedCount FROM production_batches WHERE project_id=? AND status IN ('Active','Completed') ORDER BY batch_number DESC LIMIT 1",
      )
      .bind(project.id)
      .first<any>();
    if (!active?.endsAt) continue;
    const later = await db
      .prepare(
        "SELECT id FROM production_batches WHERE project_id=? AND batch_number>? LIMIT 1",
      )
      .bind(project.id, Number(active.batchNumber))
      .first<any>();
    if (later) continue;
    const start = new Date(`${active.endsAt}T00:00:00Z`);
    start.setUTCDate(start.getUTCDate() + 1);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 13);
    await db
      .prepare(
        "INSERT INTO production_batches(project_id,cycle_id,batch_number,starts_at,ends_at,status,gate_status,planned_count,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        project.id,
        active.cycleId,
        Number(active.batchNumber) + 1,
        start.toISOString().slice(0, 10),
        end.toISOString().slice(0, 10),
        "Locked",
        "Locked",
        Number(active.plannedCount || 0),
        new Date().toISOString(),
      )
      .run();
  }
}
async function ensureSocialBatchLearningPhases(db: any) {
  const projects = await db
      .prepare(
        "SELECT id FROM projects WHERE project_type_code IN ('Internal Social Account','Client Social Account') AND project_mode='continuous'",
      )
      .all(),
    now = new Date().toISOString();
  for (const project of projects.results as any[]) {
    const existing = await db
      .prepare(
        "SELECT id FROM phase_records WHERE project_id=? AND phase_key='batch-learning'",
      )
      .bind(project.id)
      .first<any>();
    if (existing) continue;
    const publishing = await db
      .prepare(
        "SELECT position FROM phase_records WHERE project_id=? AND phase_key='publishing'",
      )
      .bind(project.id)
      .first<any>();
    if (!publishing) continue;
    const position = Number(publishing.position) + 1;
    await db.batch([
      db
        .prepare(
          "UPDATE phase_records SET position=position+1,updated_at=? WHERE project_id=? AND position>=?",
        )
        .bind(now, project.id, position),
      db
        .prepare(
          "INSERT INTO phase_records(project_id,phase_key,position,label,review_kind,status,data,version,opened_at,approved_at,updated_at) VALUES(?,'batch-learning',?,'Batch Performance & Learning','none','Approved','{}',1,?,?,?)",
        )
        .bind(project.id, position, now, now, now),
    ]);
  }
}
async function cancelOutOfWindowPrematurePublishingRecords(db: any) {
  const rows = await db
      .prepare(
        "SELECT r.id,r.job_id AS jobId,r.project_id AS projectId,r.batch_id AS batchId,r.scheduled_at AS scheduledAt,b.batch_number AS batchNumber,b.starts_at AS startsAt,b.ends_at AS endsAt,p.project_config AS projectConfig FROM publishing_records r JOIN production_batches b ON b.id=r.batch_id AND b.project_id=r.project_id JOIN projects p ON p.id=r.project_id WHERE b.status IN ('Planning','Locked') AND r.status NOT IN ('PUBLISHED','CANCELLED') AND r.scheduled_at IS NOT NULL",
      )
      .all(),
    invalid = (rows.results as any[]).filter((row) => {
      const timeZone = String(
          parseJson(row.projectConfig, {}).timezone || "Asia/Kuala_Lumpur",
        ),
        localDate = dateInTimeZone(new Date(row.scheduledAt), timeZone);
      return localDate < row.startsAt || localDate > row.endsAt;
    });
  if (!invalid.length) return 0;
  const now = new Date().toISOString(),
    reason =
      "Cancelled because the publishing date falls outside its future Batch window.",
    statements: any[] = [];
  for (const row of invalid) {
    statements.push(
      db
        .prepare(
          "UPDATE publishing_records SET status='CANCELLED',error_code='OUT_OF_BATCH_WINDOW',error_message=?,requires_human_action=0,updated_at=? WHERE id=? AND status NOT IN ('PUBLISHED','CANCELLED')",
        )
        .bind(reason, now, row.id),
    );
    if (row.jobId)
      statements.push(
        db
          .prepare(
            "UPDATE orchestrator_jobs SET status='CANCELLED',last_error=?,completed_at=?,updated_at=? WHERE id=? AND status!='SUCCEEDED'",
          )
          .bind(reason, now, now, row.jobId),
      );
  }
  for (const projectId of new Set(
    invalid.map((row) => String(row.projectId)),
  )) {
    const affected = invalid.filter((row) => row.projectId === projectId);
    statements.push(
      db
        .prepare(
          "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(
          projectId,
          "premature_out_of_window_publishing_cancelled",
          "system:data-integrity",
          JSON.stringify({
            reason,
            records: affected.map((row) => ({
              recordId: row.id,
              batchId: row.batchId,
              batchNumber: row.batchNumber,
              scheduledAt: row.scheduledAt,
              startsAt: row.startsAt,
              endsAt: row.endsAt,
            })),
          }),
          now,
        ),
    );
  }
  await db.batch(statements);
  return invalid.length;
}
async function normalizeSocialProjectWorkspace(db: any) {
  const now = new Date().toISOString();
  await db
    .prepare(
      "UPDATE projects SET project_status='Active',phase_status='In Progress',stage='Publishing · Active',assignment_stage='Publishing',assignment_status='Ongoing',progress=99 WHERE project_type_code IN ('Internal Social Account','Client Social Account') AND project_mode='continuous' AND (assignment_stage='Batch Performance & Learning' OR stage LIKE 'Batch Performance & Learning%')",
    )
    .run();
  await db
    .prepare(
      "UPDATE phase_records SET status='Approved',approved_at=COALESCE(approved_at,?),updated_at=? WHERE phase_key='batch-learning' AND project_id IN (SELECT id FROM projects WHERE project_type_code IN ('Internal Social Account','Client Social Account') AND project_mode='continuous' AND (assignment_stage='Batch Performance & Learning' OR stage LIKE 'Batch Performance & Learning%')) AND status!='Approved'",
    )
    .bind(now, now)
    .run();
  await db
    .prepare(
      "UPDATE phase_records SET status='Locked',opened_at=NULL,approved_at=NULL,updated_at=? WHERE phase_key='batch-learning' AND EXISTS (SELECT 1 FROM production_batches batch WHERE batch.project_id=phase_records.project_id AND batch.status='Planning')",
    )
    .bind(now)
    .run();
}
async function reconcileCompletedSocialBatches(db: any) {
  const candidates = await db
      .prepare(
        "SELECT b.id,b.project_id AS projectId,b.batch_number AS batchNumber FROM production_batches b JOIN projects p ON p.id=b.project_id WHERE p.project_type_code IN ('Internal Social Account','Client Social Account') AND p.project_mode='continuous' AND b.status IN ('Active','Overdue') ORDER BY b.project_id,b.batch_number",
      )
      .all(),
    now = new Date().toISOString();
  for (const batch of candidates.results as any[]) {
    const summary = await db
      .prepare(
        "SELECT COUNT(*) AS total,SUM(CASE WHEN status IN ('PUBLISHED','MANUAL_EXCEPTION') THEN 1 ELSE 0 END) AS completed,SUM(CASE WHEN status='PUBLISHED' AND (post_url IS NULL OR trim(post_url)='') THEN 1 ELSE 0 END) AS missingLive FROM publishing_records WHERE project_id=? AND batch_id=? AND status!='CANCELLED'",
      )
      .bind(batch.projectId, batch.id)
      .first<any>();
    const total = Number(summary?.total || 0),
      completed = Number(summary?.completed || 0),
      missingLive = Number(summary?.missingLive || 0);
    if (!total || completed !== total || missingLive) continue;
    const next = await db
        .prepare(
          "SELECT batch_number AS batchNumber,starts_at AS startsAt FROM production_batches WHERE project_id=? AND batch_number>? ORDER BY batch_number LIMIT 1",
        )
        .bind(batch.projectId, batch.batchNumber)
        .first<any>(),
      batchLabel = String(batch.batchNumber).padStart(2, "0"),
      nextLabel = next
        ? String(next.batchNumber).padStart(2, "0")
        : String(Number(batch.batchNumber) + 1).padStart(2, "0");
    await db.batch([
      db
        .prepare(
          "UPDATE production_batches SET status='Completed',gate_status='Approved' WHERE id=?",
        )
        .bind(batch.id),
      db
        .prepare(
          "UPDATE projects SET project_status='Active',phase_status='Approved',stage=?,assignment_stage='2-Week Batch Ideas',assignment_status=?,progress=100 WHERE id=?",
        )
        .bind(
          `Recurring Project · Batch ${batchLabel} Complete`,
          `Batch ${batchLabel} Complete · Waiting for Batch ${nextLabel} Planning`,
          batch.projectId,
        ),
      db
        .prepare(
          "UPDATE agent_project_controls SET active=0,status=?,updated_at=?,last_error=NULL WHERE project_id=? AND last_error IS NULL",
        )
        .bind(
          `Scope Completed · Batch ${batchLabel} Published`,
          now,
          batch.projectId,
        ),
      db
        .prepare(
          "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(
          batch.projectId,
          "social_batch_completed",
          "system:lifecycle",
          JSON.stringify({
            batchId: batch.id,
            batchNumber: Number(batch.batchNumber),
            publishingRecords: total,
            rule: "All records PUBLISHED or MANUAL_EXCEPTION; every PUBLISHED record has a Live URL. Performance sync does not block completion.",
          }),
          now,
        ),
    ]);
  }
}
async function reconcileSocialBatchPlanning(db: any) {
  const candidates = await db
      .prepare(
        "SELECT b.id,b.project_id AS projectId,b.batch_number AS batchNumber,b.starts_at AS startsAt,b.status,p.project_config AS projectConfig FROM production_batches b JOIN projects p ON p.id=b.project_id WHERE p.project_type_code IN ('Internal Social Account','Client Social Account') AND p.project_mode='continuous' AND b.status IN ('Locked','Planning') AND b.starts_at IS NOT NULL ORDER BY b.project_id,b.batch_number",
      )
      .all(),
    now = new Date(),
    nowIso = now.toISOString();
  for (const batch of candidates.results as any[]) {
    const config = parseJson(batch.projectConfig, {}),
      previous = await db
        .prepare(
          "SELECT id,status,batch_number AS batchNumber FROM production_batches WHERE project_id=? AND batch_number<? ORDER BY batch_number DESC LIMIT 1",
        )
        .bind(batch.projectId, batch.batchNumber)
        .first<any>();
    if (previousBatchBlocksPlanning(config, previous)) {
      await db
        .prepare(
          "UPDATE production_batches SET status='Locked',gate_status='Locked' WHERE id=? AND status='Planning'",
        )
        .bind(batch.id)
        .run();
      continue;
    }
    const timeZone = String(config.timezone || "Asia/Kuala_Lumpur"),
      today = dateInTimeZone(now, timeZone),
      window = socialBatchPlanningWindow(String(batch.startsAt), today);
    if (
      window.isActive &&
      (allowsOverlappingBatches(config) || String(batch.status) === "Planning")
    ) {
      await db
        .prepare(
          "UPDATE production_batches SET status='Active' WHERE id=? AND status IN ('Locked','Planning')",
        )
        .bind(batch.id)
        .run();
      continue;
    }
    if (String(batch.status) === "Planning") {
      await db
        .prepare(
          "UPDATE phase_records SET status='Locked',opened_at=NULL,approved_at=NULL,updated_at=? WHERE project_id=? AND phase_key='batch-learning' AND status='Approved'",
        )
        .bind(nowIso, batch.projectId)
        .run();
      continue;
    }
    if (!window.isPlanningOpen && !window.isActive) continue;
    const boundary = await db
      .prepare(
        "SELECT ideas.position AS ideasPosition,learning.position AS learningPosition,publishing.position AS publishingPosition FROM phase_records ideas JOIN phase_records learning ON learning.project_id=ideas.project_id AND learning.phase_key='batch-learning' JOIN phase_records publishing ON publishing.project_id=ideas.project_id AND publishing.phase_key='publishing' WHERE ideas.project_id=? AND ideas.phase_key='batch-ideas'",
      )
      .bind(batch.projectId)
      .first<any>();
    if (!boundary) continue;
    const unfinished = await db
      .prepare(
        "SELECT COUNT(*) AS count FROM phase_records WHERE project_id=? AND position>=? AND position<? AND status!='Approved'",
      )
      .bind(
        batch.projectId,
        boundary.ideasPosition,
        boundary.publishingPosition,
      )
      .first<any>();
    if (Number(unfinished?.count || 0) > 0) continue;
    const batchLabel = String(batch.batchNumber).padStart(2, "0"),
      agentStatus = `Ready · Batch ${batchLabel} Planning`;
    await db.batch([
      db
        .prepare(
          "UPDATE production_batches SET status='Planning' WHERE id=? AND status='Locked'",
        )
        .bind(batch.id),
      db
        .prepare(
          "UPDATE phase_records SET data='{}',status=CASE WHEN phase_key='batch-ideas' THEN 'In Progress' ELSE 'Locked' END,version=0,opened_at=CASE WHEN phase_key='batch-ideas' THEN ? ELSE NULL END,approved_at=NULL,updated_at=? WHERE project_id=? AND position>=? AND position<=?",
        )
        .bind(
          nowIso,
          nowIso,
          batch.projectId,
          boundary.ideasPosition,
          boundary.learningPosition,
        ),
      db
        .prepare(
          "UPDATE projects SET project_status='Active',phase_status='In Progress',stage=?,assignment_stage='2-Week Batch Ideas',assignment_status='Ongoing',approval_title=NULL,progress=40 WHERE id=?",
        )
        .bind(
          `Recurring Project · Batch ${batchLabel} Planning`,
          batch.projectId,
        ),
      db
        .prepare(
          "INSERT INTO agent_project_controls(project_id,agent_id,active,stop_phase_key,status,activated_at,updated_at,last_phase_key,last_error) VALUES(?,'agent:milla-im',0,'content-production',?,?,?,'batch-ideas',NULL) ON CONFLICT(project_id) DO UPDATE SET active=0,status=excluded.status,updated_at=excluded.updated_at,last_phase_key='batch-ideas',last_error=NULL WHERE agent_project_controls.last_error IS NULL AND (agent_project_controls.status LIKE 'Scope Completed%' OR agent_project_controls.status LIKE 'Ready%')",
        )
        .bind(batch.projectId, agentStatus, nowIso, nowIso),
      db
        .prepare(
          "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(
          batch.projectId,
          "social_batch_planning_opened",
          "system:lifecycle",
          JSON.stringify({
            batchId: Number(batch.id),
            batchNumber: Number(batch.batchNumber),
            planningStartsAt: window.planningStartsAt,
            startsAt: String(batch.startsAt),
            timeZone,
            previousBatchHistory: "preserved",
          }),
          nowIso,
        ),
    ]);
  }
}
async function startReadySocialBatchPlanningAgents(db: any, env: any) {
  const rows = await db
    .prepare(
      "SELECT batch.project_id AS projectId,batch.batch_number AS batchNumber,control.status FROM production_batches batch JOIN agent_project_controls control ON control.project_id=batch.project_id JOIN phase_records ideas ON ideas.project_id=batch.project_id AND ideas.phase_key='batch-ideas' WHERE batch.status='Planning' AND control.active=0 AND control.last_error IS NULL AND control.status LIKE 'Ready · Batch % Planning' AND ideas.status='In Progress'",
    )
    .all();
  for (const row of rows.results as any[]) {
    const batchLabel = String(row.batchNumber).padStart(2, "0"),
      starting = `Agent Starting · Batch ${batchLabel} Planning`,
      now = new Date().toISOString(),
      claimed = await db
        .prepare(
          "UPDATE agent_project_controls SET active=1,status=?,updated_at=? WHERE project_id=? AND active=0 AND status=?",
        )
        .bind(starting, now, row.projectId, row.status)
        .run();
    if (!Number(claimed?.meta?.changes || 0)) continue;
    try {
      await runProject(db, env, String(row.projectId), false);
    } catch (error: any) {
      const message = String(error?.message || error);
      await db.batch([
        db
          .prepare(
            "UPDATE agent_project_controls SET active=0,status=?,last_error=?,updated_at=? WHERE project_id=?",
          )
          .bind(
            `Agent Needs Attention · Batch ${batchLabel} Planning`,
            message,
            new Date().toISOString(),
            row.projectId,
          ),
        db
          .prepare(
            "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
          )
          .bind(
            row.projectId,
            "social_batch_planning_agent_failed",
            "system:lifecycle",
            JSON.stringify({ batchNumber: Number(row.batchNumber), message }),
            new Date().toISOString(),
          ),
      ]);
    }
  }
}
async function repairIncompleteSocialProduction(db: any) {
  const now = new Date().toISOString();
  const candidates = await db
    .prepare(
      "SELECT p.id,cp.id AS contentPhaseId,cp.data AS contentData,rp.id AS reelPhaseId,rp.status AS reelStatus FROM projects p JOIN phase_records cp ON cp.project_id=p.id AND cp.phase_key='content-production' LEFT JOIN phase_records rp ON rp.project_id=p.id AND rp.phase_key='reel-video-production' WHERE p.project_type_code IN ('Internal Social Account','Client Social Account') AND p.project_mode='continuous' AND cp.status='Approved'",
    )
    .all();
  for (const row of candidates.results as any[]) {
    const batchRow = await db
        .prepare(
          "SELECT approved_content AS content FROM approved_phase_snapshots WHERE project_id=? AND phase_key='batch-ideas' ORDER BY version DESC LIMIT 1",
        )
        .bind(row.id)
        .first<any>(),
      batch = parseJson(batchRow?.content, {}),
      production = parseJson(row.contentData, {}),
      issues = productionAssetCountIssues(batch, production);
    if (!issues.length) continue;
    const marker = await db
      .prepare(
        "SELECT 1 AS found FROM audit_log WHERE project_id=? AND event_type='social_production_asset_count_repair' LIMIT 1",
      )
      .bind(row.id)
      .first<any>();
    if (marker) continue;
    const items = Array.isArray(production.production_items)
        ? production.production_items
        : [],
      accepted = items.flatMap((item: any, index: number) => {
        const contentId = String(
            item.contentId || item.content_id || `content_${index + 1}`,
          ),
          hasFirst = (Array.isArray(item.assets) ? item.assets : []).some(
            (asset: any, assetIndex: number) =>
              Number(
                asset.assetNumber || asset.asset_number || assetIndex + 1,
              ) === 1,
          );
        return [
          `production_items.${contentId}.copy`,
          ...(hasFirst ? [`production_items.${contentId}.asset.1`] : []),
        ];
      });
    production._acceptedReviewFields = Array.from(
      new Set([
        ...(Array.isArray(production._acceptedReviewFields)
          ? production._acceptedReviewFields
          : []),
        ...accepted,
      ]),
    );
    production._imageReviewStage = "remaining_images";
    delete production.reviewNote;
    delete production.reviewFeedback;
    const cancelled = await cancelProjectJobs(
      db,
      row.id,
      "system:migration",
      "Incomplete Content Production asset plan repaired",
    );
    if (row.reelPhaseId)
      await db
        .prepare(
          "UPDATE phase_records SET status='Locked',opened_at=NULL,updated_at=? WHERE id=?",
        )
        .bind(now, row.reelPhaseId)
        .run();
    await db.batch([
      db
        .prepare(
          "UPDATE phase_records SET status='In Progress',data=?,approved_at=NULL,updated_at=? WHERE id=?",
        )
        .bind(JSON.stringify(production), now, row.contentPhaseId),
      db
        .prepare(
          "UPDATE publishing_records SET status='CANCELLED',error_code='SOURCE_ASSETS_INCOMPLETE',error_message='Superseded after Content Production asset-count repair.',updated_at=? WHERE project_id=? AND status!='PUBLISHED' AND job_id IN (SELECT id FROM orchestrator_jobs WHERE project_id=? AND job_type='PUBLISH_JOB' AND status='CANCELLED')",
        )
        .bind(now, row.id, row.id),
      db
        .prepare(
          "UPDATE projects SET project_status='Active',phase_status='In Progress',stage='Content Production · In Progress',assignment_stage='Content Production',assignment_status='Needs Attention · Resume remaining images',approval_title=NULL,progress=67 WHERE id=?",
        )
        .bind(row.id),
      db
        .prepare(
          "UPDATE agent_project_controls SET status='Agent Needs Attention · Resume remaining images',active=0,updated_at=? WHERE project_id=?",
        )
        .bind(now, row.id),
      db
        .prepare(
          "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(
          row.id,
          "social_production_asset_count_repair",
          "system:migration",
          JSON.stringify({
            issues,
            cancelledJobs: cancelled,
            preserved: "Existing first images and upscaled masters",
            nextStage: "remaining_images",
          }),
          now,
        ),
    ]);
  }
}
async function recoverEmptyContinuationReview(db: any) {
  const now = new Date().toISOString(),
    candidates = await db
      .prepare(
        "SELECT p.id,cp.id AS phaseId,cp.data FROM projects p JOIN phase_records cp ON cp.project_id=p.id AND cp.phase_key='content-production' WHERE p.project_type_code IN ('Internal Social Account','Client Social Account') AND p.project_mode='continuous' AND cp.status='Reviewing'",
      )
      .all();
  for (const row of candidates.results as any[]) {
    const production = parseJson(row.data, {});
    if (production._imageReviewStage !== "remaining_images") continue;
    const batchRow = await db
        .prepare(
          "SELECT approved_content AS content FROM approved_phase_snapshots WHERE project_id=? AND phase_key='batch-ideas' ORDER BY version DESC LIMIT 1",
        )
        .bind(row.id)
        .first<any>(),
      issues = productionAssetCountIssues(
        parseJson(batchRow?.content, {}),
        production,
      );
    if (!issues.length) continue;
    await db.batch([
      db
        .prepare(
          "UPDATE phase_records SET status='In Progress',updated_at=? WHERE id=?",
        )
        .bind(now, row.phaseId),
      db
        .prepare(
          "UPDATE projects SET project_status='Active',phase_status='In Progress',stage='Content Production · Missing Images Recovery',assignment_stage='Content Production',assignment_status='Needs Attention · Resume missing images',approval_title=NULL WHERE id=?",
        )
        .bind(row.id),
      db
        .prepare(
          "UPDATE agent_project_controls SET active=0,status='Needs Attention · Resume missing continuation images',last_error=?,updated_at=? WHERE project_id=?",
        )
        .bind(issues.join("; "), now, row.id),
      db
        .prepare(
          "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(
          row.id,
          "empty_continuation_review_recovered",
          "system:repair",
          JSON.stringify({
            issues,
            preserved: "Approved copy and first images",
            nextAction: "Resume Task",
          }),
          now,
        ),
    ]);
  }
}
async function recoverStaleContentReviewAcceptance(db: any) {
  const candidates = await db
      .prepare(
        "SELECT id,project_id AS projectId,data FROM phase_records WHERE phase_key='content-production' AND status='Reviewing'",
      )
      .all(),
    now = new Date().toISOString();
  for (const row of candidates.results as any[]) {
    const data = parseJson(row.data, {});
    if (
      Array.isArray(data._acceptedReviewFields) &&
      data._acceptedReviewFields.length
    )
      continue;
    const lastRetake = await db
      .prepare(
        "SELECT event_data AS eventData,created_at AS createdAt FROM audit_log WHERE project_id=? AND event_type='phase_retake' AND json_extract(event_data,'$.phaseKey')='content-production' ORDER BY id DESC LIMIT 1",
      )
      .bind(row.projectId)
      .first<any>();
    if (!lastRetake) continue;
    const review = parseJson(lastRetake.eventData, {}),
      accepted = Array.isArray(review.acceptedFields)
        ? review.acceptedFields
            .filter((key: any) => String(key).startsWith("production_items."))
            .map(String)
        : [];
    if (!accepted.length) continue;
    const currentRunAt = Date.parse(String(data._agentRunAt || "")),
      retakeAt = Date.parse(String(lastRetake.createdAt || ""));
    if (
      !Number.isFinite(currentRunAt) ||
      !Number.isFinite(retakeAt) ||
      currentRunAt < retakeAt ||
      currentRunAt - retakeAt > 24 * 60 * 60 * 1000
    )
      continue;
    const superseding = await db
      .prepare(
        "SELECT id FROM audit_log WHERE project_id=? AND event_type IN ('agent_phase_submitted','agent_phase_revised') AND created_at>? ORDER BY id DESC LIMIT 1",
      )
      .bind(row.projectId, lastRetake.createdAt)
      .first<any>();
    if (!superseding) continue;
    data._acceptedReviewFields = accepted;
    data._imageReviewStage =
      data._imageReviewStage === "remaining_images"
        ? "remaining_images"
        : "first_images";
    await db.batch([
      db
        .prepare("UPDATE phase_records SET data=?,updated_at=? WHERE id=?")
        .bind(JSON.stringify(data), now, row.id),
      db
        .prepare(
          "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(
          row.projectId,
          "stale_content_review_acceptance_recovered",
          "system:review-integrity",
          JSON.stringify({
            acceptedFields: accepted,
            sourceRetakeAt: lastRetake.createdAt,
            reason:
              "Late Agent result overwrote a newer management review state",
          }),
          now,
        ),
    ]);
  }
}
async function recoverEmptyReelWorkingDrafts(db: any) {
  const rows = await db
      .prepare(
        "SELECT id,project_id AS projectId,status,data FROM phase_records WHERE phase_key='reel-video-production' AND status IN ('In Progress','Retake','Reviewing')",
      )
      .all(),
    stamp = new Date().toISOString();
  for (const row of rows.results as any[]) {
    const activeGeneration = await db
      .prepare(
        "SELECT COUNT(*) AS count FROM orchestrator_jobs WHERE project_id=? AND job_type='VIDEO_GENERATION' AND status IN ('QUEUED','RUNNING','WAITING_PROVIDER','RETRY_PENDING')",
      )
      .bind(row.projectId)
      .first<any>();
    if (Number(activeGeneration?.count || 0) > 0) continue;
    const current = parseJson(row.data, {}),
      currentItems = Array.isArray(current.reel_video_items)
        ? current.reel_video_items
        : [];
    if (currentItems.length) continue;
    const approved = await db
        .prepare(
          "SELECT approved_content AS content FROM approved_phase_snapshots WHERE project_id=? AND phase_key='content-production' ORDER BY version DESC LIMIT 1",
        )
        .bind(row.projectId)
        .first<any>(),
      approvedProduction = parseJson(approved?.content, {}),
      expected = (
        Array.isArray(approvedProduction.production_items)
          ? approvedProduction.production_items
          : []
      ).filter(
        (item: any) =>
          String(item.contentType || item.content_type).toLowerCase() ===
          "reel",
      ),
      expectedIds = expected
        .map((item: any) => String(item.contentId || item.content_id))
        .filter(Boolean);
    if (!expectedIds.length) continue;
    let checkpoint: any = null,
      checkpointId: number | null = null;
    const durableCheckpoints = await db
      .prepare(
        "SELECT id,event_data AS eventData FROM audit_log WHERE project_id=? AND event_type='reel_prompt_review_checkpoint' ORDER BY id DESC LIMIT 50",
      )
      .bind(row.projectId)
      .all();
    for (const candidate of durableCheckpoints.results as any[]) {
      const envelope = parseJson(candidate.eventData, {});
      if (reelCheckpointMatchesApproved(envelope, approvedProduction)) {
        checkpoint = envelope.content;
        checkpointId = Number(candidate.id);
        break;
      }
    }
    if (!checkpoint) {
      const checkpoints = await db
        .prepare(
          "SELECT id,event_type AS eventType,payload,created_at AS createdAt FROM drive_sync_queue WHERE project_id=? AND event_type IN ('phase_retake','current_phase_record','agent_prompt_saved') ORDER BY id DESC LIMIT 50",
        )
        .bind(row.projectId)
        .all();
      for (const candidate of checkpoints.results as any[]) {
        const envelope = parseJson(candidate.payload, {});
        if (reelCheckpointMatchesApproved(envelope, approvedProduction)) {
          checkpoint = envelope.content;
          checkpointId = Number(candidate.id);
          break;
        }
      }
    }
    if (!checkpoint) continue;
    const batchId = Number(approvedProduction._productionBatchId) || null,
      expectedItemKeys = expectedIds.map((contentId: string) =>
        socialBatchAssetKey(batchId, `${contentId}-video`),
      ),
      marks = expectedItemKeys.map(() => "?").join(","),
      currentVideos = expectedItemKeys.length
        ? await db
            .prepare(
              `SELECT item_key AS itemKey FROM visual_asset_revisions WHERE project_id=? AND phase='reel-video-production' AND item_key IN (${marks}) AND is_current=1 AND mime_type LIKE 'video/%'`,
            )
            .bind(row.projectId, ...expectedItemKeys)
            .all()
        : { results: [] },
      currentVideoKeys = new Set(
        (currentVideos.results as any[]).map((asset: any) =>
          String(asset.itemKey),
        ),
      ),
      allGenerated = expectedItemKeys.every((key: string) =>
        currentVideoKeys.has(key),
      );
    if (allGenerated) {
      const restored = {
        ...checkpoint,
        _reelStage: "generated_review",
        reel_video_items: (checkpoint.reel_video_items || []).map(
          (item: any) => ({ ...item, generationStatus: "Generated Reel ready" }),
        ),
      };
      for (const key of [
        "_videoGenerationParentJobId",
        "_videoGenerationJobIds",
        "_reelRetryContentIds",
        "_workingDraftStatus",
        "_validationIssues",
        "_workingDraftSavedAt",
        "reviewNote",
        "reviewFeedback",
        "_acceptedReviewFields",
      ])
        delete restored[key];
      await db.batch([
        db
          .prepare(
            "UPDATE phase_records SET data=?,status='Reviewing',updated_at=? WHERE id=?",
          )
          .bind(JSON.stringify(restored), stamp, row.id),
        db
          .prepare(
            "UPDATE projects SET phase_status='Reviewing',stage='Reel Video Production · Reviewing',assignment_stage='Reel Video Production',assignment_status='Awaiting Approval',approval_title=NULL WHERE id=?",
          )
          .bind(row.projectId),
        db
          .prepare(
            "UPDATE agent_project_controls SET active=1,status='Agent Standing By · Awaiting Management Review',last_phase_key='reel-video-production',last_error=NULL,updated_at=? WHERE project_id=?",
          )
          .bind(stamp, row.projectId),
        db
          .prepare(
            "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
          )
          .bind(
            row.projectId,
            "empty_generated_reel_review_recovered",
            "system:review-integrity",
            JSON.stringify({
              checkpointId,
              restoredContentIds: expectedIds,
              currentVersionsOnly: true,
              nextAction: "Management Review",
            }),
            stamp,
          ),
      ]);
      continue;
    }
    const retakes = await db
      .prepare(
        "SELECT event_data AS eventData FROM audit_log WHERE project_id=? AND event_type='phase_retake' AND json_extract(event_data,'$.phaseKey')='reel-video-production' ORDER BY id DESC LIMIT 50",
      )
      .bind(row.projectId)
      .all();
    let review: any = {};
    for (const candidate of retakes.results as any[]) {
      const event = parseJson(candidate.eventData, {});
      if (reelRetakeMatchesApproved(event, approvedProduction)) {
        review = event;
        break;
      }
    }
    const restored = {
      ...checkpoint,
      _reelStage: "style_configured",
      _workingDraftStatus: "Needs Correction",
      _validationIssues: [
        "The last complete same-Batch Reel setup was restored after an empty Retake result. Resume Task to regenerate Reel-specific prompts.",
      ],
      _workingDraftSavedAt: stamp,
      reviewNote: String(review.note || "Reel prompt revision required"),
      reviewFeedback:
        review.fieldFeedback && typeof review.fieldFeedback === "object"
          ? review.fieldFeedback
          : {},
      _acceptedReviewFields: Array.isArray(review.acceptedFields)
        ? review.acceptedFields
        : [],
      _reelRetryContentIds: reelRetakeContentIds(
        review.fieldFeedback,
        Array.isArray(checkpoint.reel_video_items)
          ? checkpoint.reel_video_items
          : [],
      ),
    };
    for (const key of [
      "promptApprovedAt",
      "promptApprovedBy",
      "_videoGenerationParentJobId",
      "_videoGenerationJobIds",
    ])
      delete restored[key];
    await db.batch([
      db
        .prepare(
          "UPDATE phase_records SET data=?,status='Retake',updated_at=? WHERE id=?",
        )
        .bind(JSON.stringify(restored), stamp, row.id),
      db
        .prepare(
          "UPDATE projects SET phase_status='Retake',stage='Reel Video Production · Prompt Retake',assignment_stage='Reel Video Production',assignment_status='Revision Requested',approval_title=NULL WHERE id=?",
        )
        .bind(row.projectId),
      db
        .prepare(
          "UPDATE agent_project_controls SET active=0,status='Agent Needs Attention · Resume Reel Prompt Retake',last_phase_key='reel-video-production',last_error=?,updated_at=? WHERE project_id=?",
        )
        .bind(
          "Recovered the last complete Reel setup after an empty Agent revision. Resume Task to regenerate prompts.",
          stamp,
          row.projectId,
        ),
      db
        .prepare(
          "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(
          row.projectId,
          "empty_reel_working_draft_recovered",
          "system:review-integrity",
          JSON.stringify({
            checkpointId,
            restoredContentIds: expectedIds,
            nextAction: "Resume Task",
            generationStarted: false,
          }),
          stamp,
        ),
    ]);
  }
}
async function quarantineCrossBatchReelDrafts(db: any) {
  const rows = await db
      .prepare(
        "SELECT id,project_id AS projectId,status,data FROM phase_records WHERE phase_key='reel-video-production' AND status IN ('In Progress','Retake','Reviewing')",
      )
      .all(),
    stamp = new Date().toISOString();
  for (const row of rows.results as any[]) {
    const activeGeneration = await db
      .prepare(
        "SELECT COUNT(*) AS count FROM orchestrator_jobs WHERE project_id=? AND job_type='VIDEO_GENERATION' AND status IN ('QUEUED','RUNNING','WAITING_PROVIDER','RETRY_PENDING')",
      )
      .bind(row.projectId)
      .first<any>();
    if (Number(activeGeneration?.count || 0) > 0) continue;
    const current = parseJson(row.data, {}),
      items = Array.isArray(current.reel_video_items)
        ? current.reel_video_items
        : [];
    if (!items.length) continue;
    const approved = await db
        .prepare(
          "SELECT approved_content AS content FROM approved_phase_snapshots WHERE project_id=? AND phase_key='content-production' ORDER BY version DESC LIMIT 1",
        )
        .bind(row.projectId)
        .first<any>(),
      approvedProduction = parseJson(approved?.content, {});
    if (reelCheckpointMatchesApproved(current, approvedProduction)) continue;
    const reset = freshReelSetup(approvedProduction),
      oldBatchId = Number(current._productionBatchId) || null,
      newBatchId = Number(reset._productionBatchId) || null;
    await db.batch([
      db
        .prepare(
          "UPDATE phase_records SET data=?,status='In Progress',approved_at=NULL,updated_at=? WHERE id=?",
        )
        .bind(JSON.stringify(reset), stamp, row.id),
      db
        .prepare(
          "UPDATE projects SET phase_status='In Progress',stage='Reel Video Production · Select Reel Style',assignment_stage='Reel Video Production',assignment_status='Ready · Tier 0–1 Reel Style Selection',approval_title=NULL WHERE id=?",
        )
        .bind(row.projectId),
      db
        .prepare(
          "UPDATE agent_project_controls SET active=0,status='Ready · Tier 0–1 Reel Style Selection',last_phase_key='reel-video-production',last_error=NULL,updated_at=? WHERE project_id=?",
        )
        .bind(stamp, row.projectId),
      db
        .prepare(
          "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(
          row.projectId,
          "cross_batch_reel_draft_quarantined",
          "system:review-integrity",
          JSON.stringify({
            oldBatchId,
            newBatchId,
            preservedHistory: true,
            reason:
              "Reel working draft did not match the latest approved Content Production Batch, titles and approved Anchor lineage.",
          }),
          stamp,
        ),
    ]);
  }
}
async function reconcileReelPromptDimensions(db: any, env: any) {
  const rows = await db
      .prepare(
        "SELECT id,project_id AS projectId,status,data FROM phase_records WHERE phase_key='reel-video-production' AND status IN ('In Progress','Reviewing')",
      )
      .all(),
    stamp = new Date().toISOString();
  for (const row of rows.results as any[]) {
    const data = parseJson(row.data, {}),
      items = Array.isArray(data.reel_video_items) ? data.reel_video_items : [];
    let changed = false,
      integrityIssue = "";
    const approved = await db
        .prepare(
          "SELECT approved_content AS content FROM approved_phase_snapshots WHERE project_id=? AND phase_key='content-production' ORDER BY version DESC LIMIT 1",
        )
        .bind(row.projectId)
        .first<any>(),
      approvedProduction = parseJson(approved?.content, {}),
      expectedIds = (
        Array.isArray(approvedProduction.production_items)
          ? approvedProduction.production_items
          : []
      )
        .filter(
          (item: any) =>
            String(item.contentType || item.content_type).toLowerCase() ===
            "reel",
        )
        .map((item: any) => String(item.contentId || item.content_id))
        .filter(Boolean),
      itemIds = items
        .map((item: any) => String(item.contentId || item.content_id))
        .filter(Boolean),
      exactItemSet =
        expectedIds.length > 0 &&
        items.length === expectedIds.length &&
        new Set(itemIds).size === expectedIds.length &&
        expectedIds.every((id: string) => itemIds.includes(id));
    const batch = await db
      .prepare(
        "SELECT id FROM production_batches WHERE project_id=? AND status IN ('Active','Planning') ORDER BY CASE WHEN status='Active' THEN 0 ELSE 1 END,batch_number DESC LIMIT 1",
      )
      .bind(row.projectId)
      .first<any>();
    const fallbackReference = await db
      .prepare(
        "SELECT id,project_id AS projectId,phase,item_key AS itemKey,version,storage_key AS storageKey,file_name AS fileName,mime_type AS mimeType,is_current AS isCurrent FROM visual_asset_revisions WHERE project_id=? AND phase='references' AND is_current=1 AND mime_type LIKE 'image/%' ORDER BY CASE WHEN item_key='character-reference' THEN 0 ELSE 1 END,version DESC,id DESC LIMIT 1",
      )
      .bind(row.projectId)
      .first<any>();
    for (const [index, item] of items.entries()) {
      if (
        !Number(item.referenceAssetId || item.characterReferenceAssetId) &&
        fallbackReference?.id
      ) {
        item.referenceAssetId = Number(fallbackReference.id);
        item.referenceRole = String(
          fallbackReference.itemKey || "PROJECT_REFERENCE",
        )
          .replace(/-reference$/i, "")
          .replaceAll("-", "_")
          .toUpperCase();
        item.reference = fallbackReference;
        changed = true;
      }
      if (
        String(item.compiledVideoPrompt || "").trim() &&
        !followsReelPromptFormula(String(item.compiledVideoPrompt || ""))
      ) {
        item.compiledVideoPrompt = lockReelVideoPrompt(
          String(item.compiledVideoPrompt || ""),
          item,
          item,
        );
        changed = true;
      }
      if (
        String(item.aspectRatio || "") &&
        Number(item.videoWidth) > 0 &&
        Number(item.videoHeight) > 0
      )
        continue;
      let firstFrameId =
        Number(
          item.firstFrameAssetId ||
            item.first_frame_asset_id ||
            item.firstFrame?.id,
        ) || 0;
      if (!firstFrameId && batch?.id) {
        const contentId = String(
            item.contentId || item.content_id || `content_${index + 1}`,
          ),
          current = await db
            .prepare(
              "SELECT id FROM visual_asset_revisions WHERE project_id=? AND phase='content-production' AND item_key=? AND is_current=1 AND mime_type LIKE 'image/%' ORDER BY version DESC,id DESC LIMIT 1",
            )
            .bind(row.projectId, `batch-${batch.id}-${contentId}-asset-1`)
            .first<any>();
        firstFrameId = Number(current?.id) || 0;
      }
      if (!firstFrameId) continue;
      const asset = await db
        .prepare(
          "SELECT id,storage_key AS storageKey,file_name AS fileName,mime_type AS mimeType,version FROM visual_asset_revisions WHERE id=? AND project_id=? AND phase='content-production' AND mime_type LIKE 'image/%' LIMIT 1",
        )
        .bind(firstFrameId, row.projectId)
        .first<any>();
      if (!asset) continue;
      const object = await env.BUCKET.get(asset.storageKey);
      if (!object) continue;
      const dimensions = imageDimensions(
        new Uint8Array(await object.arrayBuffer()),
        asset.mimeType,
      );
      if (!dimensions) continue;
      const normalized = normalizeI2VPromptItem(item, {
        contentId: String(
          item.contentId || item.content_id || `content_${index + 1}`,
        ),
        title: String(item.title || `Reel ${index + 1}`),
        subjectPresence: item.subjectPresence || item.subject_presence,
        firstFrameAssetId: asset.id,
        referenceAssetId:
          item.referenceAssetId ||
          item.characterReferenceAssetId ||
          fallbackReference?.id ||
          null,
        referenceRole:
          item.referenceRole ||
          String(fallbackReference?.itemKey || "PROJECT_REFERENCE")
            .replace(/-reference$/i, "")
            .replaceAll("-", "_")
            .toUpperCase(),
        sourceWidth: dimensions.width,
        sourceHeight: dimensions.height,
      });
      Object.assign(item, normalized, {
        reelStyle: item.reelStyle,
        workflowId: item.workflowId,
        firstFrame: {
          ...(item.firstFrame || {}),
          id: asset.id,
          fileName: asset.fileName,
          width: dimensions.width,
          height: dimensions.height,
          version: asset.version,
        },
        reference:
          item.reference ||
          (Number(normalized.referenceAssetId) === Number(fallbackReference?.id)
            ? fallbackReference
            : null),
      });
      changed = true;
    }
    if (!data._reelStage && data._workingDraftStatus === "Needs Correction") {
      data._reelStage = "style_configured";
      changed = true;
    }
    if (
      expectedIds.length &&
      !exactItemSet &&
      (data._reelStage === "prompt_review" || row.status === "Reviewing")
    ) {
      integrityIssue = `Expected ${expectedIds.length} Reel item${expectedIds.length === 1 ? "" : "s"} (${expectedIds.join(", ")}), received ${itemIds.length} (${itemIds.join(", ") || "none"}).`;
      data._reelStage = "style_configured";
      data._workingDraftStatus = "Needs Correction";
      data._validationIssues = [`Reel Review blocked: ${integrityIssue}`];
      data._workingDraftSavedAt = stamp;
      row.status = "Retake";
      changed = true;
    }
    const promptComplete =
      exactItemSet &&
      data._workingDraftStatus !== "Needs Correction" &&
      items.every(
        (item: any) =>
          String(item.reelStyle || "") &&
          Number(item.referenceAssetId || item.characterReferenceAssetId) &&
          String(item.compiledVideoPrompt || "").trim() &&
          followsReelPromptFormula(String(item.compiledVideoPrompt || "")) &&
          String(item.aspectRatio || "") &&
          Number(item.videoWidth) > 0 &&
          Number(item.videoHeight) > 0,
      );
    const ready = promptComplete && data._reelStage === "style_configured";
    if (ready) {
      data._reelStage = "prompt_review";
      delete data._validationIssues;
      delete data._workingDraftStatus;
      delete data._workingDraftSavedAt;
      row.status = "Reviewing";
      changed = true;
    }
    if (promptComplete && data._reelStage === "prompt_review" && row.status !== "Reviewing") {
      row.status = "Reviewing";
      delete data._validationIssues;
      delete data._workingDraftStatus;
      delete data._workingDraftSavedAt;
      changed = true;
    }
    if (data._reelStage === "prompt_review")
      await db
        .prepare(
          "UPDATE agent_project_controls SET active=1,status='Agent Standing By · Awaiting Reel Prompt Review',last_phase_key='reel-video-production',last_error=NULL,updated_at=? WHERE project_id=? AND status!='Agent Standing By · Awaiting Reel Prompt Review'",
        )
        .bind(stamp, row.projectId)
        .run();
    if (!changed) continue;
    await db
      .prepare(
        "UPDATE phase_records SET data=?,status=?,updated_at=? WHERE id=?",
      )
      .bind(JSON.stringify(data), row.status, stamp, row.id)
      .run();
    if (ready)
      await db.batch([
        db
          .prepare(
            "UPDATE projects SET phase_status='Reviewing',stage='Reel Video Production · Prompt Review',assignment_stage='Reel Video Production',assignment_status='Awaiting Approval',approval_title=NULL WHERE id=?",
          )
          .bind(row.projectId),
        db
          .prepare(
            "UPDATE agent_project_controls SET active=1,status='Agent Standing By · Awaiting Reel Prompt Review',last_phase_key='reel-video-production',last_error=NULL,updated_at=? WHERE project_id=?",
          )
          .bind(stamp, row.projectId),
      ]);
    else if (integrityIssue)
      await db.batch([
        db
          .prepare(
            "UPDATE projects SET phase_status='Retake',stage='Reel Video Production · Prompt Retake',assignment_stage='Reel Video Production',assignment_status='Revision Requested',approval_title=NULL WHERE id=?",
          )
          .bind(row.projectId),
        db
          .prepare(
            "UPDATE agent_project_controls SET active=0,status='Agent Needs Attention · Reel item integrity check',last_phase_key='reel-video-production',last_error=?,updated_at=? WHERE project_id=?",
          )
          .bind(integrityIssue, stamp, row.projectId),
      ]);
  }
}
async function recoverLegacyReelContractFailure(db: any) {
  const rows = await db
      .prepare(
        "SELECT pr.id,pr.project_id AS projectId,pr.data,j.id AS jobId,j.last_error AS lastError FROM phase_records pr JOIN orchestrator_jobs j ON j.id=(SELECT id FROM orchestrator_jobs WHERE project_id=pr.project_id AND job_type='AGENT_TASK' ORDER BY updated_at DESC LIMIT 1) WHERE pr.phase_key='reel-video-production' AND pr.status='In Progress' AND json_extract(pr.data,'$._reelStage')='generation' AND j.status='FAILED'",
      )
      .all(),
    stamp = new Date().toISOString();
  for (const row of rows.results as any[]) {
    if (
      !String(row.lastError || "").startsWith(
        "RunningHub MiniMax H3 mapping is incomplete:",
      )
    )
      continue;
    const children = await db
      .prepare(
        "SELECT COUNT(*) AS count FROM orchestrator_jobs WHERE parent_job_id=? AND job_type='VIDEO_GENERATION'",
      )
      .bind(row.jobId)
      .first<any>();
    if (Number(children?.count || 0) > 0) continue;
    const data = parseJson(row.data, {});
    data._reelStage = "prompt_review";
    delete data.promptApprovedAt;
    delete data.promptApprovedBy;
    await db.batch([
      db
        .prepare(
          "UPDATE phase_records SET data=?,status='Reviewing',updated_at=? WHERE id=?",
        )
        .bind(JSON.stringify(data), stamp, row.id),
      db
        .prepare(
          "UPDATE projects SET phase_status='Reviewing',stage='Reel Video Production · Prompt Review',assignment_stage='Reel Video Production',assignment_status='Awaiting Approval',approval_title=NULL WHERE id=?",
        )
        .bind(row.projectId),
      db
        .prepare(
          "UPDATE agent_project_controls SET active=1,status='Agent Standing By · Awaiting Management Review',last_error=NULL,updated_at=? WHERE project_id=?",
        )
        .bind(stamp, row.projectId),
      db
        .prepare(
          "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(
          row.projectId,
          "legacy_reel_mapping_failure_recovered",
          "system:workflow-contract",
          JSON.stringify({
            failedJobId: row.jobId,
            recoveredTo: "prompt_review",
            reason:
              "Obsolete FrameFlow graph semantics blocked approval before any video job was created.",
          }),
          stamp,
        ),
    ]);
  }
}
async function recoverApprovedReelAnchorLineageFailure(db: any) {
  const rows = await db
      .prepare(
        "SELECT pr.project_id AS projectId,j.id AS jobId,j.last_error AS lastError FROM phase_records pr JOIN orchestrator_jobs j ON j.id=(SELECT id FROM orchestrator_jobs WHERE project_id=pr.project_id AND job_type='AGENT_TASK' ORDER BY updated_at DESC LIMIT 1) JOIN agent_project_controls c ON c.project_id=pr.project_id WHERE pr.phase_key='reel-video-production' AND pr.status='In Progress' AND json_extract(pr.data,'$._reelStage')='generation' AND j.status='FAILED' AND c.last_error=j.last_error",
      )
      .all(),
    stamp = new Date().toISOString();
  for (const row of rows.results as any[]) {
    const error = String(row.lastError || "");
    if (
      !error.includes("Approved Content Anchor is missing") &&
      !error.includes("no valid approved first_frame exists") &&
      !error.includes("no same-Batch Content Anchor image existed")
    )
      continue;
    const children = await db
      .prepare(
        "SELECT COUNT(*) AS count FROM orchestrator_jobs WHERE parent_job_id=? AND job_type='VIDEO_GENERATION'",
      )
      .bind(row.jobId)
      .first<any>();
    if (Number(children?.count || 0) > 0) continue;
    await db.batch([
      db
        .prepare(
          "UPDATE projects SET phase_status='In Progress',stage='Reel Video Production · Ready to Resume Generation',assignment_stage='Reel Video Production',assignment_status='Ready · Resume Approved Reel Generation',approval_title=NULL WHERE id=?",
        )
        .bind(row.projectId),
      db
        .prepare(
          "UPDATE agent_project_controls SET active=1,status='Ready · Resume Approved Reel Generation',last_error=NULL,updated_at=? WHERE project_id=?",
        )
        .bind(stamp, row.projectId),
      db
        .prepare(
          "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(
          row.projectId,
          "approved_reel_anchor_lineage_failure_recovered",
          "system:review-integrity",
          JSON.stringify({
            failedJobId: row.jobId,
            generationStarted: false,
            nextAction: "Resume Task",
            reason:
              "Legacy approved Content snapshot omitted approvedAnchorImage metadata or used a pre-Batch asset key; same-Batch approval-time evidence is now supported.",
          }),
          stamp,
        ),
    ]);
  }
}
async function recoverReelAspectRatioValidationFailure(db: any) {
  const rows = await db
      .prepare(
        "SELECT pr.id,pr.project_id AS projectId,j.id AS jobId,j.last_error AS lastError FROM phase_records pr JOIN orchestrator_jobs j ON j.id=(SELECT id FROM orchestrator_jobs WHERE project_id=pr.project_id AND job_type='VIDEO_GENERATION' ORDER BY updated_at DESC LIMIT 1) WHERE pr.phase_key='reel-video-production' AND pr.status='Retake' AND j.status='FAILED'",
      )
      .all(),
    stamp = new Date().toISOString();
  for (const row of rows.results as any[]) {
    const error = String(row.lastError || "");
    if (
      !error.includes("value_not_in_list") ||
      !error.includes("aspect_ratio") ||
      !error.includes('"29"')
    )
      continue;
    const active = await db
      .prepare(
        "SELECT COUNT(*) AS count FROM orchestrator_jobs WHERE project_id=? AND job_type IN ('AGENT_TASK','VIDEO_GENERATION') AND status IN ('QUEUED','RUNNING','WAITING_PROVIDER','RETRY_PENDING')",
      )
      .bind(row.projectId)
      .first<any>();
    if (Number(active?.count || 0) > 0) continue;
    const approved = await db
        .prepare(
          "SELECT final_approved_version AS content,approved_at AS approvedAt FROM phase_generation_records WHERE project_id=? AND phase_key='reel-video-production' AND final_approved_version IS NOT NULL AND approved_at IS NOT NULL ORDER BY approved_at DESC,id DESC LIMIT 1",
        )
        .bind(row.projectId)
        .first<any>(),
      data = parseJson(approved?.content, {}),
      items = Array.isArray(data.reel_video_items) ? data.reel_video_items : [];
    if (
      !items.length ||
      items.some(
        (item: any) =>
          !String(item.compiledVideoPrompt || "").trim() ||
          !Number(item.firstFrameAssetId) ||
          !Number(item.referenceAssetId || item.characterReferenceAssetId),
      )
    )
      continue;
    data._reelStage = "generation";
    delete data._videoGenerationParentJobId;
    delete data._videoGenerationJobIds;
    for (const item of items) {
      item.reelStyle = "IMAGE_TO_VIDEO";
      item.reelType = "IMAGE_TO_VIDEO";
      item.workflowId = "2096500485405868034";
      delete item.generationStatus;
    }
    await db.batch([
      db
        .prepare(
          "UPDATE phase_records SET data=?,status='In Progress',updated_at=? WHERE id=?",
        )
        .bind(JSON.stringify(data), stamp, row.id),
      db
        .prepare(
          "UPDATE projects SET phase_status='In Progress',stage='Reel Video Production · Ready to Resume Generation',assignment_stage='Reel Video Production',assignment_status='Ready · Resume Approved Reel Generation',approval_title=NULL WHERE id=?",
        )
        .bind(row.projectId),
      db
        .prepare(
          "UPDATE agent_project_controls SET active=1,status='Ready · Resume Approved Reel Generation',last_error=NULL,updated_at=? WHERE project_id=?",
        )
        .bind(stamp, row.projectId),
      db
        .prepare(
          "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(
          row.projectId,
          "reel_aspect_ratio_validation_failure_recovered",
          "system:runninghub-adapter",
          JSON.stringify({
            failedJobId: row.jobId,
            approvedAt: approved.approvedAt,
            generationStarted: false,
            nextAction: "Resume Task",
            node29ValueWillUseProviderEnum: true,
          }),
          stamp,
        ),
    ]);
  }
}
async function recoverApprovedReelProviderFailure(db: any) {
  const rows = await db
      .prepare(
        "SELECT pr.id,pr.project_id AS projectId,j.id AS jobId,j.last_error AS lastError FROM phase_records pr JOIN orchestrator_jobs j ON j.id=(SELECT id FROM orchestrator_jobs WHERE project_id=pr.project_id AND job_type='VIDEO_GENERATION' AND status IN ('FAILED','CANCELLED') ORDER BY updated_at DESC LIMIT 1) WHERE pr.phase_key='reel-video-production' AND pr.status='Retake'",
      )
      .all(),
    stamp = new Date().toISOString();
  for (const row of rows.results as any[]) {
    const active = await db
      .prepare(
        "SELECT COUNT(*) AS count FROM orchestrator_jobs WHERE project_id=? AND job_type IN ('AGENT_TASK','VIDEO_GENERATION') AND status IN ('QUEUED','RUNNING','WAITING_PROVIDER','RETRY_PENDING')",
      )
      .bind(row.projectId)
      .first<any>();
    if (Number(active?.count || 0) > 0) continue;
    const approved = await db
        .prepare(
          "SELECT final_approved_version AS content,approved_at AS approvedAt FROM phase_generation_records WHERE project_id=? AND phase_key='reel-video-production' AND final_approved_version IS NOT NULL AND approved_at IS NOT NULL ORDER BY approved_at DESC,id DESC LIMIT 1",
        )
        .bind(row.projectId)
        .first<any>(),
      latestRetake = await db
        .prepare(
          "SELECT created_at AS createdAt FROM audit_log WHERE project_id=? AND event_type='phase_retake' AND json_extract(event_data,'$.phaseKey')='reel-video-production' ORDER BY id DESC LIMIT 1",
        )
        .bind(row.projectId)
        .first<any>(),
      latestApproval = await db
        .prepare(
          "SELECT created_at AS createdAt FROM audit_log WHERE project_id=? AND event_type='reel_prompt_approved' AND json_extract(event_data,'$.phaseKey')='reel-video-production' ORDER BY id DESC LIMIT 1",
        )
        .bind(row.projectId)
        .first<any>();
    if (
      !approved?.content ||
      unresolvedReelPromptRetake(latestRetake?.createdAt, [
        latestApproval?.createdAt,
        approved.approvedAt,
      ])
    )
      continue;
    const data = approvedReelGenerationRetryData(parseJson(approved.content, {}));
    if (!data) continue;
    await db.batch([
      db
        .prepare(
          "UPDATE phase_records SET data=?,status='In Progress',updated_at=? WHERE id=?",
        )
        .bind(JSON.stringify(data), stamp, row.id),
      db
        .prepare(
          "UPDATE projects SET phase_status='In Progress',stage='Reel Video Production · Ready to Retry Provider',assignment_stage='Reel Video Production',assignment_status='Ready · Resume Approved Reel Generation',approval_title=NULL WHERE id=?",
        )
        .bind(row.projectId),
      db
        .prepare(
          "UPDATE agent_project_controls SET active=0,status='Needs Attention · Resume approved Reel generation',last_phase_key='reel-video-production',last_error=?,updated_at=? WHERE project_id=?",
        )
        .bind(
          String(row.lastError || "RunningHub Reel generation failed."),
          stamp,
          row.projectId,
        ),
      db
        .prepare(
          "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(
          row.projectId,
          "approved_reel_provider_failure_recovered",
          "system:runninghub-adapter",
          JSON.stringify({
            failedJobId: row.jobId,
            approvedAt: approved.approvedAt,
            nextAction: "Resume Task",
            retryUsesApprovedPrompt: true,
          }),
          stamp,
        ),
    ]);
  }
}
async function clearNFillarReelForRedesign(db: any) {
  const projectId = "PRJ-0002",
    eventType = "nfillar_reel_redesign_reset_20260905",
    marker = await db
      .prepare(
        "SELECT 1 AS found FROM audit_log WHERE project_id=? AND event_type=? LIMIT 1",
      )
      .bind(projectId, eventType)
      .first<any>();
  if (marker) return;
  const project = await db
    .prepare(
      "SELECT id FROM projects WHERE id=? AND project_type_code IN ('Internal Social Account','Client Social Account')",
    )
    .bind(projectId)
    .first<any>();
  if (!project) return;
  const now = new Date().toISOString(),
    content = await db
      .prepare(
        "SELECT status FROM phase_records WHERE project_id=? AND phase_key='content-production'",
      )
      .bind(projectId)
      .first<any>();
  await db.batch([
    db
      .prepare(
        "UPDATE phase_records SET data='{}',status='Locked',version=0,opened_at=NULL,approved_at=NULL,updated_at=? WHERE project_id=? AND phase_key='reel-video-production'",
      )
      .bind(now, projectId),
    db
      .prepare(
        "UPDATE agent_project_controls SET active=0,stop_phase_key='content-production',status=?,updated_at=?,last_error=NULL WHERE project_id=?",
      )
      .bind(
        content?.status === "Approved"
          ? "Scope Completed · Content Production Approved · Reel Redesign Pending"
          : "Paused · Complete Content Production · Reel Redesign Pending",
        now,
        projectId,
      ),
    db
      .prepare(
        "UPDATE projects SET stage='Content Production · Approved · Reel Redesign Pending',phase_status='Approved',assignment_stage='Reel Video Production',assignment_status='Locked · Awaiting new Prompt Structure and RunningHub workflow',approval_title=NULL WHERE id=? AND EXISTS (SELECT 1 FROM phase_records WHERE project_id=? AND phase_key='content-production' AND status='Approved')",
      )
      .bind(projectId, projectId),
    db
      .prepare(
        "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
      )
      .bind(
        projectId,
        eventType,
        "system:migration",
        JSON.stringify({
          reelDataCleared: true,
          reelStatus: "Locked",
          agentActive: false,
          stopPhase: "content-production",
          contentProductionStatus: String(content?.status || "Unknown"),
          preserved: "Content Production images and upscaled masters",
        }),
        now,
      ),
  ]);
}
async function openRegisteredSocialReelProduction(db: any) {
  const candidates = await db
      .prepare(
        "SELECT p.id,reel.id AS reelPhaseId FROM projects p JOIN phase_records content ON content.project_id=p.id AND content.phase_key='content-production' AND content.status='Approved' JOIN phase_records reel ON reel.project_id=p.id AND reel.phase_key='reel-video-production' AND reel.status='Locked' WHERE p.project_type_code IN ('Internal Social Account','Client Social Account')",
      )
      .all(),
    stamp = new Date().toISOString();
  for (const row of candidates.results as any[])
    await db.batch([
      db
        .prepare(
          "UPDATE phase_records SET status='In Progress',opened_at=COALESCE(opened_at,?),updated_at=? WHERE id=? AND status='Locked'",
        )
        .bind(stamp, stamp, row.reelPhaseId),
      db
        .prepare(
          "UPDATE projects SET phase_status='In Progress',stage='Reel Video Production · Select Reel Style',assignment_stage='Reel Video Production',assignment_status='Ready · Tier 0–1 Reel Style Selection',approval_title=NULL WHERE id=?",
        )
        .bind(row.id),
      db
        .prepare(
          "UPDATE agent_project_controls SET active=0,stop_phase_key='reel-video-production',status='Ready · Tier 0–1 Reel Style Selection',updated_at=?,last_phase_key='reel-video-production',last_error=NULL WHERE project_id=?",
        )
        .bind(stamp, row.id),
      db
        .prepare(
          "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(
          row.id,
          "registered_social_reel_production_opened",
          "system:lifecycle",
          JSON.stringify({
            reason:
              "Content Production Approved and IMAGE_TO_VIDEO workflow registered",
            nextAction:
              "Tier 0–1 selects one Reel Style per Reel before Agent prompt generation",
          }),
          stamp,
        ),
    ]);
}
async function access(req: Request, db: any) {
  await db
    .prepare(
      "INSERT OR IGNORE INTO members(email,name,tier,status,created_at) VALUES(?,?,?,?,?)",
    )
    .bind(OWNER_EMAIL, "Hana Lim", 0, "Active", new Date().toISOString())
    .run();
  const email = requestUserEmail(req),
    member = await db
      .prepare("SELECT email,name,tier,status FROM members WHERE email=?")
      .bind(email)
      .first<{ email: string; name: string; tier: number; status: string }>();
  return { email, member };
}
export async function GET(req: Request) {
  const db = await runtimeDb(),
    a = await access(req, db);
  if (!a.member)
    return Response.json(
      { error: "Workspace membership required" },
      { status: 403 },
    );
  await prepareProductionWorkspace(db);
  const today = new Date().toISOString().slice(0, 10);
  await ensureRequestedSocialBatchPolicies(db);
  await cancelOutOfWindowPrematurePublishingRecords(db);
  await db
    .prepare(
      "UPDATE production_batches SET status='Overdue' WHERE status='Active' AND ends_at<? AND gate_status!='Approved'",
    )
    .bind(today)
    .run();
  await db
    .prepare(
      "UPDATE production_batches SET status=CASE WHEN EXISTS (SELECT 1 FROM projects p WHERE p.id=production_batches.project_id AND p.project_type_code IN ('Internal Social Account','Client Social Account') AND p.project_mode='continuous') THEN 'Overdue' ELSE 'Completed' END WHERE status='Active' AND ends_at<? AND gate_status='Approved'",
    )
    .bind(today)
    .run();
  await reconcileCompletedSocialBatches(db);
  await ensureNextContinuousBatch(db);
  await reconcileSocialBatchPlanning(db);
  await ensureSocialBatchLearningPhases(db);
  await normalizeSocialProjectWorkspace(db);
  await repairIncompleteSocialProduction(db);
  await recoverEmptyContinuationReview(db);
  await recoverStaleContentReviewAcceptance(db);
  await quarantineCrossBatchReelDrafts(db);
  await recoverEmptyReelWorkingDrafts(db);
  const { env } = await import("cloudflare:workers");
  await reconcileReelPromptDimensions(db, env);
  await recoverLegacyReelContractFailure(db);
  await recoverApprovedReelAnchorLineageFailure(db);
  await recoverReelAspectRatioValidationFailure(db);
  await recoverApprovedReelProviderFailure(db);
  await clearNFillarReelForRedesign(db);
  await openRegisteredSocialReelProduction(db);
  await db
    .prepare(
      "UPDATE phase_records AS target SET status='Locked',opened_at=NULL,updated_at=? WHERE target.status IN ('In Progress','Reopened') AND EXISTS (SELECT 1 FROM projects p WHERE p.id=target.project_id AND p.project_type_code='AI Reels') AND EXISTS (SELECT 1 FROM phase_records prior WHERE prior.project_id=target.project_id AND prior.position<target.position AND prior.phase_key!='payment-status' AND prior.status!='Approved')",
    )
    .bind(new Date().toISOString())
    .run();
  await db
    .prepare(
      "UPDATE projects SET approval_title=NULL WHERE approval_title IS NOT NULL AND EXISTS (SELECT 1 FROM phase_records canonical WHERE canonical.project_id=projects.id)",
    )
    .run();
  await startReadySocialBatchPlanningAgents(db, env);
  const r =
    a.member.tier === 0
      ? await db
          .prepare(`SELECT ${baseColumns} FROM projects ORDER BY created_at`)
          .all()
      : await db
          .prepare(
            `SELECT ${baseColumns} FROM projects p WHERE EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id=p.id AND pm.member_email=?) ORDER BY p.created_at`,
          )
          .bind(a.email)
          .all();
  const phaseRows = await db
    .prepare(
      "SELECT project_id AS projectId,phase_key AS phaseKey,position,label,review_kind AS reviewKind,max_reviews AS maxReviews,status,data,version,opened_at AS openedAt,approved_at AS approvedAt FROM phase_records ORDER BY project_id,position",
    )
    .all();
  const snapshotRows = await db
    .prepare(
      "SELECT project_id AS projectId,phase_key AS phaseKey,phase_label AS phaseLabel,version,approved_content AS approvedContent,approved_by AS approvedBy,approved_at AS approvedAt,formula_id AS formulaId,formula_version AS formulaVersion,generation_method AS generationMethod,demo_data AS demoData,learning_status AS learningStatus FROM approved_phase_snapshots ORDER BY project_id,phase_key,version",
    )
    .all();
  const changeRows = await db
    .prepare(
      "SELECT id,project_id AS projectId,phase_key AS phaseKey,requested_by AS requestedBy,request_note AS requestNote,status,created_at AS createdAt FROM change_requests WHERE status='Requested' ORDER BY created_at",
    )
    .all();
  await ensureAssetTable(db);
  const slots = await db
      .prepare(
        "SELECT id,project_id AS projectId,slot_number AS slotNumber,purpose,status,phase_status AS phaseStatus,data FROM video_slots ORDER BY project_id,slot_number",
      )
      .all(),
    cycles = await db
      .prepare(
        "SELECT id,project_id AS projectId,cycle_type AS cycleType,starts_at AS startsAt,ends_at AS endsAt,status,configuration FROM production_cycles ORDER BY id DESC",
      )
      .all(),
    batches = await db
      .prepare(
        "SELECT id,project_id AS projectId,cycle_id AS cycleId,batch_number AS batchNumber,starts_at AS startsAt,ends_at AS endsAt,status,gate_status AS gateStatus,planned_count AS plannedCount FROM production_batches ORDER BY project_id,batch_number",
      )
      .all(),
    keyshotAssets = await db
      .prepare(
        "SELECT id,project_id AS projectId,phase,item_key AS itemKey,version,storage_key AS storageKey,file_name AS fileName,mime_type AS mimeType FROM visual_asset_revisions WHERE is_current=1 AND phase LIKE 'video-slot-%-keyshots' ORDER BY item_key,version DESC",
      )
      .all(),
    projectReferenceAssets = await db
      .prepare(
        "SELECT id,project_id AS projectId,phase,item_key AS itemKey,version,storage_key AS storageKey,file_name AS fileName,mime_type AS mimeType,is_current AS isCurrent FROM visual_asset_revisions WHERE phase='references' AND mime_type LIKE 'image/%' ORDER BY project_id,is_current DESC,version DESC,id DESC",
      )
      .all(),
    outstanding = await db
      .prepare(
        "SELECT id,project_id AS projectId,original_cycle_id AS originalCycleId,content_type AS contentType,title,status FROM content_items WHERE is_outstanding=1 ORDER BY created_at",
      )
      .all(),
    reviewCounts = await db
      .prepare(
        "SELECT project_id AS projectId,scope_id AS phaseKey,COUNT(*) AS used FROM review_sessions GROUP BY project_id,scope_id",
      )
      .all();
  for (const row of slots.results as any[]) {
    const data = parseJson(row.data, {});
    if (data.phases?.script?.status === "Approved" && !data.phases?.keyshots) {
      data.phases.keyshots = { status: "In Progress", content: {} };
      data.currentPhase = "Keyshot Image Set · Client Review";
      row.data = JSON.stringify(data);
    }
  }
  const attentionRows = await db
      .prepare(
        `SELECT p.id,CASE WHEN p.assignment_status IN ('Revision Requested','Awaiting Approval') OR p.assignment_status LIKE '%Needs Attention%' OR EXISTS (SELECT 1 FROM agent_project_controls ac WHERE ac.project_id=p.id AND ac.status LIKE '%Needs Attention%') OR EXISTS (SELECT 1 FROM publishing_records pr WHERE pr.project_id=p.id AND pr.status='NEEDS_ATTENTION' AND pr.requires_human_action=1) THEN 1 ELSE 0 END AS actionRequired,CASE WHEN p.assignment_status='Revision Requested' THEN 'Revision feedback must be addressed' WHEN p.assignment_status='Awaiting Approval' THEN 'Management approval is waiting' WHEN p.assignment_status LIKE '%Needs Attention%' THEN p.assignment_status WHEN EXISTS (SELECT 1 FROM agent_project_controls ac WHERE ac.project_id=p.id AND ac.status LIKE '%Needs Attention%') THEN 'Agent needs attention' WHEN EXISTS (SELECT 1 FROM publishing_records pr WHERE pr.project_id=p.id AND pr.status='NEEDS_ATTENTION' AND pr.requires_human_action=1) THEN 'Publishing needs management attention' ELSE NULL END AS attentionReason FROM projects p`,
      )
      .all(),
    attentionByProject = new Map(
      (attentionRows.results as any[]).map((row) => [row.id, row]),
    );
  const projects = (r.results as any[]).map((project) => ({
    ...project,
    ...(attentionByProject.get(project.id) || {
      actionRequired: 0,
      attentionReason: null,
    }),
    projectConfig: {
      timezone: "Asia/Kuala_Lumpur",
      ...parseJson(project.projectConfig, {}),
    },
    approvedSnapshots: (snapshotRows.results as any[])
      .filter((x) => x.projectId === project.id)
      .map((x) => ({
        ...x,
        approvedContent: parseJson(x.approvedContent, {}),
      })),
    projectReferences: (projectReferenceAssets.results as any[]).filter(
      (asset) => asset.projectId === project.id,
    ),
    phaseRecords: (phaseRows.results as any[])
      .filter((x) => x.projectId === project.id)
      .map((x) => ({
        ...x,
        data: parseJson(x.data, {}),
        reviewSessionsUsed: Number(
          (reviewCounts.results as any[]).find(
            (r) => r.projectId === project.id && r.phaseKey === x.phaseKey,
          )?.used || 0,
        ),
      })),
    changeRequests: (changeRows.results as any[]).filter(
      (x) => x.projectId === project.id,
    ),
    videoSlots: (slots.results as any[])
      .filter((x) => x.projectId === project.id)
      .map((x) => ({
        ...x,
        data: parseJson(x.data, {}),
        keyshotAssets: (keyshotAssets.results as any[]).filter(
          (asset) =>
            asset.projectId === project.id &&
            asset.phase === `video-slot-${x.slotNumber}-keyshots`,
        ),
      })),
    cycles: (cycles.results as any[])
      .filter((x) => x.projectId === project.id)
      .map((x) => ({ ...x, configuration: parseJson(x.configuration, {}) })),
    batches: (batches.results as any[])
      .filter((x) => x.projectId === project.id)
      .map((batch) => {
        const end = new Date(`${batch.endsAt}T00:00:00Z`),
          todayDate = new Date(`${today}T00:00:00Z`),
          days = Math.ceil((end.getTime() - todayDate.getTime()) / 86400000);
        return {
          ...batch,
          daysToDeadline: days,
          deadlineReminder:
            batch.status === "Overdue"
              ? `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`
              : days === 0
                ? "Due today"
                : days === 1
                  ? "Due tomorrow"
                  : days <= 3
                    ? `Due in ${days} days`
                    : null,
        };
      }),
    outstandingContent: (outstanding.results as any[]).filter(
      (x) => x.projectId === project.id,
    ),
  }));
  const edits =
    a.member.tier <= 1
      ? await db
          .prepare(
            "SELECT id,project_id AS projectId,research_type AS researchType,editor_email AS editorEmail,editor_name AS editorName,editor_tier AS editorTier,changed_fields AS changedFields,created_at AS createdAt,seen_by_management AS seenByManagement FROM research_edits ORDER BY created_at DESC LIMIT 50",
          )
          .all()
      : { results: [] };
  const teams =
    a.member.tier <= 1
      ? await db
          .prepare(
            "SELECT t.id,t.name,t.lead_email AS leadEmail,COALESCE(m.name,'No Project Manager') AS leadName,(SELECT COUNT(*) FROM members x WHERE x.team_id=t.id) AS memberCount FROM teams t LEFT JOIN members m ON m.email=t.lead_email ORDER BY t.name",
          )
          .all()
      : { results: [] };
  return Response.json({
    projects,
    member: a.member,
    editNotifications: edits.results,
    teams: teams.results,
  });
}
export async function POST(req: Request) {
  const db = await runtimeDb(),
    a = await access(req, db);
  if (!a.member || a.member.tier > 1)
    return Response.json(
      { error: "Owner or Project Manager access required" },
      { status: 403 },
    );
  const b = (await req.json()) as Record<string, string>;
  if (!b.client?.trim())
    return Response.json(
      { error: "Project name is required" },
      { status: 400 },
    );
  const projectType = PROJECT_TYPES.includes(b.projectType as any)
    ? b.projectType
    : "AI Video";
  if (projectType === "Internal R&D / Lab" && a.member.tier > 1)
    return Response.json(
      { error: "Only management can create Internal R&D / Lab projects" },
      { status: 403 },
    );
  let projectMode = allowedModes(projectType).includes(b.projectMode)
    ? b.projectMode
    : allowedModes(projectType)[0];
  if (projectType === "MV") projectMode = "one_off";
  if (
    projectType === "Internal Social Account" ||
    projectType === "Client Social Account"
  )
    projectMode = "continuous";
  const purpose =
    projectType === "AI Video" &&
    projectMode !== "package" &&
    AI_VIDEO_PURPOSES.includes(b.purpose as any)
      ? b.purpose
      : null;
  const mvEntry =
    projectType === "MV" && b.mvEntry === "finished_song"
      ? "finished_song"
      : projectType === "MV"
        ? "no_song"
        : null;
  const count =
    projectMode === "recurring"
      ? Math.max(1, Number(b.frequencyCount) || 1)
      : projectMode === "package"
        ? Math.max(2, Math.min(100, Number(b.slotCount) || 5))
        : 0;
  const unit = projectMode === "recurring" ? b.frequencyUnit || "week" : null;
  const recurring =
    projectMode === "recurring"
      ? `${count} times / ${unit}`
      : projectMode === "continuous"
        ? "Continuous"
        : null;
  const config = {
    timezone: "Asia/Kuala_Lumpur",
    authorizedPlatforms: parseJson(b.authorizedPlatforms, []),
    quotas: parseJson(b.quotas, {}),
    contentQuantity: Number(b.contentQuantity) || null,
    labSource: b.labSource || null,
  };
  const row = await db
      .prepare(
        "SELECT MAX(CAST(SUBSTR(id,5) AS INTEGER)) AS count FROM projects WHERE id LIKE 'PRJ-%'",
      )
      .first<{ count: number }>(),
    id = `PRJ-${String((row?.count || 0) + 1).padStart(4, "0")}`,
    now = new Date().toISOString(),
    creator = JSON.stringify([a.email]),
    projectStatus = initialProjectStatus(projectType, projectMode),
    phases = workflowFor(projectType, projectMode, mvEntry || undefined),
    projectEndDate =
      projectMode === "package" ? null : b.projectEndDate || null;
  await db
    .prepare(
      "INSERT INTO projects(id,client,type,is_demo,project_type_code,project_mode,purpose,mv_entry,project_config,project_status,phase_status,status,stage,progress,recurring,project_nature,project_duration,frequency_count,frequency_unit,project_start_date,project_end_date,assignment_members,assignment_stage,assignment_status,assigned_at,assignment_due_at,brief_owner,due_date,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    )
    .bind(
      id,
      b.client.trim(),
      projectType,
      0,
      projectType,
      projectMode,
      purpose,
      mvEntry,
      JSON.stringify(config),
      projectStatus,
      "In Progress",
      "In production",
      `${phases[0].label} · In Progress`,
      Math.round(100 / phases.length),
      recurring,
      projectMode,
      b.projectDuration || null,
      count,
      unit,
      b.projectStartDate || null,
      projectEndDate,
      creator,
      phases[0].label,
      "Ongoing",
      now,
      projectEndDate,
      a.member.name,
      projectEndDate,
      now,
    )
    .run();
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    await db
      .prepare(
        "INSERT INTO phase_records(project_id,phase_key,position,label,review_kind,max_reviews,status,data,version,opened_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        id,
        phase.key,
        i,
        phase.label,
        phase.review,
        phase.maxReviews || null,
        i === 0 ? "In Progress" : "Locked",
        "{}",
        0,
        i === 0 ? now : null,
        now,
      )
      .run();
  }
  if (projectMode === "package")
    for (let i = 1; i <= count; i++)
      await db
        .prepare(
          "INSERT INTO video_slots(project_id,slot_number,purpose,status,phase_status,data,created_at) VALUES(?,?,?,?,?,?,?)",
        )
        .bind(id, i, purpose, "Awaiting Payment", "Locked", "{}", now)
        .run();
  const start = new Date(`${b.projectStartDate || now.slice(0, 10)}T00:00:00Z`),
    iso = (date: Date) => date.toISOString().slice(0, 10),
    plus = (days: number) => {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + days);
      return iso(d);
    };
  if (projectType === "Client Social Account") {
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    end.setUTCDate(end.getUTCDate() - 1);
    const cycle = await db
      .prepare(
        "INSERT INTO production_cycles(project_id,cycle_type,starts_at,ends_at,status,configuration,created_at) VALUES(?,?,?,?,?,?,?) RETURNING id",
      )
      .bind(
        id,
        "monthly",
        iso(start),
        iso(end),
        "Waiting Payment",
        JSON.stringify(config),
        now,
      )
      .first<any>();
    for (let i = 0; i < 2; i++)
      await db
        .prepare(
          "INSERT INTO production_batches(project_id,cycle_id,batch_number,starts_at,ends_at,status,gate_status,created_at) VALUES(?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          cycle?.id,
          i + 1,
          plus(i * 14),
          plus(i * 14 + 13),
          "Locked",
          "Locked",
          now,
        )
        .run();
  }
  if (projectType === "Internal Social Account") {
    const cycle = await db
      .prepare(
        "INSERT INTO production_cycles(project_id,cycle_type,starts_at,ends_at,status,configuration,created_at) VALUES(?,?,?,?,?,?,?) RETURNING id",
      )
      .bind(
        id,
        "continuous",
        iso(start),
        null,
        "Active",
        JSON.stringify(config),
        now,
      )
      .first<any>();
    await db
      .prepare(
        "INSERT INTO production_batches(project_id,cycle_id,batch_number,starts_at,ends_at,status,gate_status,created_at) VALUES(?,?,?,?,?,?,?,?)",
      )
      .bind(id, cycle?.id, 1, iso(start), plus(13), "Active", "Locked", now)
      .run();
  }
  if (projectType === "AI Reels") {
    const allocations =
      projectMode === "recurring"
        ? unit === "month"
          ? [Math.ceil(count / 2), Math.floor(count / 2)]
          : unit === "week"
            ? [count * 2, count * 2]
            : [count * 14, count * 14]
        : [Math.max(1, Number(config.contentQuantity) || 1)];
    const cycleConfig = {
      ...config,
      frequencyCount: projectMode === "recurring" ? count : null,
      frequencyUnit: projectMode === "recurring" ? unit : null,
      monthlyCommitment: allocations.reduce((sum, value) => sum + value, 0),
      batchAllocations: allocations,
    };
    const cycleEnd =
      projectMode === "recurring"
        ? b.projectEndDate || plus(27)
        : b.projectEndDate || plus(13);
    const cycle = await db
      .prepare(
        "INSERT INTO production_cycles(project_id,cycle_type,starts_at,ends_at,status,configuration,created_at) VALUES(?,?,?,?,?,?,?) RETURNING id",
      )
      .bind(
        id,
        projectMode === "recurring" ? "recurring" : "one_off",
        iso(start),
        cycleEnd,
        "Active",
        JSON.stringify(cycleConfig),
        now,
      )
      .first<any>();
    for (let i = 0; i < allocations.length; i++)
      await db
        .prepare(
          "INSERT INTO production_batches(project_id,cycle_id,batch_number,starts_at,ends_at,status,gate_status,planned_count,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          cycle?.id,
          i + 1,
          plus(i * 14),
          plus(i * 14 + 13),
          i === 0 ? "Active" : "Locked",
          "Locked",
          allocations[i],
          now,
        )
        .run();
  }
  if (projectType === "AI Video" && projectMode === "recurring")
    await db
      .prepare(
        "INSERT INTO production_cycles(project_id,cycle_type,starts_at,ends_at,status,configuration,created_at) VALUES(?,?,?,?,?,?,?)",
      )
      .bind(
        id,
        "recurring",
        iso(start),
        null,
        "Waiting Payment",
        JSON.stringify({ frequencyCount: count, frequencyUnit: unit }),
        now,
      )
      .run();
  await db
    .prepare(
      "INSERT OR IGNORE INTO project_members(project_id,member_email) VALUES(?,?)",
    )
    .bind(id, a.email)
    .run();
  await db
    .prepare(
      "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
    )
    .bind(
      id,
      "project_created",
      a.email,
      JSON.stringify({
        projectType,
        projectMode,
        purpose,
        mvEntry,
        config,
        slotCount: projectMode === "package" ? count : undefined,
      }),
      now,
    )
    .run();
  try {
    await createProjectDrive({
      id,
      client: b.client.trim(),
      type: projectType,
      projectType,
      projectMode,
      purpose,
      mvEntry,
      projectNature: projectMode,
    });
  } catch {
    await db
      .prepare(
        "UPDATE projects SET drive_sync_status='Pending folder sync' WHERE id=?",
      )
      .bind(id)
      .run();
  }
  return Response.json({ id, projectType, projectMode }, { status: 201 });
}
export async function DELETE(req: Request) {
  const db = await runtimeDb(),
    a = await access(req, db);
  if (!a.member || a.member.tier !== 0)
    return Response.json(
      { error: "Tier 0 Management access required" },
      { status: 403 },
    );
  const b = (await req.json()) as { id?: string },
    id = String(b.id || "");
  if (!id)
    return Response.json({ error: "Project id is required" }, { status: 400 });
  const project = await db
    .prepare("SELECT id,client,drive_url AS driveUrl FROM projects WHERE id=?")
    .bind(id)
    .first<any>();
  if (!project)
    return Response.json({ error: "Project not found" }, { status: 404 });
  const now = new Date().toISOString(),
    runtime = await import("cloudflare:workers");
  await deleteProjectObjects(runtime.env.BUCKET, [id]);
  try {
    await db
      .prepare(
        "DELETE FROM agent_file_grant_events WHERE grant_id IN (SELECT id FROM agent_file_grants WHERE project_id=?)",
      )
      .bind(id)
      .run();
  } catch {}
  try {
    await db
      .prepare(
        "DELETE FROM orchestrator_job_events WHERE job_id IN (SELECT id FROM orchestrator_jobs WHERE project_id=?)",
      )
      .bind(id)
      .run();
    await db
      .prepare(
        "DELETE FROM orchestrator_job_tokens WHERE job_id IN (SELECT id FROM orchestrator_jobs WHERE project_id=?)",
      )
      .bind(id)
      .run();
    await db
      .prepare(
        "DELETE FROM orchestrator_costs WHERE job_id IN (SELECT id FROM orchestrator_jobs WHERE project_id=?)",
      )
      .bind(id)
      .run();
  } catch {}
  for (const table of [
    "change_requests",
    "review_sessions",
    "video_slots",
    "production_cycles",
    "production_batches",
    "content_items",
    "external_review_links",
    "learning_differences",
    "phase_records",
    "publishing_records",
    "publishing_attempts",
    "project_social_connections",
    "social_performance_snapshots",
    "batch_learning_records",
    "document_versions",
    "idea_folders",
    "project_members",
    "research_edits",
    "asset_upscale_jobs",
    "visual_asset_revisions",
    "project_drive_folders",
    "production_events",
    "approved_phase_snapshots",
    "phase_generation_records",
    "generation_context_cache",
    "agent_file_grants",
    "orchestrator_jobs",
  ])
    try {
      await db
        .prepare(`DELETE FROM ${table} WHERE project_id=?`)
        .bind(id)
        .run();
    } catch {}
  await db.prepare("DELETE FROM projects WHERE id=?").bind(id).run();
  await db
    .prepare(
      "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(NULL,'project_deleted',?,?,?)",
    )
    .bind(
      a.email,
      JSON.stringify({
        projectId: id,
        projectName: project.client,
        driveFolderPreserved: Boolean(project.driveUrl),
      }),
      now,
    )
    .run();
  return Response.json({
    ok: true,
    driveFolderPreserved: Boolean(project.driveUrl),
  });
}
async function logResearchEdit(
  db: any,
  a: any,
  b: Record<string, string>,
  type: "Market" | "Trend",
) {
  const fields =
    type === "Market"
      ? [
          ["market_snapshot", "marketSnapshot", "Market snapshot"],
          ["market_opportunities", "marketOpportunities", "Opportunities"],
          ["market_direction", "marketDirection", "Recommended direction"],
          ["market_references", "marketReferences", "References"],
        ]
      : [
          ["trend_observations", "trendObservations", "Trend observations"],
          ["trend_fit", "trendFit", "Client fit"],
          ["trend_references", "trendReferences", "References"],
        ];
  const current = await db
    .prepare(
      `SELECT ${fields.map((x) => x[0]).join(",")} FROM projects WHERE id=?`,
    )
    .bind(b.id)
    .first<Record<string, string>>();
  const changed = fields
    .filter(
      ([col, key]) => String(current?.[col] || "") !== String(b[key] || ""),
    )
    .map((x) => x[2]);
  if (changed.length)
    await db
      .prepare(
        "INSERT INTO research_edits(project_id,research_type,editor_email,editor_name,editor_tier,changed_fields,created_at,seen_by_management) VALUES(?,?,?,?,?,?,?,0)",
      )
      .bind(
        b.id,
        type,
        a.email,
        a.member.name,
        a.member.tier,
        JSON.stringify(changed),
        new Date().toISOString(),
      )
      .run();
}
export async function PATCH(req: Request) {
  const db = await runtimeDb(),
    b = (await req.json()) as Record<string, string>;
  if (!b.id || !b.action)
    return Response.json({ error: "Invalid action" }, { status: 400 });
  const a = await access(req, db);
  if (!a.member)
    return Response.json(
      { error: "Workspace membership required" },
      { status: 403 },
    );
  if (a.member.tier !== 0) {
    const assigned = await db
      .prepare(
        "SELECT 1 AS ok FROM project_members WHERE project_id=? AND member_email=?",
      )
      .bind(b.id, a.email)
      .first();
    if (!assigned)
      return Response.json({ error: "Project access denied" }, { status: 403 });
    if (Number(a.member.tier) === 4) {
      const phaseKey = String(b.phaseKey || ""),
        draftPhases = [
          "strategy-direction",
          "batch-ideas",
          "content-production",
        ],
        canSave =
          b.action === "saveCanonicalPhase" && draftPhases.includes(phaseKey),
        canSubmit =
          b.action === "submitCanonicalPhase" &&
          ["strategy-direction", "batch-ideas"].includes(phaseKey),
        canRequest =
          b.action === "requestChange" && draftPhases.includes(phaseKey);
      if (!canSave && !canSubmit && !canRequest)
        return Response.json(
          {
            error:
              "Tier 4 AI Agent scope ends at the saved Content Production Prompt. A human handler must upload media and submit Internal Review.",
          },
          { status: 403 },
        );
    } else {
      const allowed =
        a.member.tier === 1
          ? [
              "extendBatch",
              "closeEmptyBatch",
              "saveCanonicalPhase",
              "submitCanonicalPhase",
              "updateApprovedReferences",
              "updateProductionReferences",
              "reviewCanonicalPhase",
              "requestChange",
              "decideChange",
              "confirmPayment",
              "setPaymentProgress",
              "configureVideoSlot",
              "saveVideoSlotCreativeDirection",
              "submitVideoSlotCreativeDirection",
              "reviewVideoSlotCreativeDirection",
              "saveVideoSlotScript",
              "submitVideoSlotScript",
              "reviewVideoSlotScript",
              "confirmDelivery",
              "confirmPaymentCleared",
              "completeProject",
              "saveBrief",
              "assign",
              "submitCombinedResearch",
              "saveFoundation",
              "submitFoundation",
              "reviewFoundation",
              "approveCombinedResearch",
              "reviseCombinedResearch",
              "dismissEdit",
              "clearEditNotifications",
              "submitMvLyrics",
              "submitMvSong",
              "reviewMvMusic",
              "submitScript",
              "approveScript",
              "reviseScript",
              "reviewScriptItems",
              "saveStoryboard",
              "saveImageGeneration",
              "saveVisualDevelopment",
              "submitVisualDevelopment",
              "submitStoryboard",
              "submitImageGeneration",
              "submitSavedProduction",
              "saveMvVisualScript",
              "submitMvVisualScript",
              "reviewMvVisualScript",
              "approveProduction",
              "reviseProduction",
              "reviewProductionItems",
            ]
          : [
              "saveCanonicalPhase",
              "submitCanonicalPhase",
              "requestChange",
              "saveVideoSlotCreativeDirection",
              "submitVideoSlotCreativeDirection",
              "saveVideoSlotScript",
              "submitVideoSlotScript",
              "submitCombinedResearch",
              "saveFoundation",
              "submitFoundation",
              "submitMvLyrics",
              "submitMvSong",
              "submitScript",
              "saveStoryboard",
              "saveImageGeneration",
              "saveVisualDevelopment",
              "submitVisualDevelopment",
              "submitStoryboard",
              "submitImageGeneration",
              "submitSavedProduction",
              "saveMvVisualScript",
              "submitMvVisualScript",
            ];
      if (!allowed.includes(b.action))
        return Response.json(
          {
            error:
              "Your tier can review Client Brief and Assign Team, but cannot change them",
          },
          { status: 403 },
        );
    }
  }
  if (["extendBatch", "closeEmptyBatch"].includes(b.action)) {
    if (Number(a.member.tier) > 1)
      return Response.json(
        { error: "Management access required" },
        { status: 403 },
      );
    const batchId = Number(b.batchId || 0),
      batch = await db
        .prepare(
          "SELECT id,batch_number AS batchNumber,starts_at AS startsAt,ends_at AS endsAt,status,planned_count AS plannedCount FROM production_batches WHERE id=? AND project_id=?",
        )
        .bind(batchId, b.id)
        .first<any>();
    if (!batch)
      return Response.json({ error: "Batch not found" }, { status: 404 });
    const now = new Date().toISOString();
    if (b.action === "extendBatch") {
      if (batch.status === "Completed")
        return Response.json(
          { error: "A completed Batch cannot be extended." },
          { status: 409 },
        );
      const end = new Date(`${batch.endsAt}T00:00:00Z`);
      end.setUTCDate(end.getUTCDate() + 7);
      await db.batch([
        db
          .prepare(
            "UPDATE production_batches SET ends_at=?,status=CASE WHEN status='Overdue' THEN 'Active' ELSE status END WHERE id=?",
          )
          .bind(end.toISOString().slice(0, 10), batch.id),
        db
          .prepare(
            "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
          )
          .bind(
            b.id,
            "batch_extended",
            a.email,
            JSON.stringify({
              batchId: batch.id,
              batchNumber: batch.batchNumber,
              previousEnd: batch.endsAt,
              newEnd: end.toISOString().slice(0, 10),
              days: 7,
            }),
            now,
          ),
      ]);
      return Response.json({
        ok: true,
        message: `Batch ${String(batch.batchNumber).padStart(2, "0")} extended by 7 days.`,
      });
    }
    if (Number(batch.plannedCount || 0) > 0)
      return Response.json(
        { error: "Only an empty Batch can be closed with this action." },
        { status: 409 },
      );
    await db.batch([
      db
        .prepare(
          "UPDATE production_batches SET status='Completed',gate_status='Approved' WHERE id=?",
        )
        .bind(batch.id),
      db
        .prepare(
          "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(
          b.id,
          "empty_batch_closed",
          a.email,
          JSON.stringify({ batchId: batch.id, batchNumber: batch.batchNumber }),
          now,
        ),
    ]);
    return Response.json({
      ok: true,
      message: `Empty Batch ${String(batch.batchNumber).padStart(2, "0")} closed.`,
    });
  }
  if (
    [
      "saveCanonicalPhase",
      "submitCanonicalPhase",
      "updateApprovedReferences",
      "updateProductionReferences",
      "reviewCanonicalPhase",
      "requestChange",
      "decideChange",
      "confirmPayment",
      "setPaymentProgress",
      "confirmDelivery",
      "confirmPaymentCleared",
      "completeProject",
    ].includes(b.action)
  ) {
    const now = new Date().toISOString(),
      phaseKey = String(b.phaseKey || "");
    const project = await db
      .prepare(
        "SELECT project_type_code AS projectType,project_mode AS projectMode,mv_entry AS mvEntry,project_config AS projectConfig,payment_percentage AS paymentPercentage,payment_cleared AS paymentCleared,delivery_confirmed AS deliveryConfirmed FROM projects WHERE id=?",
      )
      .bind(b.id)
      .first<any>();
    const phase = phaseKey
      ? await db
          .prepare(
            "SELECT id,position,label,review_kind AS reviewKind,max_reviews AS maxReviews,status,data,version FROM phase_records WHERE project_id=? AND phase_key=?",
          )
          .bind(b.id, phaseKey)
          .first<any>()
      : null;
    const driveRecord = async (
      eventType: string,
      payload: any,
      targetPhase = phaseKey || "_system",
    ) =>
      queueProjectDriveRecord(db, {
        eventKey: `live:${b.id}:${targetPhase}:${eventType}:${crypto.randomUUID()}`,
        projectId: b.id,
        phaseKey: targetPhase,
        eventType,
        actorEmail: a.email,
        payload,
      });
    const setProjectPhase = async (
      label: string,
      status: string,
      position: number,
    ) => {
      const total = await db
          .prepare(
            "SELECT COUNT(*) AS count FROM phase_records WHERE project_id=?",
          )
          .bind(b.id)
          .first<any>(),
        progress = Math.min(
          99,
          Math.round((position / Math.max(1, Number(total?.count || 1))) * 100),
        );
      await db
        .prepare(
          "UPDATE projects SET phase_status=?,stage=?,assignment_stage=?,assignment_status=?,progress=? WHERE id=?",
        )
        .bind(
          status,
          `${label} · ${status}`,
          label,
          status === "Reviewing" || status === "Client Reviewing"
            ? "Awaiting Approval"
            : status === "Retake"
              ? "Revision Requested"
              : "Ongoing",
          progress,
          b.id,
        )
        .run();
    };
    const productionBatch = await db
        .prepare(
          "SELECT id,batch_number AS batchNumber,starts_at AS startsAt,ends_at AS endsAt FROM production_batches WHERE project_id=? ORDER BY CASE WHEN status='Planning' THEN 0 WHEN status='Active' THEN 1 ELSE 2 END,batch_number DESC LIMIT 1",
        )
        .bind(b.id)
        .first<any>(),
      productionBatchId = Number(productionBatch?.id) || null;
    const openNext = async (position: number) => {
      const next = await db
        .prepare(
          "SELECT phase_key AS phaseKey,label,position FROM phase_records WHERE project_id=? AND position>? AND phase_key NOT IN ('batch-learning','monthly-review') ORDER BY position LIMIT 1",
        )
        .bind(b.id, position)
        .first<any>();
      if (next) {
        const latest = await db
          .prepare(
            "SELECT payment_percentage AS paymentPercentage FROM projects WHERE id=?",
          )
          .bind(b.id)
          .first<any>();
        if (
          next.phaseKey === "final-delivery" &&
          Number(latest?.paymentPercentage || 0) < 100
        ) {
          await db
            .prepare(
              "UPDATE projects SET project_status='Waiting Payment',phase_status='Locked',stage='Final Delivery · Waiting for 100% Payment',assignment_stage='Final Delivery',assignment_status='Locked' WHERE id=?",
            )
            .bind(b.id)
            .run();
          return;
        }
        await db
          .prepare(
            "UPDATE phase_records SET status='In Progress',opened_at=COALESCE(opened_at,?),updated_at=? WHERE project_id=? AND phase_key=? AND status='Locked'",
          )
          .bind(now, now, b.id, next.phaseKey)
          .run();
        await setProjectPhase(next.label, "In Progress", next.position);
      } else if (
        ["Internal Social Account", "Client Social Account"].includes(
          project?.projectType,
        ) &&
        project?.projectMode === "continuous"
      )
        await db
          .prepare(
            "UPDATE projects SET project_status='Active',phase_status='Approved',stage='Recurring Project · Next Batch Scheduled',assignment_stage='2-Week Batch Ideas',assignment_status='Waiting for next Batch planning',progress=99 WHERE id=?",
          )
          .bind(b.id)
          .run();
      else
        await db
          .prepare(
            "UPDATE projects SET project_status='Ready to Complete',phase_status='Approved',stage='Ready to Complete',progress=100 WHERE id=?",
          )
          .bind(b.id)
          .run();
    };
    if (b.action === "updateApprovedReferences") {
      if (a.member.tier > 1)
        return Response.json(
          { error: "Management access required" },
          { status: 403 },
        );
      if (!phase || phaseKey !== "references" || phase.status !== "Approved")
        return Response.json(
          { error: "The approved Reference Library is not available." },
          { status: 409 },
        );
      let payload: any = {};
      try {
        payload = JSON.parse(b.payload || "{}");
      } catch {
        return Response.json(
          { error: "Invalid Reference Library" },
          { status: 400 },
        );
      }
      const categories =
        payload.categories && typeof payload.categories === "object"
          ? payload.categories
          : {};
      for (const [category, value] of Object.entries(categories) as any) {
        if (!value?.enabled) continue;
        const count = await db
          .prepare(
            "SELECT COUNT(*) AS count FROM visual_asset_revisions WHERE project_id=? AND phase='references' AND item_key=? AND is_current=1",
          )
          .bind(b.id, `${category}-reference`)
          .first<any>();
        if (Number(count?.count || 0) < 1 || Number(count?.count || 0) > 4)
          return Response.json(
            {
              error: `${String(category).replaceAll("_", " ")} requires 1–4 reference images.`,
            },
            { status: 400 },
          );
      }
      payload.referenceRule =
        "Only enabled categories are continuity-locked. Disabled categories may be designed freely by Agent for each Content Item.";
      await db
        .prepare(
          "UPDATE phase_records SET data=?,version=version+1,approved_at=?,updated_at=? WHERE id=?",
        )
        .bind(JSON.stringify(payload), now, now, phase.id)
        .run();
      await saveApprovedSnapshot(db, {
        projectId: b.id,
        phaseKey,
        phaseLabel: phase.label,
        content: payload,
        approvedBy: a.email,
        generationMethod: "Management Reference Library update",
      });
      await db
        .prepare(
          "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(
          b.id,
          "reference_library_updated",
          a.email,
          JSON.stringify({
            enabledCategories: Object.entries(categories)
              .filter(([, value]: any) => Boolean(value?.enabled))
              .map(([key]) => key),
          }),
          now,
        )
        .run();
      await driveRecord("reference_library_updated", {
        phaseKey,
        phaseLabel: phase.label,
        status: "Approved",
        content: payload,
      });
      return Response.json({ ok: true });
    }
    if (b.action === "updateProductionReferences") {
      if (a.member.tier > 1)
        return Response.json(
          { error: "Management access required" },
          { status: 403 },
        );
      if (
        !phase ||
        phaseKey !== "content-production" ||
        !["In Progress", "Reopened", "Reviewing", "Retake"].includes(
          phase.status,
        )
      )
        return Response.json(
          {
            error:
              "Content Production generation settings cannot be changed in the current state.",
          },
          { status: 409 },
        );
      const contentId = String(b.contentId || ""),
        assetNumber = Number(b.assetNumber || 0),
        continuityWithFirstImage =
          assetNumber > 1 && b.continuityWithFirstImage === "true",
        generationQuality =
          b.generationQuality === "high"
            ? "high"
            : b.generationQuality === "medium"
              ? "medium"
              : "low",
        maxProjectReferences = continuityWithFirstImage ? 1 : 2;
      let referenceTypes: string[] = [];
      try {
        referenceTypes = JSON.parse(String(b.referenceTypes || "[]")).map(
          String,
        );
      } catch {
        return Response.json(
          { error: "Invalid reference selection" },
          { status: 400 },
        );
      }
      if (referenceTypes.length > maxProjectReferences)
        return Response.json(
          {
            error: `Use no more than ${maxProjectReferences} Project Reference role${maxProjectReferences === 1 ? "" : "s"}; FrameFlow currently sends two images total${continuityWithFirstImage ? " and the approved Anchor occupies one slot" : ""}.`,
          },
          { status: 400 },
        );
      const snapshot = await db
        .prepare(
          "SELECT approved_content AS content FROM approved_phase_snapshots WHERE project_id=? AND phase_key='references' ORDER BY version DESC LIMIT 1",
        )
        .bind(b.id)
        .first<any>();
      const categories = parseJson(snapshot?.content, {}).categories || {},
        enabled = new Set(
          Object.entries(categories)
            .filter(([, value]: any) => Boolean(value?.enabled))
            .map(([key]) => key),
        ),
        invalid = referenceTypes.filter((key) => !enabled.has(key));
      if (invalid.length)
        return Response.json(
          { error: `Unavailable Project References: ${invalid.join(", ")}` },
          { status: 400 },
        );
      const data = parseJson(phase.data, {}),
        item = (
          Array.isArray(data.production_items) ? data.production_items : []
        ).find(
          (row: any) => String(row.contentId || row.content_id) === contentId,
        );
      if (!item)
        return Response.json(
          {
            error: `${contentId || "This Content item"} is not ready yet. The Agent must complete the missing Content Production items before its image settings can be changed.`,
          },
          { status: 409 },
        );
      const asset = (Array.isArray(item.assets) ? item.assets : []).find(
        (row: any) =>
          Number(row.assetNumber || row.asset_number) === assetNumber,
      );
      if (!asset)
        return Response.json(
          {
            error: `Visual ${assetNumber || ""} is not ready yet. Resume the Agent task to complete the missing visual plan.`,
          },
          { status: 409 },
        );
      asset.referenceTypes = referenceTypes;
      asset.continuityWithFirstImage = continuityWithFirstImage;
      asset.generationQuality = generationQuality;
      asset.generationResolution = "1K";
      asset.maxInputReferences = 2;
      await db
        .prepare("UPDATE phase_records SET data=?,updated_at=? WHERE id=?")
        .bind(JSON.stringify(data), now, phase.id)
        .run();
      const settings = {
        phaseKey,
        contentId,
        assetNumber,
        referenceTypes,
        continuityWithFirstImage,
        generationQuality,
        generationResolution: "1K",
        maxInputReferences: 2,
        workflowId: "2102592525269012481",
      };
      await db
        .prepare(
          "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(
          b.id,
          "content_generation_settings_updated",
          a.email,
          JSON.stringify(settings),
          now,
        )
        .run();
      await driveRecord("content_generation_settings_updated", settings);
      return Response.json({ ok: true });
    }
    if (
      b.action === "saveCanonicalPhase" ||
      b.action === "submitCanonicalPhase"
    ) {
      if (!phase)
        return Response.json({ error: "Phase not found" }, { status: 404 });
      const blockedPrior = await db
        .prepare(
          "SELECT phase_key AS phaseKey,label,status FROM phase_records WHERE project_id=? AND position<? AND phase_key NOT IN ('payment-status','batch-learning') AND status!='Approved' ORDER BY position LIMIT 1",
        )
        .bind(b.id, phase.position)
        .first<any>();
      if (blockedPrior)
        return Response.json(
          {
            error: `${blockedPrior.label} must receive ✅ before ${phase.label} can begin.`,
          },
          { status: 409 },
        );
      if (phase.status === "Locked")
        return Response.json(
          { error: `${phase.label} is still locked by the previous phase.` },
          { status: 409 },
        );
      if (["Reviewing", "Client Reviewing", "Approved"].includes(phase.status))
        return Response.json(
          { error: "This phase is frozen. Use Change Request after approval." },
          { status: 409 },
        );
      let payload: any = {};
      try {
        payload = JSON.parse(b.payload || "{}");
      } catch {
        return Response.json(
          { error: "Invalid phase content" },
          { status: 400 },
        );
      }
      if (phaseKey === "batch-ideas")
        payload._productionBatchId = productionBatchId;
      let previousData: any = {};
      try {
        previousData = JSON.parse(phase.data || "{}");
      } catch {}
      if (previousData.clientReview) {
        payload.clientReview = previousData.clientReview;
        for (const decision of previousData.clientReview.decisions || [])
          if (
            decision.decision === "approve" &&
            Object.prototype.hasOwnProperty.call(previousData, decision.id)
          )
            payload[decision.id] = previousData[decision.id];
      }
      if (b.action === "saveCanonicalPhase") {
        await db
          .prepare(
            "UPDATE phase_records SET data=?,status=CASE WHEN status='Reopened' THEN 'Reopened' ELSE 'In Progress' END,updated_at=? WHERE id=?",
          )
          .bind(JSON.stringify(payload), now, phase.id)
          .run();
        await setProjectPhase(
          phase.label,
          phase.status === "Reopened" ? "Reopened" : "In Progress",
          phase.position,
        );
        await driveRecord("phase_draft_saved", {
          phaseKey,
          phaseLabel: phase.label,
          status: phase.status === "Reopened" ? "Reopened" : "In Progress",
          content: payload,
        });
        return Response.json({ ok: true });
      }
      const empty = !Object.values(payload).some((v) => String(v || "").trim());
      if (empty)
        return Response.json(
          { error: "Complete the phase content before submitting." },
          { status: 400 },
        );
      if (phaseKey === "references") {
        const categories =
            payload.categories && typeof payload.categories === "object"
              ? payload.categories
              : {},
          enabled = Object.entries(categories).filter(([, value]: any) =>
            Boolean(value?.enabled),
          );
        for (const [category] of enabled) {
          const count = await db
            .prepare(
              "SELECT COUNT(*) AS count FROM visual_asset_revisions WHERE project_id=? AND phase='references' AND item_key=? AND is_current=1",
            )
            .bind(b.id, `${category}-reference`)
            .first<any>();
          if (Number(count?.count || 0) < 1)
            return Response.json(
              {
                error: `Upload at least one approved image for ${String(category).replaceAll("_", " ")}.`,
              },
              { status: 400 },
            );
          if (Number(count?.count || 0) > 4)
            return Response.json(
              {
                error: `${String(category).replaceAll("_", " ")} allows a maximum of 4 reference images.`,
              },
              { status: 400 },
            );
        }
        payload.referenceRule =
          "Only enabled categories are continuity-locked. Disabled categories may be designed freely by Agent for each Content Item.";
      }
      if (phaseKey === "batch-ideas") {
        const platformError = batchPlatformError(
          payload,
          project?.projectConfig,
          productionBatch,
        );
        if (platformError)
          return Response.json({ error: platformError }, { status: 400 });
        const profileError = await batchProfileError(db, b.id, payload);
        if (profileError)
          return Response.json({ error: profileError }, { status: 400 });
        const snapshot = await db
          .prepare(
            "SELECT approved_content AS content FROM approved_phase_snapshots WHERE project_id=? AND phase_key='references' ORDER BY version DESC LIMIT 1",
          )
          .bind(b.id)
          .first<any>();
        let references: any = {};
        try {
          references = JSON.parse(snapshot?.content || "{}").categories || {};
        } catch {}
        const enabled = new Set(
            Object.entries(references)
              .filter(([, value]: any) => Boolean(value?.enabled))
              .map(([key]) => key),
          ),
          items = Array.isArray(payload.content_items)
            ? payload.content_items
            : Array.isArray(payload.items)
              ? payload.items
              : [];
        for (const [index, item] of items.entries()) {
          const selected = Array.isArray(item.referenceTypes)
              ? item.referenceTypes
              : Array.isArray(item.reference_types)
                ? item.reference_types
                : [],
            invalid = selected.filter((key: any) => !enabled.has(String(key)));
          if (invalid.length)
            return Response.json(
              {
                error: `Content ${index + 1} selected unavailable References: ${invalid.map((referenceLabel: any) => String(referenceLabel).replaceAll("_", " ")).join(", ")}`,
              },
              { status: 400 },
            );
        }
      }
      if (phaseKey === "content-production") {
        const approvedBatchMarker = await db
            .prepare(
              "SELECT json_extract(approved_content,'$._productionBatchId') AS batchId FROM approved_phase_snapshots WHERE project_id=? AND phase_key='batch-ideas' ORDER BY version DESC LIMIT 1",
            )
            .bind(b.id)
            .first<any>(),
          batchId =
            Number(payload._productionBatchId) ||
            Number(approvedBatchMarker?.batchId) ||
            productionBatchId;
        payload._productionBatchId = batchId;
        const items = Array.isArray(payload.production_items)
          ? payload.production_items
          : [];
        if (!items.length)
          return Response.json(
            { error: "Content Production has no Content Items." },
            { status: 400 },
          );
        const approvedBatch = await db
            .prepare(
              "SELECT approved_content AS content FROM approved_phase_snapshots WHERE project_id=? AND phase_key='batch-ideas' ORDER BY version DESC LIMIT 1",
            )
            .bind(b.id)
            .first<any>(),
          assetCountIssues = productionAssetCountIssues(
            parseJson(approvedBatch?.content, {}),
            payload,
          );
        if (assetCountIssues.length)
          return Response.json(
            {
              error: `Content Production does not match the Approved Batch visual plan: ${assetCountIssues.slice(0, 5).join(", ")}${assetCountIssues.length > 5 ? ` +${assetCountIssues.length - 5} more` : ""}`,
            },
            { status: 400 },
          );
        const imageStage =
          payload._imageReviewStage === "remaining_images"
            ? "remaining_images"
            : "first_images";
        payload._imageReviewStage = imageStage;
        const missing: string[] = [];
        for (const [contentIndex, item] of items.entries()) {
          const assets = Array.isArray(item.assets) ? item.assets : [],
            anchor = assets[0]?.wardrobe,
            contentType = String(
              item.contentType || item.content_type || "",
            ).toLowerCase(),
            visualRequired = ![
              "threads article",
              "text only",
              "context",
            ].includes(contentType);
          if (
            !String(item.title || "").trim() ||
            !String(item.caption || "").trim()
          )
            missing.push(`Content ${contentIndex + 1} copy`);
          if (visualRequired && !assets.length)
            missing.push(`Content ${contentIndex + 1} visual plan`);
          for (const [assetIndex, asset] of assets.entries()) {
            const assetNumber = Number(asset.assetNumber || assetIndex + 1),
              itemKey = socialBatchAssetKey(
                batchId,
                `${String(item.contentId || `content_${contentIndex + 1}`)}-asset-${assetNumber}`,
              ),
              uploaded = await db
                .prepare(
                  "SELECT COUNT(*) AS count FROM visual_asset_revisions WHERE project_id=? AND phase='content-production' AND item_key=? AND is_current=1",
                )
                .bind(b.id, itemKey)
                .first<any>(),
              requiredInThisReview =
                imageStage === "first_images"
                  ? assetNumber === 1
                  : assetNumber > 1;
            if (
              !followsProductionImageFormula(
                String(asset.imageGenerationPrompt || ""),
                assetNumber,
              )
            )
              missing.push(
                `Content ${contentIndex + 1} visual ${assetIndex + 1} ${assetNumber === 1 ? "Anchor" : "Continuation"} Prompt formula`,
              );
            wardrobeValidationIssues(asset.wardrobe, {
              assetNumber,
              subjectPresence: asset.subjectPresence || asset.subject_presence,
              anchorWardrobe: anchor,
              approvedWardrobeChanges: item.approvedWardrobeChanges || [],
            }).forEach((issue) =>
              missing.push(
                `Content ${contentIndex + 1} visual ${assetIndex + 1} wardrobe: ${issue}`,
              ),
            );
            if (requiredInThisReview && !Number(uploaded?.count || 0))
              missing.push(
                `Content ${contentIndex + 1} visual ${assetIndex + 1} upload`,
              );
          }
        }
        if (missing.length)
          return Response.json(
            {
              error: `Complete this ${imageStage === "first_images" ? "first-image" : "remaining-image"} Review package: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ` +${missing.length - 5} more` : ""}`,
            },
            { status: 400 },
          );
      }
      if (phaseKey === "reel-video-production") {
        const items = Array.isArray(payload.reel_video_items)
            ? payload.reel_video_items
            : [],
          approvedProduction = await db
            .prepare(
              "SELECT approved_content AS content FROM approved_phase_snapshots WHERE project_id=? AND phase_key='content-production' ORDER BY version DESC LIMIT 1",
            )
            .bind(b.id)
            .first<any>();
        let approvedItems: any[] = [];
        try {
          approvedItems =
            JSON.parse(approvedProduction?.content || "{}").production_items ||
            [];
        } catch {}
        const expectedReels = approvedItems.filter(
            (item: any) =>
              String(item.contentType || item.content_type).toLowerCase() ===
              "reel",
          ),
          expectedReelIds = expectedReels
            .map((item: any) => String(item.contentId || item.content_id))
            .filter(Boolean),
          submittedReelIds = items
            .map((item: any) => String(item.contentId || item.content_id))
            .filter(Boolean),
          exactReelSet =
            expectedReelIds.length > 0 &&
            items.length === expectedReelIds.length &&
            new Set(submittedReelIds).size === expectedReelIds.length &&
            expectedReelIds.every((id: string) =>
              submittedReelIds.includes(id),
            );
        if (!exactReelSet)
          return Response.json(
            {
              error: `Reel Video Production requires the exact ${expectedReels.length} approved Reel package${expectedReels.length === 1 ? "" : "s"}: ${expectedReelIds.join(", ") || "none"}.`,
            },
            { status: 400 },
          );
        const setupIssues = items.flatMap((item: any, index: number) =>
          reelConfigurationIssues(item).map(
            (issue) => `Reel ${index + 1}: ${issue}`,
          ),
        );
        if (setupIssues.length)
          return Response.json(
            {
              error: `Complete the Reel Style setup before the Agent writes prompts: ${setupIssues.join(", ")}`,
            },
            { status: 400 },
          );
        const reelStage = String(payload._reelStage || "");
        if (reelStage === "generation") {
          const latestRetake = await db
            .prepare(
              "SELECT created_at AS createdAt FROM audit_log WHERE project_id=? AND event_type='phase_retake' AND json_extract(event_data,'$.phaseKey')='reel-video-production' ORDER BY id DESC LIMIT 1",
            )
            .bind(b.id)
            .first<any>();
          const latestPrompt = await db
            .prepare(
              "SELECT created_at AS createdAt FROM audit_log WHERE project_id=? AND event_type='agent_prompt_saved' AND json_extract(event_data,'$.phaseKey')='reel-video-production' ORDER BY id DESC LIMIT 1",
            )
            .bind(b.id)
            .first<any>();
          const latestApproval = await db
              .prepare(
                "SELECT created_at AS createdAt FROM audit_log WHERE project_id=? AND event_type='reel_prompt_approved' AND json_extract(event_data,'$.phaseKey')='reel-video-production' ORDER BY id DESC LIMIT 1",
              )
              .bind(b.id)
              .first<any>(),
            savedReelData = parseJson(phase.data, {}),
            unresolvedPromptRetake = unresolvedReelPromptRetake(
              latestRetake?.createdAt,
              [
                latestPrompt?.createdAt,
                latestApproval?.createdAt,
                savedReelData.promptApprovedAt,
              ],
            );
          if (unresolvedPromptRetake) {
            payload._reelStage = "style_configured";
            delete payload.promptApprovedAt;
            delete payload.promptApprovedBy;
            await db
              .prepare(
                "UPDATE phase_records SET data=?,status='Retake',updated_at=? WHERE id=?",
              )
              .bind(JSON.stringify(payload), now, phase.id)
              .run();
            await setProjectPhase(phase.label, "Retake", phase.position);
            const { env } = await import("cloudflare:workers"),
              agentRun = await runManagedProject(db, env, b.id, true);
            return Response.json({
              ok: true,
              reelStage: "style_configured",
              message:
                "The latest Reel Prompt Retake was restored before generation. Agent prompt correction started.",
              agentRun,
            });
          }
          await db
            .prepare(
              "UPDATE phase_records SET data=?,status='In Progress',updated_at=? WHERE id=?",
            )
            .bind(JSON.stringify(payload), now, phase.id)
            .run();
          await setProjectPhase(phase.label, "In Progress", phase.position);
          const { env } = await import("cloudflare:workers"),
            agentRun = await runManagedProject(db, env, b.id, true);
          return Response.json({
            ok: true,
            reelStage: "generation",
            message: "Approved Reel generation resumed.",
            agentRun,
          });
        }
        if (!["prompt_review", "generated_review"].includes(reelStage)) {
          payload._reelStage = "style_configured";
          await db
            .prepare(
              "UPDATE phase_records SET data=?,status='In Progress',updated_at=? WHERE id=?",
            )
            .bind(JSON.stringify(payload), now, phase.id)
            .run();
          await setProjectPhase(phase.label, "In Progress", phase.position);
          const { env } = await import("cloudflare:workers"),
            agentRun = await runManagedProject(db, env, b.id, true);
          return Response.json({
            ok: true,
            reelStage: "style_configured",
            message: "Reel Styles saved. Agent prompt production started.",
            agentRun,
          });
        }
      }
      if (phaseKey === "publishing") {
        const files = await db
          .prepare(
            "SELECT COUNT(*) AS count FROM visual_asset_revisions WHERE project_id=? AND phase IN ('content-production','reel-video-production') AND is_current=1",
          )
          .bind(b.id)
          .first<any>();
        if (!Number(files?.count || 0))
          return Response.json(
            {
              error:
                "No completed task files exist yet. Finish Content Production or Reel Video Production first.",
            },
            { status: 400 },
          );
        payload = {
          ...payload,
          taskFileCount: Number(files.count),
          taskFilesCheckedAt: now,
          completionRule:
            "At least one current production task file exists in FrameFlow. AutoPost is dormant.",
        };
      }
      if (phase.reviewKind === "none") {
        await db
          .prepare(
            "UPDATE phase_records SET data=?,status='Approved',version=version+1,approved_at=?,updated_at=? WHERE id=?",
          )
          .bind(JSON.stringify(payload), now, now, phase.id)
          .run();
        await saveApprovedSnapshot(db, {
          projectId: b.id,
          phaseKey,
          phaseLabel: phase.label,
          content: payload,
          approvedBy: a.email,
        });
        await db
          .prepare(
            "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
          )
          .bind(
            b.id,
            "phase_completed",
            a.email,
            JSON.stringify({ phaseKey }),
            now,
          )
          .run();
        await driveRecord("phase_completed", {
          phaseKey,
          phaseLabel: phase.label,
          status: "Approved",
          content: payload,
        });
        await openNext(phase.position);
        return Response.json({ ok: true });
      }
      const status = "Reviewing";
      await db
        .prepare(
          "UPDATE phase_records SET data=?,status=?,updated_at=? WHERE id=?",
        )
        .bind(JSON.stringify(payload), status, now, phase.id)
        .run();
      if (phaseKey === "idea-hook-story")
        await db
          .prepare(
            "UPDATE production_batches SET gate_status='Reviewing' WHERE id=(SELECT id FROM production_batches WHERE project_id=? AND status='Active' ORDER BY batch_number LIMIT 1)",
          )
          .bind(b.id)
          .run();
      await setProjectPhase(phase.label, status, phase.position);
      await db
        .prepare(
          "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(
          b.id,
          "phase_submitted",
          a.email,
          JSON.stringify({ phaseKey, status }),
          now,
        )
        .run();
      await driveRecord("phase_submitted_for_review", {
        phaseKey,
        phaseLabel: phase.label,
        status,
        content: payload,
      });
      return Response.json({
        ok: true,
        externalReviewUrl: payload.externalReviewUrl || null,
      });
    }
    if (b.action === "reviewCanonicalPhase") {
      if (a.member.tier > 1)
        return Response.json(
          { error: "Management access required" },
          { status: 403 },
        );
      if (!phase || phase.status !== "Reviewing")
        return Response.json(
          { error: "This phase is not awaiting internal review" },
          { status: 409 },
        );
      const approved = b.decision === "approve",
        note = String(b.reviewNote || "").trim();
      let reviewProductionBatchId =
        phaseKey === "reel-video-production"
          ? Number(parseJson(phase.data, {})._productionBatchId) || null
          : null;
      let fieldFeedback: Record<string, string> = {};
      try {
        fieldFeedback = JSON.parse(String(b.fieldReviews || "{}"));
      } catch {}
      let acceptedFields: string[] = [];
      try {
        acceptedFields = JSON.parse(String(b.acceptedFields || "[]"));
      } catch {}
      if (!approved && !note && !Object.keys(fieldFeedback).length)
        return Response.json(
          { error: "A Retake comment is required" },
          { status: 400 },
        );
      if (approved && phaseKey === "batch-ideas") {
        const current = parseJson(phase.data, {}),
          platformError = batchPlatformError(
            current,
            project?.projectConfig,
            productionBatch,
          );
        if (platformError)
          return Response.json(
            {
              error: AUTOPOST_ENABLED
                ? `${platformError} Return this Content for Revision so Agent can choose its platform.`
                : platformError,
            },
            { status: 409 },
          );
        const profileError = await batchProfileError(db, b.id, current);
        if (profileError)
          return Response.json(
            {
              error: `${profileError} Connect or select the Project Profile before approving this Batch.`,
            },
            { status: 409 },
          );
      }
      if (approved && phaseKey === "reel-video-production") {
        const reelData = parseJson(phase.data, {});
        if (reelData._reelStage === "prompt_review") {
          const reviewed = parseJson(b.payload, {}),
            reviewedItems = Array.isArray(reviewed.reel_video_items)
              ? reviewed.reel_video_items
              : [];
          if (reviewedItems.length)
            reelData.reel_video_items = (reelData.reel_video_items || []).map(
              (item: any) => {
                const selected = reviewedItems.find(
                  (row: any) =>
                    String(row.contentId || row.content_id) ===
                    String(item.contentId || item.content_id),
                );
                return selected
                  ? {
                      ...item,
                      durationSeconds: selected.durationSeconds,
                      shotCount: selected.shotCount,
                      shots: selected.shots,
                      dialogueMode: selected.dialogueMode,
                      musicDirection: selected.musicDirection,
                      sceneContinuity: selected.sceneContinuity,
                      physicalRealism: selected.physicalRealism,
                      hardConstraints: selected.hardConstraints,
                      compiledVideoPrompt: selected.compiledVideoPrompt,
                      referenceAssetId:
                        selected.referenceAssetId ||
                        selected.characterReferenceAssetId ||
                        null,
                      referenceRole:
                        selected.referenceRole || "PROJECT_REFERENCE",
                      reference:
                        selected.reference ||
                        selected.characterReference ||
                        null,
                    }
                  : item;
              },
            );
          const reelItems = Array.isArray(reelData.reel_video_items)
              ? reelData.reel_video_items
              : [],
            approvedProduction = await db
              .prepare(
                "SELECT approved_content AS content FROM approved_phase_snapshots WHERE project_id=? AND phase_key='content-production' ORDER BY version DESC LIMIT 1",
              )
              .bind(b.id)
              .first<any>(),
            approvedItems = Array.isArray(
              parseJson(approvedProduction?.content, {}).production_items,
            )
              ? parseJson(approvedProduction?.content, {}).production_items
              : [],
            expectedIds = approvedItems
              .filter(
                (item: any) =>
                  String(
                    item.contentType || item.content_type,
                  ).toLowerCase() === "reel",
              )
              .map((item: any) => String(item.contentId || item.content_id))
              .filter(Boolean),
            reelIds = reelItems
              .map((item: any) => String(item.contentId || item.content_id))
              .filter(Boolean),
            exactSet =
              expectedIds.length > 0 &&
              reelItems.length === expectedIds.length &&
              new Set(reelIds).size === expectedIds.length &&
              expectedIds.every((id: string) => reelIds.includes(id));
          if (!exactSet)
            return Response.json(
              {
                error: `Prompt Review is incomplete. Expected the exact approved Reel set: ${expectedIds.join(", ") || "none"}.`,
              },
              { status: 409 },
            );
          const missing: string[] = [];
          for (const [index, item] of reelItems.entries()) {
            if (!Number(item.firstFrameAssetId || item.first_frame_asset_id))
              missing.push(
                `Reel ${index + 1}: approved first_frame is missing`,
              );
            if (
              item.referenceRequired !== false &&
              !Number(item.referenceAssetId || item.characterReferenceAssetId)
            )
              missing.push(`Reel ${index + 1}: select ref_image_0`);
            if (
              !String(item.compiledVideoPrompt || "").trim() ||
              !followsReelPromptFormula(String(item.compiledVideoPrompt || ""))
            )
              missing.push(
                `Reel ${index + 1}: Agent FF-VIDEO-I2V-01 prompt is incomplete`,
              );
          }
          if (missing.length)
            return Response.json(
              {
                error: `Complete Prompt Review before generation: ${missing.join(", ")}`,
              },
              { status: 409 },
            );
          const { env } = await import("cloudflare:workers");
          try {
            await ensureRunningHubH3Contract(db, env);
          } catch (error: any) {
            return Response.json(
              {
                error: String(
                  error?.message ||
                    "RunningHub workflow contract verification failed.",
                ),
                code: error?.code || "RUNNINGHUB_CONTRACT_VERIFICATION_FAILED",
                issues: Array.isArray(error?.issues) ? error.issues : undefined,
              },
              { status: Number(error?.status) || 502 },
            );
          }
          reelData._reelStage = "generation";
          reelData.promptApprovedAt = now;
          reelData.promptApprovedBy = a.email;
          const approvedPayload = JSON.stringify(reelData),
            promptReviewClaim = await db
              .prepare(
                "UPDATE phase_records SET data=?,status=?,updated_at=? WHERE id=? AND status='Reviewing'",
              )
              .bind(approvedPayload, "In Progress", now, phase.id)
              .run();
          if (!Number(promptReviewClaim?.meta?.changes || 0))
            return Response.json(
              { error: "This Review decision was already submitted." },
              { status: 409 },
            );
          await db.batch([
            db
              .prepare(
                "UPDATE phase_generation_records SET human_edited_version=?,final_approved_version=?,edited_at=?,approved_at=?,review_result='Approved' WHERE id=(SELECT id FROM phase_generation_records WHERE project_id=? AND phase_key='reel-video-production' ORDER BY id DESC LIMIT 1)",
              )
              .bind(approvedPayload, approvedPayload, now, now, b.id),
            db
              .prepare(
                "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
              )
              .bind(
                b.id,
                "reel_prompt_approved",
                a.email,
                JSON.stringify({
                  phaseKey,
                  reelStage: "generation",
                  contentIds: reelIds,
                  firstFrameAssetIds: reelItems.map((item: any) =>
                    Number(item.firstFrameAssetId || item.first_frame_asset_id),
                  ),
                  referenceAssetIds: reelItems.map((item: any) =>
                    Number(
                      item.referenceAssetId || item.characterReferenceAssetId,
                    ),
                  ),
                }),
                now,
              ),
          ]);
          await setProjectPhase(phase.label, "In Progress", phase.position);
          const agentRun = await continueAfterReview(
            db,
            b.id,
            phaseKey,
            "approve",
            "Reel prompts and explicit ref_image_0 selections approved. Start locked workflow generation.",
          );
          return Response.json({ ok: true, reelStage: "generation", agentRun });
        }
      }
      if (approved && phase.reviewKind === "client") {
        let data: any = {};
        try {
          data = JSON.parse(phase.data || "{}");
        } catch {}
        const used = await db
          .prepare(
            "SELECT COUNT(*) AS count FROM review_sessions WHERE project_id=? AND scope_type='phase' AND scope_id=?",
          )
          .bind(b.id, phaseKey)
          .first<any>();
        if (
          Number(used?.count || 0) >= Number(phase.maxReviews || 0) &&
          b.additionalFeeApproved !== "true"
        )
          return Response.json(
            {
              error: `Included review limit reached (${phase.maxReviews}). Management must approve additional quotation.`,
            },
            { status: 409 },
          );
        const token = crypto.randomUUID().replaceAll("-", "");
        const expires = new Date(Date.now() + 3 * 86400000).toISOString();
        data.internalApprovedAt = now;
        data.internalApprovedBy = a.email;
        data.externalReviewToken = token;
        data.externalReviewExpiresAt = expires;
        data.externalReviewUrl = `${new URL(req.url).origin}/review/client?token=${token}`;
        await db
          .prepare(
            "UPDATE external_review_links SET status='Invalid',invalidated_at=? WHERE project_id=? AND status='Active'",
          )
          .bind(now, b.id)
          .run();
        await db
          .prepare(
            "INSERT INTO external_review_links(project_id,batch_id,token_hash,status,expires_at,created_by,created_at) VALUES(?,0,?,'Active',?,?,?)",
          )
          .bind(b.id, token, expires, a.email, now)
          .run();
        await db
          .prepare(
            "INSERT INTO review_sessions(project_id,scope_type,scope_id,review_kind,session_number,max_included,status,submitted_at,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            b.id,
            "phase",
            phaseKey,
            "client",
            Number(used?.count || 0) + 1,
            phase.maxReviews || 3,
            "Open",
            now,
            now,
          )
          .run();
        await db
          .prepare(
            "UPDATE phase_records SET data=?,status='Client Reviewing',updated_at=? WHERE id=?",
          )
          .bind(JSON.stringify(data), now, phase.id)
          .run();
        if (phaseKey === "idea-hook-story")
          await db
            .prepare(
              "UPDATE production_batches SET gate_status='Client Reviewing' WHERE id=(SELECT id FROM production_batches WHERE project_id=? AND status='Active' ORDER BY batch_number LIMIT 1)",
            )
            .bind(b.id)
            .run();
        await setProjectPhase(phase.label, "Client Reviewing", phase.position);
        await db
          .prepare(
            "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
          )
          .bind(
            b.id,
            "internal_review_approved",
            a.email,
            JSON.stringify({ phaseKey, externalReviewExpiresAt: expires }),
            now,
          )
          .run();
        await driveRecord("phase_sent_to_client_review", {
          phaseKey,
          phaseLabel: phase.label,
          status: "Client Reviewing",
          content: data,
          externalReviewExpiresAt: expires,
        });
        return Response.json({
          ok: true,
          externalReviewUrl: data.externalReviewUrl,
        });
      }
      if (approved) {
        let approvedData: any = {};
        try {
          approvedData = JSON.parse(phase.data || "{}");
        } catch {}
        if (phaseKey === "content-production") {
          const approvedBatchRow = await db
              .prepare(
                "SELECT approved_content AS content FROM approved_phase_snapshots WHERE project_id=? AND phase_key='batch-ideas' ORDER BY version DESC LIMIT 1",
              )
              .bind(b.id)
              .first<any>(),
            approvedBatch = parseJson(approvedBatchRow?.content, {}),
            assetCountIssues = productionAssetCountIssues(
              approvedBatch,
              approvedData,
            );
          if (assetCountIssues.length)
            return Response.json(
              {
                error: `Approval blocked because Content Production is missing Approved Batch visuals: ${assetCountIssues.join(", ")}`,
              },
              { status: 409 },
            );
          if (
            approvedData._imageReviewStage === "first_images" &&
            batchHasContinuationVisuals(approvedBatch)
          ) {
            const items = Array.isArray(approvedData.production_items)
                ? approvedData.production_items
                : [],
              firstStageAccepted = items.flatMap((item: any) => {
                const contentId = String(item.contentId || item.content_id),
                  hasFirst = (
                    Array.isArray(item.assets) ? item.assets : []
                  ).some(
                    (asset: any) =>
                      Number(asset.assetNumber || asset.asset_number) === 1,
                  );
                return [
                  `production_items.${contentId}.copy`,
                  ...(hasFirst
                    ? [`production_items.${contentId}.asset.1`]
                    : []),
                ];
              }),
              previous = Array.isArray(approvedData._acceptedReviewFields)
                ? approvedData._acceptedReviewFields
                : [];
            approvedData._acceptedReviewFields = Array.from(
              new Set([...previous, ...firstStageAccepted]),
            );
            approvedData._imageReviewStage = "remaining_images";
            delete approvedData.reviewNote;
            delete approvedData.reviewFeedback;
            const firstImageApprovalClaim = await db
              .prepare(
                "UPDATE phase_records SET status='In Progress',data=?,updated_at=? WHERE id=? AND status='Reviewing'",
              )
              .bind(JSON.stringify(approvedData), now, phase.id)
              .run();
            if (!Number(firstImageApprovalClaim?.meta?.changes || 0))
              return Response.json(
                { error: "This Review decision was already submitted." },
                { status: 409 },
              );
            await setProjectPhase(phase.label, "In Progress", phase.position);
            await db
              .prepare(
                "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
              )
              .bind(
                b.id,
                "content_first_images_approved",
                a.email,
                JSON.stringify({
                  phaseKey,
                  acceptedFields: firstStageAccepted,
                  nextStage: "remaining_images",
                }),
                now,
              )
              .run();
            await driveRecord("content_first_images_approved", {
              phaseKey,
              phaseLabel: phase.label,
              status: "In Progress",
              acceptedFields: firstStageAccepted,
              nextStage: "remaining_images",
              content: approvedData,
            });
            const { env } = await import("cloudflare:workers");
            await queueApprovedImageUpscales(
              db,
              env,
              b.id,
              a.email,
              items.map((item: any) =>
                socialBatchAssetKey(
                  productionBatchId,
                  `${String(item.contentId || item.content_id)}-asset-1`,
                ),
              ),
              new URL(req.url).origin,
            );
            const agentRun = await continueAfterReview(
              db,
              b.id,
              phaseKey,
              "approve",
              "First images approved. Generate every remaining visual required by the Approved Batch before Reel Video Production.",
            );
            return Response.json({
              ok: true,
              stage: "remaining_images",
              agentRun,
            });
          }
        }
        delete approvedData.reviewNote;
        delete approvedData.reviewFeedback;
        delete approvedData._acceptedReviewFields;
        if (phaseKey === "content-production")
          approvedData._imageReviewStage = "complete";
        const approvalClaim = await db
          .prepare(
            "UPDATE phase_records SET status='Approved',data=?,version=version+1,approved_at=?,updated_at=? WHERE id=? AND status='Reviewing'",
          )
          .bind(JSON.stringify(approvedData), now, now, phase.id)
          .run();
        if (!Number(approvalClaim?.meta?.changes || 0))
          return Response.json(
            { error: "This Review decision was already submitted." },
            { status: 409 },
          );
        await saveApprovedSnapshot(db, {
          projectId: b.id,
          phaseKey,
          phaseLabel: phase.label,
          content: approvedData,
          approvedBy: a.email,
        });
        if (phaseKey === "idea-hook-story")
          await db
            .prepare(
              "UPDATE production_batches SET gate_status='Approved' WHERE id=(SELECT id FROM production_batches WHERE project_id=? AND status='Active' ORDER BY batch_number LIMIT 1)",
            )
            .bind(b.id)
            .run();
        await openNext(phase.position);
      } else {
        let retakeData: any = {};
        try {
          retakeData = JSON.parse(phase.data || "{}");
        } catch {}
        const approvedProductionRow =
            phaseKey === "reel-video-production"
              ? await db
                  .prepare(
                    "SELECT approved_content AS content FROM approved_phase_snapshots WHERE project_id=? AND phase_key='content-production' ORDER BY version DESC LIMIT 1",
                  )
                  .bind(b.id)
                  .first<any>()
              : null,
          approvedProduction = parseJson(approvedProductionRow?.content, {});
        reviewProductionBatchId =
          Number(retakeData._productionBatchId) ||
          Number(approvedProduction._productionBatchId) ||
          null;
        const reelStage = String(retakeData._reelStage || ""),
          retakeContentIds =
            phaseKey === "reel-video-production"
              ? reelRetakeContentIds(
                  fieldFeedback,
                  Array.isArray(retakeData.reel_video_items)
                    ? retakeData.reel_video_items
                    : [],
                )
              : [];
        if (
          phaseKey === "reel-video-production" &&
          reelStage === "generated_review" &&
          !retakeContentIds.length
        )
          return Response.json(
            {
              error:
                "Select at least one generated Reel as Retake before sending corrections.",
            },
            { status: 400 },
          );
        if (
          phaseKey === "reel-video-production" &&
          Array.isArray(retakeData.reel_video_items) &&
          retakeData.reel_video_items.length
        )
          await db
            .prepare(
              "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
            )
            .bind(
              b.id,
              "reel_prompt_review_checkpoint",
              a.email,
              JSON.stringify(
                reelCheckpointEnvelope(retakeData, approvedProduction),
              ),
              now,
            )
            .run();
        retakeData.reviewNote = note || "Field-specific Retake";
        retakeData.reviewFeedback = fieldFeedback;
        retakeData._acceptedReviewFields = acceptedFields;
        if (reelStage === "generated_review")
          retakeData._reelRetryContentIds = retakeContentIds;
        const retakeClaim = await db
          .prepare(
            "UPDATE phase_records SET status='Retake',data=?,updated_at=? WHERE id=? AND status='Reviewing'",
          )
          .bind(JSON.stringify(retakeData), now, phase.id)
          .run();
        if (!Number(retakeClaim?.meta?.changes || 0))
          return Response.json(
            { error: "This Review decision was already submitted." },
            { status: 409 },
          );
        if (phaseKey === "idea-hook-story")
          await db
            .prepare(
              "UPDATE production_batches SET gate_status='Retake' WHERE id=(SELECT id FROM production_batches WHERE project_id=? AND status='Active' ORDER BY batch_number LIMIT 1)",
            )
            .bind(b.id)
            .run();
        await setProjectPhase(phase.label, "Retake", phase.position);
      }
      if (approved) {
        await completePhaseAgentFileGrants(db, b.id, phaseKey);
        if (phaseKey === "content-production") {
          const { env } = await import("cloudflare:workers");
          const approvedAssetKeys = socialBatchProductionAssetKeys(
            productionBatchId,
            approvedData,
          );
          if (approvedAssetKeys.length)
            await queueApprovedImageUpscales(
              db,
              env,
              b.id,
              a.email,
              approvedAssetKeys,
              new URL(req.url).origin,
            );
        }
        await queueApprovedSocialPublishJobs(db, b.id, phaseKey, a.email);
      } else {
        await revokeProjectAgentFileGrants(db, b.id, "Phase Retake");
        await cancelProjectJobs(db, b.id, a.email, "Phase Retake");
      }
      const feedbackForAgent = Object.keys(fieldFeedback).length
        ? JSON.stringify(fieldFeedback)
        : note;
      await db
        .prepare(
          "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(
          b.id,
          approved ? "phase_approved" : "phase_retake",
          a.email,
          JSON.stringify({
            phaseKey,
            note,
            fieldFeedback,
            acceptedFields,
            ...(phaseKey === "reel-video-production"
              ? {
                  productionBatchId:
                    reviewProductionBatchId,
                }
              : {}),
          }),
          now,
        )
        .run();
      const recorded = await db
        .prepare("SELECT status,data,version FROM phase_records WHERE id=?")
        .bind(phase.id)
        .first<any>();
      await driveRecord(approved ? "phase_approved" : "phase_retake", {
        phaseKey,
        phaseLabel: phase.label,
        status: recorded?.status,
        version: recorded?.version,
        reviewNote: note,
        fieldFeedback,
        acceptedFields,
        content: parseJson(recorded?.data, {}),
      });
      const agentRun =
        phaseKey === "references"
          ? {
              started: false,
              reason: "Reference Library approved for future Agent work.",
            }
          : await continueAfterReview(
              db,
              b.id,
              phaseKey,
              approved ? "approve" : "retake",
              feedbackForAgent,
            );
      return Response.json({ ok: true, agentRun });
    }
    if (b.action === "requestChange") {
      if (!phase || phase.status !== "Approved")
        return Response.json(
          { error: "Change Request is only available after ✅" },
          { status: 409 },
        );
      await db
        .prepare(
          "INSERT INTO change_requests(project_id,phase_key,requested_by,request_note,status,created_at) VALUES(?,?,?,?,?,?)",
        )
        .bind(
          b.id,
          phaseKey,
          a.email,
          b.requestNote || "Change requested",
          "Requested",
          now,
        )
        .run();
      await db
        .prepare(
          "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(
          b.id,
          "change_requested",
          a.email,
          JSON.stringify({ phaseKey, note: b.requestNote || "" }),
          now,
        )
        .run();
      return Response.json({ ok: true });
    }
    if (b.action === "decideChange") {
      if (a.member.tier > 1)
        return Response.json(
          { error: "Management access required" },
          { status: 403 },
        );
      const request = await db
        .prepare(
          "SELECT id,phase_key AS phaseKey FROM change_requests WHERE id=? AND project_id=? AND status='Requested'",
        )
        .bind(Number(b.requestId), b.id)
        .first<any>();
      if (!request)
        return Response.json(
          { error: "Open Change Request not found" },
          { status: 404 },
        );
      const approved = b.decision === "approve";
      await db
        .prepare(
          "UPDATE change_requests SET status=?,decided_by=?,decided_at=? WHERE id=?",
        )
        .bind(approved ? "Approved" : "Rejected", a.email, now, request.id)
        .run();
      if (approved && String(request.phaseKey).startsWith("video-slot-")) {
        const match = String(request.phaseKey).match(/^video-slot-(\d+)-(.+)$/),
          slotId = Number(match?.[1]),
          target = match?.[2];
        const row = await db
          .prepare("SELECT data FROM video_slots WHERE id=? AND project_id=?")
          .bind(slotId, b.id)
          .first<any>();
        let data = parseJson(row?.data, {});
        if (data.phases?.[target]) {
          data.phases[target].status = "Reopened";
          data.currentPhase =
            target === "creativeDirection"
              ? "Creative Direction"
              : target === "script"
                ? "Script · Client Review"
                : "Keyshot Image Set · Client Review";
          await db
            .prepare(
              "UPDATE video_slots SET phase_status='Reopened',data=? WHERE id=? AND project_id=?",
            )
            .bind(JSON.stringify(data), slotId, b.id)
            .run();
        }
      } else if (approved) {
        await db
          .prepare(
            "UPDATE phase_records SET status='Reopened',updated_at=? WHERE project_id=? AND phase_key=?",
          )
          .bind(now, b.id, request.phaseKey)
          .run();
        const reopened = await db
          .prepare(
            "SELECT label,position FROM phase_records WHERE project_id=? AND phase_key=?",
          )
          .bind(b.id, request.phaseKey)
          .first<any>();
        if (reopened)
          await setProjectPhase(reopened.label, "Reopened", reopened.position);
      }
      if (approved)
        await cancelProjectJobs(db, b.id, a.email, "Phase Reopened");
      await db
        .prepare(
          "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(
          b.id,
          approved ? "change_approved" : "change_rejected",
          a.email,
          JSON.stringify({ requestId: request.id, phaseKey: request.phaseKey }),
          now,
        )
        .run();
      return Response.json({ ok: true });
    }
    if (a.member.tier > 1)
      return Response.json(
        { error: "Management access required" },
        { status: 403 },
      );
    if (b.action === "confirmPayment" || b.action === "setPaymentProgress") {
      const percentage =
        b.action === "confirmPayment" ? 100 : Number(b.percentage);
      if (![25, 50, 100].includes(percentage))
        return Response.json(
          { error: "Payment must be 25%, 50% or 100%." },
          { status: 400 },
        );
      await db
        .prepare(
          "UPDATE projects SET payment_percentage=?,payment_confirmed=1,payment_cleared=?,project_status=CASE WHEN project_status IN ('Completed','Archived') THEN project_status ELSE 'Active' END WHERE id=?",
        )
        .bind(percentage, percentage === 100 ? 1 : 0, b.id)
        .run();
      await db
        .prepare(
          "UPDATE video_slots SET status='Available' WHERE project_id=? AND status='Awaiting Payment'",
        )
        .bind(b.id)
        .run();
      await db
        .prepare(
          "UPDATE production_cycles SET status='Active' WHERE project_id=? AND status='Waiting Payment'",
        )
        .bind(b.id)
        .run();
      await db
        .prepare(
          "UPDATE production_batches SET status='Active' WHERE project_id=? AND batch_number=1 AND status='Locked'",
        )
        .bind(b.id)
        .run();
      const existingBatch = await db
        .prepare(
          "SELECT COUNT(*) AS count FROM production_batches WHERE project_id=?",
        )
        .bind(b.id)
        .first<any>();
      if (
        project?.projectType === "AI Video" &&
        project?.projectMode === "recurring" &&
        !Number(existingBatch?.count || 0)
      ) {
        const cycle = await db
            .prepare(
              "SELECT id,starts_at AS startsAt FROM production_cycles WHERE project_id=? ORDER BY id DESC LIMIT 1",
            )
            .bind(b.id)
            .first<any>(),
          start = new Date(`${cycle?.startsAt || now.slice(0, 10)}T00:00:00Z`),
          end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 13);
        await db
          .prepare(
            "INSERT INTO production_batches(project_id,cycle_id,batch_number,starts_at,ends_at,status,gate_status,created_at) VALUES(?,?,?,?,?,?,?,?)",
          )
          .bind(
            b.id,
            cycle?.id,
            1,
            start.toISOString().slice(0, 10),
            end.toISOString().slice(0, 10),
            "Active",
            "Locked",
            now,
          )
          .run();
      }
      const gate = await db
        .prepare(
          "SELECT phase_key AS phaseKey,position,status FROM phase_records WHERE project_id=? AND phase_key='payment-status' ORDER BY position LIMIT 1",
        )
        .bind(b.id)
        .first<any>();
      if (gate) {
        await db
          .prepare(
            "UPDATE phase_records SET status=?,data=?,version=CASE WHEN ?=100 AND status!='Approved' THEN version+1 ELSE version END,approved_at=CASE WHEN ?=100 THEN ? ELSE NULL END,updated_at=? WHERE project_id=? AND phase_key=?",
          )
          .bind(
            percentage === 100 ? "Approved" : "In Progress",
            JSON.stringify({ percentage }),
            percentage,
            percentage,
            now,
            now,
            b.id,
            gate.phaseKey,
          )
          .run();
        const brief = await db
          .prepare(
            "SELECT phase_key AS phaseKey,label,position,status FROM phase_records WHERE project_id=? AND phase_key='client-brief'",
          )
          .bind(b.id)
          .first<any>();
        if (brief?.status === "Locked") {
          await db
            .prepare(
              "UPDATE phase_records SET status='In Progress',opened_at=?,updated_at=? WHERE project_id=? AND phase_key='client-brief'",
            )
            .bind(now, now, b.id)
            .run();
          await setProjectPhase(brief.label, "In Progress", brief.position);
        }
        if (percentage === 100) {
          const delivery = await db
            .prepare(
              "SELECT position,status FROM phase_records WHERE project_id=? AND phase_key='final-delivery'",
            )
            .bind(b.id)
            .first<any>();
          if (delivery?.status === "Locked") {
            const prior = await db
              .prepare(
                "SELECT status FROM phase_records WHERE project_id=? AND position<? ORDER BY position DESC LIMIT 1",
              )
              .bind(b.id, delivery.position)
              .first<any>();
            if (prior?.status === "Approved") {
              await db
                .prepare(
                  "UPDATE phase_records SET status='In Progress',opened_at=COALESCE(opened_at,?),updated_at=? WHERE project_id=? AND phase_key='final-delivery'",
                )
                .bind(now, now, b.id)
                .run();
              await setProjectPhase(
                "Final Delivery",
                "In Progress",
                delivery.position,
              );
            }
          }
        }
      }
      await db
        .prepare(
          "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(
          b.id,
          "payment_progress_updated",
          a.email,
          JSON.stringify({ percentage }),
          now,
        )
        .run();
      return Response.json({ ok: true });
    }
    if (b.action === "confirmDelivery") {
      await db
        .prepare("UPDATE projects SET delivery_confirmed=1 WHERE id=?")
        .bind(b.id)
        .run();
      return Response.json({ ok: true });
    }
    if (b.action === "confirmPaymentCleared") {
      await db
        .prepare(
          "UPDATE projects SET payment_cleared=1,project_status=CASE WHEN project_status='Waiting Payment' THEN 'Ready to Complete' ELSE project_status END WHERE id=?",
        )
        .bind(b.id)
        .run();
      return Response.json({ ok: true });
    }
    if (b.action === "completeProject") {
      const current = await db
        .prepare(
          "SELECT project_status AS status,delivery_confirmed AS delivered,payment_cleared AS paid FROM projects WHERE id=?",
        )
        .bind(b.id)
        .first<any>();
      if (!current?.delivered || !current?.paid)
        return Response.json(
          {
            error:
              "Confirm final delivery and cleared payment before completing the project.",
          },
          { status: 409 },
        );
      await db
        .prepare(
          "UPDATE projects SET project_status='Completed',completed_at=? WHERE id=?",
        )
        .bind(now, b.id)
        .run();
      await db
        .prepare(
          "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(b.id, "project_completed", a.email, "{}", now)
        .run();
      return Response.json({ ok: true });
    }
  }
  if (b.action === "configureVideoSlot") {
    if (a.member.tier > 1)
      return Response.json(
        { error: "Management or assigned Project Manager access required" },
        { status: 403 },
      );
    const slotId = Number(b.slotId),
      purpose = String(b.purpose || "");
    if (!slotId || !AI_VIDEO_PURPOSES.includes(purpose as any))
      return Response.json(
        { error: "Choose a valid Purpose for this Video Slot." },
        { status: 400 },
      );
    const slot = await db
      .prepare("SELECT id,status FROM video_slots WHERE id=? AND project_id=?")
      .bind(slotId, b.id)
      .first<any>();
    if (!slot)
      return Response.json({ error: "Video Slot not found" }, { status: 404 });
    if (slot.status === "Awaiting Payment")
      return Response.json(
        {
          error: "Select at least 25% payment before activating a Video Slot.",
        },
        { status: 409 },
      );
    const slotFlow = [
      "Creative Direction",
      "Script · Client Review",
      "Keyshot Image Set · Client Review",
      "Video Generation",
      "Final Video · Client Review",
      "Final Delivery",
    ];
    await db
      .prepare(
        "UPDATE video_slots SET purpose=?,status='Active',phase_status='In Progress',data=? WHERE id=? AND project_id=?",
      )
      .bind(
        purpose,
        JSON.stringify({
          currentPhase: "Creative Direction",
          workflow: slotFlow,
          phases: { creativeDirection: { status: "In Progress", content: {} } },
        }),
        slotId,
        b.id,
      )
      .run();
    await db
      .prepare(
        "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
      )
      .bind(
        b.id,
        "video_slot_activated",
        a.email,
        JSON.stringify({ slotId, purpose }),
        new Date().toISOString(),
      )
      .run();
    return Response.json({ ok: true });
  }
  if (
    b.action === "reviewVideoSlotCreativeDirection" &&
    b.slotPhase === "script"
  )
    b.action = "reviewVideoSlotScript";
  if (
    [
      "saveVideoSlotCreativeDirection",
      "submitVideoSlotCreativeDirection",
      "reviewVideoSlotCreativeDirection",
    ].includes(b.action)
  ) {
    const slotId = Number(b.slotId),
      slot = await db
        .prepare(
          "SELECT id,slot_number AS slotNumber,purpose,status,data FROM video_slots WHERE id=? AND project_id=?",
        )
        .bind(slotId, b.id)
        .first<any>();
    if (!slot || slot.status !== "Active")
      return Response.json(
        { error: "Activate this Video Slot and choose its Purpose first." },
        { status: 409 },
      );
    let data: any = {};
    try {
      data = JSON.parse(slot.data || "{}");
    } catch {}
    data.phases = data.phases || {};
    if (b.slotPhase === "change-request") {
      const target = String(b.targetPhase || ""),
        targetPhase = data.phases[target];
      if (!targetPhase || targetPhase.status !== "Approved")
        return Response.json(
          {
            error:
              "Change Request is available only for an approved Slot phase.",
          },
          { status: 409 },
        );
      data.changeRequests = data.changeRequests || [];
      data.changeRequests.push({
        id: crypto.randomUUID(),
        targetPhase: target,
        note: String(b.requestNote || "Change requested"),
        requestedBy: a.email,
        status: "Requested",
        createdAt: new Date().toISOString(),
      });
      const now = new Date().toISOString(),
        phaseKey = `video-slot-${slotId}-${target}`;
      await db
        .prepare("UPDATE video_slots SET data=? WHERE id=? AND project_id=?")
        .bind(JSON.stringify(data), slotId, b.id)
        .run();
      await db
        .prepare(
          "INSERT INTO change_requests(project_id,phase_key,requested_by,request_note,status,created_at) VALUES(?,?,?,?,?,?)",
        )
        .bind(
          b.id,
          phaseKey,
          a.email,
          b.requestNote || "Change requested",
          "Requested",
          now,
        )
        .run();
      await db
        .prepare(
          "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(
          b.id,
          "video_slot_change_requested",
          a.email,
          JSON.stringify({
            slotId,
            targetPhase: target,
            note: b.requestNote || "",
          }),
          now,
        )
        .run();
      return Response.json({ ok: true });
    }
    if (b.slotPhase === "keyshots") {
      if (data.phases.script?.status !== "Approved")
        return Response.json(
          {
            error:
              "The Script must receive client ✅ before Keyshot Image Set can begin.",
          },
          { status: 409 },
        );
      const current = data.phases.keyshots || {
        status: "In Progress",
        content: {},
      };
      if (b.action === "reviewVideoSlotCreativeDirection") {
        if (a.member.tier > 1)
          return Response.json(
            { error: "Management access required" },
            { status: 403 },
          );
        if (current.status !== "Reviewing")
          return Response.json(
            { error: "Keyshot Image Set is not awaiting internal review." },
            { status: 409 },
          );
        const approved = b.decision === "approve",
          reviewNote = String(b.reviewNote || "").trim();
        if (!approved && !reviewNote)
          return Response.json(
            { error: "Retake feedback is required." },
            { status: 400 },
          );
        const now = new Date().toISOString();
        if (!approved) {
          data.phases.keyshots = { ...current, status: "Retake", reviewNote };
          data.currentPhase = "Keyshot Image Set · Client Review";
          await db
            .prepare(
              "UPDATE video_slots SET phase_status='Retake',data=? WHERE id=? AND project_id=?",
            )
            .bind(JSON.stringify(data), slotId, b.id)
            .run();
          return Response.json({ ok: true });
        }
        const scopeId = `video-slot-${slot.slotNumber}-keyshots`,
          used = await db
            .prepare(
              "SELECT COUNT(*) AS count FROM review_sessions WHERE project_id=? AND scope_type='video-slot' AND scope_id=?",
            )
            .bind(b.id, scopeId)
            .first<any>(),
          token = crypto.randomUUID().replaceAll("-", ""),
          expires = new Date(Date.now() + 3 * 86400000).toISOString(),
          url = `${new URL(req.url).origin}/review/client?token=${token}`;
        data.phases.keyshots = {
          ...current,
          status: "Client Reviewing",
          reviewNote: null,
          internalApprovedBy: a.email,
          internalApprovedAt: now,
          externalReviewToken: token,
          externalReviewExpiresAt: expires,
          externalReviewUrl: url,
        };
        data.currentPhase = "Keyshot Image Set · Client Review";
        await db
          .prepare(
            "UPDATE external_review_links SET status='Invalid',invalidated_at=? WHERE project_id=? AND batch_id=? AND status='Active'",
          )
          .bind(now, b.id, -slotId)
          .run();
        await db
          .prepare(
            "INSERT INTO external_review_links(project_id,batch_id,token_hash,status,expires_at,created_by,created_at) VALUES(?,?,?,'Active',?,?,?)",
          )
          .bind(b.id, -slotId, token, expires, a.email, now)
          .run();
        await db
          .prepare(
            "INSERT INTO review_sessions(project_id,scope_type,scope_id,review_kind,session_number,max_included,status,submitted_at,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            b.id,
            "video-slot",
            scopeId,
            "client",
            Number(used?.count || 0) + 1,
            3,
            "Open",
            now,
            now,
          )
          .run();
        await db
          .prepare(
            "UPDATE video_slots SET phase_status='Client Reviewing',data=? WHERE id=? AND project_id=?",
          )
          .bind(JSON.stringify(data), slotId, b.id)
          .run();
        return Response.json({ ok: true, externalReviewUrl: url });
      }
      if (
        ["Reviewing", "Client Reviewing", "Approved"].includes(current.status)
      )
        return Response.json(
          {
            error:
              "Keyshot Image Set is frozen during review or after approval.",
          },
          { status: 409 },
        );
      let content: any = {};
      try {
        content = JSON.parse(b.payload || "{}");
      } catch {
        return Response.json(
          { error: "Invalid Keyshot content." },
          { status: 400 },
        );
      }
      const keyshotKeys = Object.keys(content).filter(
        (k) => /^keyshot_\d+$/.test(k) && String(content[k] || "").trim(),
      );
      if (!keyshotKeys.length)
        return Response.json(
          { error: "Extract or add at least one Keyshot." },
          { status: 400 },
        );
      const submitted = b.action === "submitVideoSlotCreativeDirection";
      if (submitted) {
        await ensureAssetTable(db);
        const phaseName = `video-slot-${slot.slotNumber}-keyshots`,
          missing: string[] = [];
        for (const itemKey of keyshotKeys) {
          const uploaded = await db
            .prepare(
              "SELECT id FROM visual_asset_revisions WHERE project_id=? AND phase=? AND item_key=? AND is_current=1 LIMIT 1",
            )
            .bind(b.id, phaseName, itemKey)
            .first();
          if (!uploaded) missing.push(itemKey.replace("keyshot_", "Keyshot "));
        }
        if (missing.length)
          return Response.json(
            {
              error: `Upload at least one image for ${missing.join(", ")} before Internal Review.`,
            },
            { status: 400 },
          );
      }
      const now = new Date().toISOString();
      data.phases.keyshots = {
        ...current,
        status: submitted ? "Reviewing" : "In Progress",
        content,
        reviewNote: null,
        updatedBy: a.email,
        updatedAt: now,
      };
      data.currentPhase = "Keyshot Image Set · Client Review";
      await db
        .prepare(
          "UPDATE video_slots SET phase_status=?,data=? WHERE id=? AND project_id=?",
        )
        .bind(
          submitted ? "Reviewing" : "In Progress",
          JSON.stringify(data),
          slotId,
          b.id,
        )
        .run();
      return Response.json({ ok: true });
    }
    const current = data.phases.creativeDirection || {
      status: "In Progress",
      content: {},
    };
    if (b.action === "reviewVideoSlotCreativeDirection") {
      if (a.member.tier > 1)
        return Response.json(
          { error: "Management access required" },
          { status: 403 },
        );
      if (current.status !== "Reviewing")
        return Response.json(
          { error: "Creative Direction is not awaiting review." },
          { status: 409 },
        );
      const approved = b.decision === "approve",
        reviewNote = String(b.reviewNote || "").trim();
      if (!approved && !reviewNote)
        return Response.json(
          { error: "Retake feedback is required." },
          { status: 400 },
        );
      data.phases.creativeDirection = {
        ...current,
        status: approved ? "Approved" : "Retake",
        reviewNote: approved ? null : reviewNote,
        approvedBy: approved ? a.email : null,
        approvedAt: approved ? new Date().toISOString() : null,
      };
      if (approved) data.currentPhase = "Script · Client Review";
      await db
        .prepare(
          "UPDATE video_slots SET phase_status=?,data=? WHERE id=? AND project_id=?",
        )
        .bind(
          approved ? "In Progress" : "Retake",
          JSON.stringify(data),
          slotId,
          b.id,
        )
        .run();
      if (approved)
        await saveApprovedSnapshot(db, {
          projectId: b.id,
          phaseKey: `video-slot-${slot.slotNumber}-creative-direction`,
          phaseLabel: `Video Slot ${slot.slotNumber} · Creative Direction`,
          content: current.content || {},
          approvedBy: a.email,
          generationMethod: current.content?._generationMethod || "Manual",
        });
      await db
        .prepare(
          "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(
          b.id,
          approved
            ? "video_slot_direction_approved"
            : "video_slot_direction_retake",
          a.email,
          JSON.stringify({ slotId, slotNumber: slot.slotNumber, reviewNote }),
          new Date().toISOString(),
        )
        .run();
      return Response.json({ ok: true });
    }
    if (["Reviewing", "Approved"].includes(current.status))
      return Response.json(
        {
          error:
            "Creative Direction is frozen during review or after approval.",
        },
        { status: 409 },
      );
    let content: any = {};
    try {
      content = JSON.parse(b.payload || "{}");
    } catch {
      return Response.json(
        { error: "Invalid Creative Direction content." },
        { status: 400 },
      );
    }
    if (!Object.values(content).some((x) => String(x || "").trim()))
      return Response.json(
        { error: "Fill at least one Creative Direction field." },
        { status: 400 },
      );
    const submitted = b.action === "submitVideoSlotCreativeDirection";
    data.phases.creativeDirection = {
      ...current,
      status: submitted ? "Reviewing" : "In Progress",
      content,
      reviewNote: null,
      updatedBy: a.email,
      updatedAt: new Date().toISOString(),
    };
    data.currentPhase = "Creative Direction";
    await db
      .prepare(
        "UPDATE video_slots SET phase_status=?,data=? WHERE id=? AND project_id=?",
      )
      .bind(
        submitted ? "Reviewing" : "In Progress",
        JSON.stringify(data),
        slotId,
        b.id,
      )
      .run();
    await db
      .prepare(
        "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
      )
      .bind(
        b.id,
        submitted
          ? "video_slot_direction_submitted"
          : "video_slot_direction_saved",
        a.email,
        JSON.stringify({ slotId, slotNumber: slot.slotNumber }),
        new Date().toISOString(),
      )
      .run();
    return Response.json({ ok: true });
  }
  if (
    [
      "saveVideoSlotScript",
      "submitVideoSlotScript",
      "reviewVideoSlotScript",
    ].includes(b.action)
  ) {
    const slotId = Number(b.slotId),
      slot = await db
        .prepare(
          "SELECT id,slot_number AS slotNumber,purpose,status,data FROM video_slots WHERE id=? AND project_id=?",
        )
        .bind(slotId, b.id)
        .first<any>();
    if (!slot || slot.status !== "Active")
      return Response.json(
        { error: "Active Video Slot not found." },
        { status: 404 },
      );
    let data: any = {};
    try {
      data = JSON.parse(slot.data || "{}");
    } catch {}
    data.phases = data.phases || {};
    if (data.phases.creativeDirection?.status !== "Approved")
      return Response.json(
        { error: "Creative Direction must be approved before Script begins." },
        { status: 409 },
      );
    const current = data.phases.script || {
      status: "In Progress",
      content: {},
    };
    if (b.action === "reviewVideoSlotScript") {
      if (a.member.tier > 1)
        return Response.json(
          { error: "Management access required" },
          { status: 403 },
        );
      if (current.status !== "Reviewing")
        return Response.json(
          { error: "Script is not awaiting internal review." },
          { status: 409 },
        );
      const approved = b.decision === "approve",
        reviewNote = String(b.reviewNote || "").trim();
      if (!approved && !reviewNote)
        return Response.json(
          { error: "Retake feedback is required." },
          { status: 400 },
        );
      const now = new Date().toISOString();
      if (!approved) {
        data.phases.script = { ...current, status: "Retake", reviewNote };
        data.currentPhase = "Script · Client Review";
        await db
          .prepare(
            "UPDATE video_slots SET phase_status='Retake',data=? WHERE id=? AND project_id=?",
          )
          .bind(JSON.stringify(data), slotId, b.id)
          .run();
        await db
          .prepare(
            "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
          )
          .bind(
            b.id,
            "video_slot_script_retake",
            a.email,
            JSON.stringify({ slotId, slotNumber: slot.slotNumber, reviewNote }),
            now,
          )
          .run();
        return Response.json({ ok: true });
      }
      const scopeId = `video-slot-${slot.slotNumber}-script`,
        used = await db
          .prepare(
            "SELECT COUNT(*) AS count FROM review_sessions WHERE project_id=? AND scope_type='video-slot' AND scope_id=?",
          )
          .bind(b.id, scopeId)
          .first<any>();
      if (Number(used?.count || 0) >= 3 && b.additionalFeeApproved !== "true")
        return Response.json(
          {
            error:
              "Included Script review limit reached (3). Management must approve additional quotation.",
          },
          { status: 409 },
        );
      const token = crypto.randomUUID().replaceAll("-", ""),
        expires = new Date(Date.now() + 3 * 86400000).toISOString(),
        url = `${new URL(req.url).origin}/review/client?token=${token}`;
      data.phases.script = {
        ...current,
        status: "Client Reviewing",
        reviewNote: null,
        internalApprovedBy: a.email,
        internalApprovedAt: now,
        externalReviewToken: token,
        externalReviewExpiresAt: expires,
        externalReviewUrl: url,
      };
      data.currentPhase = "Script · Client Review";
      await db
        .prepare(
          "UPDATE external_review_links SET status='Invalid',invalidated_at=? WHERE project_id=? AND batch_id=? AND status='Active'",
        )
        .bind(now, b.id, -slotId)
        .run();
      await db
        .prepare(
          "INSERT INTO external_review_links(project_id,batch_id,token_hash,status,expires_at,created_by,created_at) VALUES(?,?,?,'Active',?,?,?)",
        )
        .bind(b.id, -slotId, token, expires, a.email, now)
        .run();
      await db
        .prepare(
          "INSERT INTO review_sessions(project_id,scope_type,scope_id,review_kind,session_number,max_included,status,submitted_at,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          b.id,
          "video-slot",
          scopeId,
          "client",
          Number(used?.count || 0) + 1,
          3,
          "Open",
          now,
          now,
        )
        .run();
      await db
        .prepare(
          "UPDATE video_slots SET phase_status='Client Reviewing',data=? WHERE id=? AND project_id=?",
        )
        .bind(JSON.stringify(data), slotId, b.id)
        .run();
      await db
        .prepare(
          "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(
          b.id,
          "video_slot_script_internal_approved",
          a.email,
          JSON.stringify({ slotId, slotNumber: slot.slotNumber, expires }),
          now,
        )
        .run();
      return Response.json({ ok: true, externalReviewUrl: url });
    }
    if (["Reviewing", "Client Reviewing", "Approved"].includes(current.status))
      return Response.json(
        { error: "Script is frozen during review or after approval." },
        { status: 409 },
      );
    let content: any = {};
    try {
      content = JSON.parse(b.payload || "{}");
    } catch {
      return Response.json(
        { error: "Invalid Script content." },
        { status: 400 },
      );
    }
    for (const decision of current.clientReview?.decisions || [])
      if (
        decision.decision === "approve" &&
        Object.prototype.hasOwnProperty.call(current.content || {}, decision.id)
      )
        content[decision.id] = current.content[decision.id];
    if (!Object.values(content).some((x) => String(x || "").trim()))
      return Response.json(
        { error: "Fill at least one Script field." },
        { status: 400 },
      );
    const submitted = b.action === "submitVideoSlotScript",
      now = new Date().toISOString();
    data.phases.script = {
      ...current,
      status: submitted ? "Reviewing" : "In Progress",
      content,
      reviewNote: null,
      updatedBy: a.email,
      updatedAt: now,
    };
    data.currentPhase = "Script · Client Review";
    await db
      .prepare(
        "UPDATE video_slots SET phase_status=?,data=? WHERE id=? AND project_id=?",
      )
      .bind(
        submitted ? "Reviewing" : "In Progress",
        JSON.stringify(data),
        slotId,
        b.id,
      )
      .run();
    await db
      .prepare(
        "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at) VALUES(?,?,?,?,?)",
      )
      .bind(
        b.id,
        submitted ? "video_slot_script_submitted" : "video_slot_script_saved",
        a.email,
        JSON.stringify({ slotId, slotNumber: slot.slotNumber }),
        now,
      )
      .run();
    return Response.json({ ok: true });
  }
  if (b.action === "submitVisualDevelopment") {
    let data: any = {};
    const p = await db
      .prepare("SELECT script_data AS data FROM projects WHERE id=?")
      .bind(b.id)
      .first<any>();
    try {
      data = JSON.parse(p?.data || "{}");
      data.visualDevelopment = JSON.parse(b.payload || "[]");
    } catch {
      return Response.json(
        { error: "Invalid visual development data" },
        { status: 400 },
      );
    }
    const content = data.visualDevelopment;
    if (!Array.isArray(content) || !content.length)
      return Response.json(
        { error: "Generate at least one production asset before submitting." },
        { status: 400 },
      );
    await ensureAssetTable(db);
    const missing: string[] = [];
    for (let i = 0; i < content.length; i++) {
      const key = `${String(content[i].category || "asset")
          .toLowerCase()
          .replaceAll(" ", "-")}-${i + 1}`,
        row = await db
          .prepare(
            "SELECT COUNT(*) count FROM visual_asset_revisions WHERE project_id=? AND phase='visual-development' AND item_key=? AND is_current=1",
          )
          .bind(b.id, key)
          .first<any>();
      if (!Number(row?.count || 0))
        missing.push(content[i].name || `Asset ${i + 1}`);
    }
    if (missing.length)
      return Response.json(
        { error: `Upload at least one image for: ${missing.join(", ")}` },
        { status: 400 },
      );
    delete data.productionReviews;
    await db
      .prepare(
        "UPDATE projects SET script_data=?,assignment_stage='Visual Development & Image Generation',assignment_status='Awaiting Approval',approval_title='Visual Development & Image Generation Review',stage='Visual Development & Image Generation · Waiting Approval',progress=82 WHERE id=?",
      )
      .bind(JSON.stringify(data), b.id)
      .run();
    b.action = "visualSubmitted";
  }
  if (b.action === "saveVisualDevelopment") {
    const p = await db
      .prepare("SELECT script_data AS data FROM projects WHERE id=?")
      .bind(b.id)
      .first<{ data: string }>();
    let data: any = {};
    try {
      data = JSON.parse(p?.data || "{}");
      data.visualDevelopment = JSON.parse(b.payload || "[]");
    } catch {
      return Response.json(
        { error: "Invalid visual development data" },
        { status: 400 },
      );
    }
    await db
      .prepare(
        "UPDATE projects SET script_data=?,assignment_stage='Visual Development & Image Generation',assignment_status='Ongoing',stage='Visual Development & Image Generation · In Progress',progress=78 WHERE id=?",
      )
      .bind(JSON.stringify(data), b.id)
      .run();
    b.action = "visualSaved";
  }
  if (b.action === "submitSavedProduction") {
    const p = await db
      .prepare(
        "SELECT assignment_stage AS stage,script_data AS data FROM projects WHERE id=?",
      )
      .bind(b.id)
      .first<any>();
    if (
      /Visual Development|Production Design & Image Generation/i.test(
        String(p?.stage || ""),
      )
    ) {
      let data: any = {};
      try {
        data = JSON.parse(p?.data || "{}");
      } catch {}
      const content = data.visualDevelopment;
      if (!Array.isArray(content) || !content.length)
        return Response.json(
          { error: "Save Visual Development before submitting." },
          { status: 400 },
        );
      await ensureAssetTable(db);
      const missing: string[] = [];
      for (let i = 0; i < content.length; i++) {
        const key = `${String(content[i].category || "asset")
            .toLowerCase()
            .replaceAll(" ", "-")}-${i + 1}`,
          row = await db
            .prepare(
              "SELECT COUNT(*) count FROM visual_asset_revisions WHERE project_id=? AND phase='visual-development' AND item_key=? AND is_current=1",
            )
            .bind(b.id, key)
            .first<any>();
        if (!Number(row?.count || 0))
          missing.push(content[i].name || `Asset ${i + 1}`);
      }
      if (missing.length)
        return Response.json(
          {
            error: `Upload at least one current image for every asset before approval. Missing: ${missing.join(", ")}`,
          },
          { status: 400 },
        );
      await db
        .prepare(
          "UPDATE projects SET assignment_status='Awaiting Approval',approval_title='Visual Development & Image Generation Review',stage='Visual Development & Image Generation · Waiting Approval',progress=82 WHERE id=?",
        )
        .bind(b.id)
        .run();
      b.action = "visualSubmitted";
    }
  }
  if (b.action === "reviewProductionItems") {
    const p = await db
      .prepare(
        "SELECT approval_title AS title,script_data AS data FROM projects WHERE id=?",
      )
      .bind(b.id)
      .first<any>();
    if (
      /Visual Development|Production Design & Image Generation/i.test(
        String(p?.title || ""),
      )
    ) {
      if (a.member.tier > 1)
        return Response.json(
          { error: "Management access required" },
          { status: 403 },
        );
      let data: any = {},
        reviews: any[] = [];
      try {
        data = JSON.parse(p?.data || "{}");
        reviews = JSON.parse(b.reviews || b.payload || "[]");
      } catch {
        return Response.json(
          { error: "Invalid visual review" },
          { status: 400 },
        );
      }
      const content = data.visualDevelopment || [];
      if (reviews.length !== content.length)
        return Response.json(
          { error: "Review every visual item." },
          { status: 400 },
        );
      data.productionReviews = reviews.map((r: any, i: number) => ({
        index: i,
        status: r.status === "approved" ? "approved" : "refine",
        note: String(r.note || "").trim(),
        reviewedBy: a.member.name,
        reviewedAt: new Date().toISOString(),
      }));
      const refine = data.productionReviews.filter(
        (r: any) => r.status === "refine",
      );
      if (refine.length) {
        const summary = refine
          .map(
            (r: any) =>
              `${content[r.index]?.category || "Visual"} ${r.index + 1}: ${r.note || "Please refine this item."}`,
          )
          .join(" | ");
        await db
          .prepare(
            "UPDATE projects SET script_data=?,assignment_status='Revision Requested',revision_note=?,approval_title=NULL,stage='Visual Development & Image Generation · Revision',progress=80 WHERE id=?",
          )
          .bind(JSON.stringify(data), summary, b.id)
          .run();
      } else {
        await db
          .prepare(
            "INSERT INTO document_versions(project_id,document_type,version,snapshot,approved_by,created_at) VALUES(?,?,?,?,?,?)",
          )
          .bind(
            b.id,
            "Visual Development & Image Generation",
            1,
            JSON.stringify(data),
            a.email,
            new Date().toISOString(),
          )
          .run();
        await db
          .prepare(
            "UPDATE projects SET script_data=?,assignment_stage='Video Generation',assignment_status='Ongoing',revision_note=NULL,approval_title=NULL,stage='Video Generation · Ready',progress=86 WHERE id=?",
          )
          .bind(JSON.stringify(data), b.id)
          .run();
      }
      b.action = "visualReviewed";
    }
  }
  if (b.action === "dismissEdit") {
    if (a.member.tier > 1)
      return Response.json(
        { error: "Management access required" },
        { status: 403 },
      );
    await db
      .prepare("DELETE FROM research_edits WHERE id=?")
      .bind(Number(b.notificationId))
      .run();
    return Response.json({ ok: true });
  }
  if (b.action === "clearEditNotifications") {
    if (a.member.tier > 1)
      return Response.json(
        { error: "Management access required" },
        { status: 403 },
      );
    await db.prepare("DELETE FROM research_edits").run();
    return Response.json({ ok: true });
  }
  if (b.action === "saveBrief") {
    const current = await db
        .prepare(
          "SELECT brief_version AS version,brief_status AS status FROM projects WHERE id=?",
        )
        .bind(b.id)
        .first<{ version: number }>(),
      version = (current?.version || 0) + 1;
    const snapshot = {
      briefOwner: b.briefOwner || "Owner / Project Manager",
      clientName: b.clientName || "",
      brandOverview: b.brandOverview || "",
      projectGoal: b.projectGoal || "",
      audience: b.audience || "",
      deliverables: b.deliverables || "",
      keyMessage: b.keyMessage || "",
      tone: b.tone || "",
      dueDate: b.dueDate || "",
      restrictions: b.restrictions || "",
    };
    await db
      .prepare(
        `UPDATE projects SET brief_owner=?,client_name=?,brand_overview=?,project_goal=?,audience=?,deliverables=?,key_message=?,tone=?,due_date=COALESCE(NULLIF(?,''),project_end_date),restrictions=?,brief_status='Complete',brief_version=?,drive_sync_status='Pending Drive connection',assignment_stage=CASE WHEN ?='Complete' THEN assignment_stage ELSE 'Assign Project Members' END,assignment_status=CASE WHEN ?='Complete' THEN assignment_status ELSE 'Ongoing' END,assignment_due_at=project_end_date,stage=CASE WHEN ?='Complete' THEN stage ELSE 'Assign Project Members · Ready' END,progress=CASE WHEN ?='Complete' THEN progress ELSE 18 END WHERE id=?`,
      )
      .bind(
        ...Object.values(snapshot),
        version,
        current?.status,
        current?.status,
        current?.status,
        current?.status,
        b.id,
      )
      .run();
    await db
      .prepare(
        "INSERT INTO document_versions(project_id,document_type,version,snapshot,approved_by,created_at) VALUES(?,?,?,?,?,?)",
      )
      .bind(
        b.id,
        "Client Brief",
        version,
        JSON.stringify(snapshot),
        a.email,
        new Date().toISOString(),
      )
      .run();
    await saveApprovedSnapshot(db, {
      projectId: b.id,
      phaseKey: "client-brief",
      phaseLabel: "Client Brief",
      content: snapshot,
      approvedBy: a.email,
      generationMethod: "Manual",
    });
  }
  if (b.action === "assign") {
    let emails: string[] = [];
    try {
      emails = JSON.parse(b.assigneeEmails || "[]");
    } catch {}
    emails = [
      ...new Set(emails.map((x) => String(x).toLowerCase()).filter(Boolean)),
    ];
    if (!emails.length)
      return Response.json(
        { error: "Select at least one responsible member" },
        { status: 400 },
      );
    const marks = emails.map(() => "?").join(","),
      names = await db
        .prepare(`SELECT email,name FROM members WHERE email IN (${marks})`)
        .bind(...emails)
        .all();
    if (!names.results.length)
      return Response.json(
        { error: "No valid members selected" },
        { status: 400 },
      );
    const valid = names.results.map((x: any) => x.email),
      label = names.results.map((x: any) => x.name).join(", "),
      now = new Date().toISOString();
    await db
      .prepare(
        `UPDATE projects SET assignment_members=?,assignment_stage='Foundation 01–03',assignment_status='Ongoing',assigned_at=?,assignment_due_at=project_end_date,revision_note=NULL,research_assignee=?,trend_assignee=?,market_status='Assigned',trend_status='Assigned',stage='Foundation · In Progress',progress=24 WHERE id=?`,
      )
      .bind(JSON.stringify(valid), now, label, label, b.id)
      .run();
    const creator = await db
      .prepare(
        "SELECT actor_email AS email FROM audit_log WHERE project_id=? AND event_type='project_created' ORDER BY created_at LIMIT 1",
      )
      .bind(b.id)
      .first<any>();
    await db
      .prepare("DELETE FROM project_members WHERE project_id=?")
      .bind(b.id)
      .run();
    if (creator?.email)
      await db
        .prepare(
          "INSERT OR IGNORE INTO project_members(project_id,member_email) VALUES(?,?)",
        )
        .bind(b.id, String(creator.email).toLowerCase())
        .run();
    for (const email of valid)
      await db
        .prepare(
          "INSERT OR IGNORE INTO project_members(project_id,member_email) VALUES(?,?)",
        )
        .bind(b.id, email)
        .run();
  }
  if (b.action === "submitCombinedResearch") {
    await logResearchEdit(db, a, b, "Market");
    await logResearchEdit(db, a, b, "Trend");
    await db
      .prepare(
        `UPDATE projects SET market_snapshot=?,market_opportunities=?,market_direction=?,market_references=?,market_status='Submitted',trend_observations=?,trend_fit=?,trend_references=?,trend_status='Submitted',creative_concept=?,creative_objective=?,content_pillars=?,visual_style=?,tone_mood=?,key_takeaway=?,format_direction=?,assignment_status='Awaiting Approval',stage='Foundation · Waiting Approval',approval_title='Research + Creative Direction Review',progress=40 WHERE id=?`,
      )
      .bind(
        b.marketSnapshot || "",
        b.marketOpportunities || "",
        b.marketDirection || "",
        b.marketReferences || "[]",
        b.trendObservations || "",
        b.trendFit || "",
        b.trendReferences || "[]",
        b.creativeConcept || "",
        b.creativeObjective || "",
        b.contentPillars || "",
        b.visualStyle || "",
        b.toneMood || "",
        b.keyTakeaway || "",
        b.formatDirection || "",
        b.id,
      )
      .run();
  }
  if (b.action === "approveCombinedResearch") {
    if (a.member.tier > 1)
      return Response.json(
        { error: "Management access required" },
        { status: 403 },
      );
    const p = await db
        .prepare(
          "SELECT type,research_version AS version,market_snapshot,market_opportunities,market_direction,market_references,trend_observations,trend_fit,trend_references,creative_concept,creative_objective,content_pillars,visual_style,tone_mood,key_takeaway,format_direction FROM projects WHERE id=?",
        )
        .bind(b.id)
        .first<Record<string, any>>(),
      version = Number(p?.version || 0) + 1;
    await db
      .prepare(
        "INSERT INTO document_versions(project_id,document_type,version,snapshot,approved_by,created_at) VALUES(?,?,?,?,?,?)",
      )
      .bind(
        b.id,
        "Research + Creative Direction",
        version,
        JSON.stringify(p || {}),
        a.email,
        new Date().toISOString(),
      )
      .run();
    const mv = p?.type === "MV";
    await db
      .prepare(
        "UPDATE projects SET market_status='Approved',trend_status='Approved',research_version=?,foundation_status=CASE WHEN ? THEN 'Draft' ELSE foundation_status END,script_status=CASE WHEN ? THEN script_status ELSE 'Draft' END,assignment_stage=?,assignment_status='Ongoing',assigned_at=datetime('now'),drive_sync_status='Pending Drive connection',approval_title=NULL,stage=?,progress=? WHERE id=?",
      )
      .bind(
        version,
        mv,
        mv,
        mv ? "Foundation" : "Script",
        mv ? "Foundation · In Progress" : "Script · In Progress",
        mv ? 46 : 50,
        b.id,
      )
      .run();
  }
  if (b.action === "reviseCombinedResearch")
    await db
      .prepare(
        "UPDATE projects SET market_status='Revision Requested',trend_status='Revision Requested',assignment_status='Revision Requested',revision_note=?,approval_title=NULL,stage='Research · Revision',progress=33 WHERE id=?",
      )
      .bind(b.revisionNote || "Please revise the submitted foundation.", b.id)
      .run();
  if (b.action === "saveFoundation" || b.action === "submitFoundation") {
    const p = await db
      .prepare("SELECT type,script_data AS data FROM projects WHERE id=?")
      .bind(b.id)
      .first<any>();
    if (p?.type !== "MV")
      return Response.json(
        { error: "Foundation 04 is only used for MV projects" },
        { status: 400 },
      );
    let data: any = {};
    try {
      data = JSON.parse(p?.data || "{}");
      data.foundation = JSON.parse(b.payload || "{}");
    } catch {
      return Response.json(
        { error: "Invalid Foundation data" },
        { status: 400 },
      );
    }
    const submitted = b.action === "submitFoundation";
    await db
      .prepare(
        "UPDATE projects SET script_data=?,foundation_status=?,assignment_stage='Foundation',assignment_status=?,approval_title=?,stage=?,progress=? WHERE id=?",
      )
      .bind(
        JSON.stringify(data),
        submitted ? "Submitted" : "Draft",
        submitted ? "Awaiting Approval" : "Ongoing",
        submitted ? "Foundation Review" : null,
        submitted
          ? "Foundation · Waiting Approval"
          : "Foundation · In Progress",
        submitted ? 48 : 46,
        b.id,
      )
      .run();
  }
  if (b.action === "reviewFoundation") {
    if (a.member.tier > 1)
      return Response.json(
        { error: "Management access required" },
        { status: 403 },
      );
    const approved = b.decision === "approve",
      note = String(b.reviewNote || "").trim();
    if (!approved && !note)
      return Response.json(
        { error: "Write a review comment before requesting revision." },
        { status: 400 },
      );
    const p = await db
        .prepare(
          "SELECT foundation_version AS version,script_data AS data FROM projects WHERE id=?",
        )
        .bind(b.id)
        .first<any>(),
      version = Number(p?.version || 0) + (approved ? 1 : 0);
    if (approved)
      await db
        .prepare(
          "INSERT INTO document_versions(project_id,document_type,version,snapshot,approved_by,created_at) VALUES(?,?,?,?,?,?)",
        )
        .bind(
          b.id,
          "MV Foundation",
          version,
          p?.data || "{}",
          a.email,
          new Date().toISOString(),
        )
        .run();
    await db
      .prepare(
        "UPDATE projects SET foundation_status=?,foundation_version=?,assignment_stage=?,assignment_status=?,revision_note=?,approval_title=NULL,stage=?,progress=? WHERE id=?",
      )
      .bind(
        approved ? "Approved" : "Revision Requested",
        version,
        approved ? "MV Lyrics & Style" : "Foundation",
        approved ? "Ongoing" : "Revision Requested",
        approved ? null : note,
        approved ? "MV Music 1/2 · Ready" : "Foundation · Revision",
        approved ? 50 : 46,
        b.id,
      )
      .run();
  }
  if (b.action === "submitMvLyrics") {
    const p = await db
      .prepare("SELECT type,script_data AS data FROM projects WHERE id=?")
      .bind(b.id)
      .first<any>();
    if (p?.type !== "MV")
      return Response.json(
        { error: "This checkpoint is only available for MV projects" },
        { status: 400 },
      );
    let data: any = {};
    try {
      data = JSON.parse(p?.data || "{}");
    } catch {}
    const lyrics = String(b.songLyrics || "").trim(),
      style = String(b.songStyle || "").trim();
    if (!lyrics || !style)
      return Response.json(
        {
          error:
            "Complete both Song Lyrics and Song Style before submitting checkpoint 1/2.",
        },
        { status: 400 },
      );
    data.songLyrics = lyrics;
    data.songStyle = style;
    data.mvMusic = {
      ...(data.mvMusic || {}),
      lyricsStatus: "submitted",
      songStatus: "locked",
      lyricsSubmittedAt: new Date().toISOString(),
    };
    await db
      .prepare(
        "UPDATE projects SET script_data=?,script_status='Music 1/2 Submitted',assignment_status='Awaiting Approval',approval_title='MV Music Review · 1/2 Lyrics & Style',stage='MV Music 1/2 · Waiting Approval',progress=52 WHERE id=?",
      )
      .bind(JSON.stringify(data), b.id)
      .run();
  }
  if (b.action === "submitMvSong") {
    const p = await db
      .prepare("SELECT type,script_data AS data FROM projects WHERE id=?")
      .bind(b.id)
      .first<any>();
    if (p?.type !== "MV")
      return Response.json(
        { error: "This checkpoint is only available for MV projects" },
        { status: 400 },
      );
    let data: any = {};
    try {
      data = JSON.parse(p?.data || "{}");
    } catch {}
    if (data.mvMusic?.lyricsStatus !== "approved")
      return Response.json(
        {
          error:
            "Lyrics & Style must be approved before the finished song can be submitted.",
        },
        { status: 400 },
      );
    await ensureAssetTable(db);
    const audio = await db
      .prepare(
        "SELECT COUNT(*) count FROM visual_asset_revisions WHERE project_id=? AND phase='mv-song' AND item_key='master-song' AND is_current=1",
      )
      .bind(b.id)
      .first<any>();
    if (!Number(audio?.count || 0))
      return Response.json(
        {
          error:
            "Upload the current finished song before submitting checkpoint 2/2.",
        },
        { status: 400 },
      );
    data.mvMusic = {
      ...(data.mvMusic || {}),
      songStatus: "submitted",
      songSubmittedAt: new Date().toISOString(),
    };
    await db
      .prepare(
        "UPDATE projects SET script_data=?,script_status='Music 2/2 Submitted',assignment_status='Awaiting Approval',approval_title='MV Music Review · 2/2 Finished Song',stage='MV Music 2/2 · Waiting Approval',progress=56 WHERE id=?",
      )
      .bind(JSON.stringify(data), b.id)
      .run();
  }
  if (b.action === "reviewMvMusic") {
    if (a.member.tier > 1)
      return Response.json(
        { error: "Management access required" },
        { status: 403 },
      );
    const p = await db
      .prepare("SELECT type,script_data AS data FROM projects WHERE id=?")
      .bind(b.id)
      .first<any>();
    if (p?.type !== "MV")
      return Response.json(
        { error: "This checkpoint is only available for MV projects" },
        { status: 400 },
      );
    let data: any = {};
    try {
      data = JSON.parse(p?.data || "{}");
    } catch {}
    const step = b.reviewStep === "song" ? "song" : "lyrics",
      approved = b.decision === "approve",
      note = String(b.reviewNote || "").trim();
    if (!approved && !note)
      return Response.json(
        { error: "Write a review comment before requesting revision." },
        { status: 400 },
      );
    data.mvMusic = {
      ...(data.mvMusic || {}),
      [`${step}Status`]: approved ? "approved" : "revision",
      [`${step}ReviewNote`]: note,
      [`${step}ReviewedBy`]: a.member.name,
      [`${step}ReviewedAt`]: new Date().toISOString(),
    };
    if (step === "lyrics" && approved) data.mvMusic.songStatus = "draft";
    if (step === "song" && approved) {
      data.mvMusic.workflowStatus = "approved";
      data.storyboardStatus = "draft";
    }
    const next =
      step === "lyrics"
        ? approved
          ? {
              script: "Music 1/2 Approved",
              assign: "MV Song Production & Upload",
              status: "Ongoing",
              title: null,
              stage: "MV Music 2/2 · Song Production",
              progress: 54,
            }
          : {
              script: "Music 1/2 Revision",
              assign: "MV Lyrics & Style",
              status: "Revision Requested",
              title: null,
              stage: "MV Music 1/2 · Revision",
              progress: 50,
            }
        : approved
          ? {
              script: "Music Approved",
              assign: "Storyboard",
              status: "Ongoing",
              title: null,
              stage: "Storyboard · Ready",
              progress: 62,
            }
          : {
              script: "Music 2/2 Revision",
              assign: "MV Song Production & Upload",
              status: "Revision Requested",
              title: null,
              stage: "MV Music 2/2 · Revision",
              progress: 54,
            };
    await db
      .prepare(
        "UPDATE projects SET script_data=?,script_status=?,assignment_stage=?,assignment_status=?,approval_title=?,revision_note=?,stage=?,progress=? WHERE id=?",
      )
      .bind(
        JSON.stringify(data),
        next.script,
        next.assign,
        next.status,
        next.title,
        approved ? null : note,
        next.stage,
        next.progress,
        b.id,
      )
      .run();
  }
  if (b.action === "submitScript") {
    const meta = await db
      .prepare(
        "SELECT type,project_nature AS nature,script_data AS existing FROM projects WHERE id=?",
      )
      .bind(b.id)
      .first<any>();
    let script: any = {},
      existing: any = {};
    try {
      script = JSON.parse(b.scriptData || "{}");
      existing = JSON.parse(meta?.existing || "{}");
    } catch {
      return Response.json({ error: "Invalid script data" }, { status: 400 });
    }
    if (meta?.type === "MV" && existing.mvMusic?.workflowStatus !== "approved")
      return Response.json(
        {
          error:
            "Approve MV Music checkpoints 1/2 and 2/2 before submitting the visual script.",
        },
        { status: 400 },
      );
    script = {
      ...existing,
      ...script,
      mvMusic: existing.mvMusic,
      songLyrics: existing.songLyrics,
      songStyle: existing.songStyle,
    };
    const required = [
      "theme",
      "duration",
      "storyPremise",
      "storyFlow",
      "ending",
      "meaning",
      "designReason",
    ];
    if (meta?.type === "Commercial Film Series") {
      const films = Array.isArray(script.films) ? script.films : [];
      if (films.length < 2)
        return Response.json(
          { error: "Create at least two film scripts for this series." },
          { status: 400 },
        );
      const filmRequired = [
          "title",
          "duration",
          "objective",
          "storyPremise",
          "storyFlow",
          "ending",
          "meaning",
          "designReason",
        ],
        incomplete = films
          .map((film: any, i: number) => ({
            number: i + 1,
            missing: filmRequired.filter(
              (k) => !String(film?.[k] || "").trim(),
            ),
          }))
          .filter((x: any) => x.missing.length);
      if (incomplete.length)
        return Response.json(
          {
            error: `Complete every Film Series script. ${incomplete.map((x: any) => `Film ${x.number}: ${x.missing.join(", ")}`).join(" | ")}`,
          },
          { status: 400 },
        );
    } else if (meta?.nature !== "recurring") {
      const missing = required.filter((k) => !String(script[k] || "").trim());
      if (missing.length)
        return Response.json(
          {
            error: `Complete all required Script fields before approval: ${missing.join(", ")}`,
          },
          { status: 400 },
        );
    }
    await db
      .prepare(
        "UPDATE projects SET script_data=?,script_status='Submitted',assignment_status='Awaiting Approval',approval_title='Script Review',stage='Script · Waiting Approval',progress=62 WHERE id=?",
      )
      .bind(JSON.stringify(script), b.id)
      .run();
  }
  if (b.action === "reviewScriptItems") {
    if (a.member.tier > 1)
      return Response.json(
        { error: "Management access required" },
        { status: 403 },
      );
    const p = await db
      .prepare("SELECT script_data AS data FROM projects WHERE id=?")
      .bind(b.id)
      .first<{ data: string }>();
    let data: any = {},
      reviews: any[] = [];
    try {
      data = JSON.parse(p?.data || "{}");
      reviews = JSON.parse(b.reviews || "[]");
    } catch {
      return Response.json({ error: "Invalid script review" }, { status: 400 });
    }
    data.reviews = reviews.map((r: any, i: number) => ({
      index: i,
      status: r.status === "approved" ? "approved" : "refine",
      note: String(r.note || "").trim(),
      reviewedBy: a.member.name,
      reviewedAt: new Date().toISOString(),
    }));
    const refine = data.reviews.filter((r: any) => r.status === "refine"),
      summary = refine
        .map(
          (r: any) =>
            `Script ${r.index + 1}: ${r.note || "Please refine this script."}`,
        )
        .join(" | ");
    if (refine.length)
      await db
        .prepare(
          "UPDATE projects SET script_data=?,script_status='Revision Requested',assignment_status='Revision Requested',revision_note=?,approval_title=NULL,stage='Script · Revision',progress=55 WHERE id=?",
        )
        .bind(JSON.stringify(data), summary, b.id)
        .run();
    else
      await db
        .prepare("UPDATE projects SET script_data=? WHERE id=?")
        .bind(JSON.stringify(data), b.id)
        .run();
    if (!refine.length) {
      b.action = "approveScript";
    }
  }
  if (b.action === "reviseScript")
    await db
      .prepare(
        "UPDATE projects SET script_status='Revision Requested',assignment_status='Revision Requested',revision_note=?,approval_title=NULL,stage='Script · Revision',progress=55 WHERE id=?",
      )
      .bind(b.revisionNote || "Please revise the submitted script.", b.id)
      .run();
  if (b.action === "approveScript") {
    if (a.member.tier > 1)
      return Response.json(
        { error: "Management access required" },
        { status: 403 },
      );
    const p = await db
        .prepare(
          "SELECT project_nature AS nature,script_data AS data,script_version AS version FROM projects WHERE id=?",
        )
        .bind(b.id)
        .first<Record<string, any>>(),
      version = Number(p?.version || 0) + 1;
    await db
      .prepare(
        "INSERT INTO document_versions(project_id,document_type,version,snapshot,approved_by,created_at) VALUES(?,?,?,?,?,?)",
      )
      .bind(
        b.id,
        "Script",
        version,
        p?.data || "{}",
        a.email,
        new Date().toISOString(),
      )
      .run();
    await db
      .prepare("DELETE FROM idea_folders WHERE project_id=?")
      .bind(b.id)
      .run();
    if (p?.nature === "recurring") {
      let data: any = {};
      try {
        data = JSON.parse(p?.data || "{}");
      } catch {}
      const ideas = Array.isArray(data.ideas) ? data.ideas : [];
      for (let i = 0; i < ideas.length; i++) {
        const x = ideas[i] || {},
          folder = `${String(i + 1).padStart(2, "0")}_${x.publishDate || "Date-TBC"}_${String(
            x.title || "Untitled Idea",
          )
            .replace(/[^a-zA-Z0-9 _-]/g, "")
            .trim()}`;
        await db
          .prepare(
            "INSERT INTO idea_folders(project_id,idea_index,title,publish_date,folder_name,created_at) VALUES(?,?,?,?,?,?)",
          )
          .bind(
            b.id,
            i + 1,
            x.title || "",
            x.publishDate || "",
            folder,
            new Date().toISOString(),
          )
          .run();
      }
    }
    await db
      .prepare(
        "UPDATE projects SET script_status='Approved',assignment_status='Ongoing',assignment_stage=?,revision_note=NULL,script_version=?,drive_sync_status='Pending Drive connection',approval_title=NULL,stage=?,progress=? WHERE id=?",
      )
      .bind(
        p?.nature === "recurring" ? "Image Generation" : "Storyboard",
        version,
        p?.nature === "recurring"
          ? "Image Generation · Ready"
          : "Storyboard · Ready",
        p?.nature === "recurring" ? 66 : 62,
        b.id,
      )
      .run();
  }
  if (
    b.action === "saveMvVisualScript" ||
    b.action === "submitMvVisualScript"
  ) {
    const p = await db
      .prepare("SELECT type,script_data AS data FROM projects WHERE id=?")
      .bind(b.id)
      .first<any>();
    if (p?.type !== "MV")
      return Response.json(
        { error: "Visual Script is only available for MV projects." },
        { status: 400 },
      );
    let data: any = {};
    try {
      data = JSON.parse(p?.data || "{}");
      data.visualScript = JSON.parse(b.payload || "[]");
    } catch {
      return Response.json(
        { error: "Invalid Visual Script data" },
        { status: 400 },
      );
    }
    if (!Array.isArray(data.visualScript) || !data.visualScript.length)
      return Response.json(
        {
          error: "Create the Visual Script from the approved Storyboard first.",
        },
        { status: 400 },
      );
    const submitted = b.action === "submitMvVisualScript";
    data.visualScriptStatus = submitted ? "submitted" : "draft";
    if (submitted) delete data.visualScriptReviews;
    await db
      .prepare(
        "UPDATE projects SET script_data=?,assignment_stage='Visual Script',assignment_status=?,approval_title=?,revision_note=NULL,stage=?,progress=? WHERE id=?",
      )
      .bind(
        JSON.stringify(data),
        submitted ? "Awaiting Approval" : "Ongoing",
        submitted ? "MV Visual Script Review" : null,
        submitted
          ? "Visual Script · Waiting Approval"
          : "Visual Script · In Progress",
        submitted ? 74 : 72,
        b.id,
      )
      .run();
  }
  if (b.action === "reviewMvVisualScript") {
    if (a.member.tier > 1)
      return Response.json(
        { error: "Management access required" },
        { status: 403 },
      );
    const p = await db
      .prepare("SELECT type,script_data AS data FROM projects WHERE id=?")
      .bind(b.id)
      .first<any>();
    let data: any = {},
      reviews: any[] = [];
    try {
      data = JSON.parse(p?.data || "{}");
      reviews = JSON.parse(b.payload || "[]");
    } catch {
      return Response.json(
        { error: "Invalid Visual Script review" },
        { status: 400 },
      );
    }
    if (p?.type !== "MV" || reviews.length !== (data.visualScript || []).length)
      return Response.json(
        { error: "Review every Visual Script block." },
        { status: 400 },
      );
    data.visualScriptReviews = reviews.map((r: any, i: number) => ({
      index: i,
      status: r.status === "approved" ? "approved" : "refine",
      note: String(r.note || "").trim(),
      reviewedBy: a.member.name,
      reviewedAt: new Date().toISOString(),
    }));
    const refine = data.visualScriptReviews.filter(
      (r: any) => r.status === "refine",
    );
    data.visualScriptStatus = refine.length ? "revision" : "approved";
    const next = refine.length
      ? "Visual Script"
      : "Production Design & Image Generation";
    await db
      .prepare(
        "UPDATE projects SET script_data=?,assignment_stage=?,assignment_status=?,revision_note=?,approval_title=NULL,stage=?,progress=? WHERE id=?",
      )
      .bind(
        JSON.stringify(data),
        next,
        refine.length ? "Revision Requested" : "Ongoing",
        refine
          .map(
            (r: any) =>
              `Shot ${r.index + 1}: ${r.note || "Please refine this block."}`,
          )
          .join(" | ") || null,
        `${next} · ${refine.length ? "Revision" : "Ready"}`,
        refine.length ? 72 : 78,
        b.id,
      )
      .run();
  }
  if (b.action === "saveStoryboard" || b.action === "saveImageGeneration") {
    const p = await db
      .prepare("SELECT script_data AS data FROM projects WHERE id=?")
      .bind(b.id)
      .first<{ data: string }>();
    let data: any = {};
    try {
      data = JSON.parse(p?.data || "{}");
    } catch {}
    const key =
      b.action === "saveStoryboard" ? "storyboard" : "imageGeneration";
    try {
      data[key] = JSON.parse(b.payload || "[]");
      if (b.action === "saveStoryboard") data.storyboardStatus = "draft";
    } catch {
      return Response.json(
        { error: "Invalid production data" },
        { status: 400 },
      );
    }
    await db
      .prepare(
        "UPDATE projects SET script_data=?,assignment_stage=?,assignment_status='Ongoing',stage=?,progress=? WHERE id=?",
      )
      .bind(
        JSON.stringify(data),
        b.action === "saveStoryboard" ? "Storyboard" : "Image Generation",
        b.action === "saveStoryboard"
          ? "Storyboard · In Progress"
          : "Image Generation · In Progress",
        b.action === "saveStoryboard" ? 68 : 72,
        b.id,
      )
      .run();
  }
  if (b.action === "submitStoryboard" || b.action === "submitImageGeneration") {
    const storyboard = b.action === "submitStoryboard",
      p = await db
        .prepare("SELECT script_data AS data FROM projects WHERE id=?")
        .bind(b.id)
        .first<{ data: string }>();
    let data: any = {};
    try {
      data = JSON.parse(p?.data || "{}");
      data[storyboard ? "storyboard" : "imageGeneration"] = JSON.parse(
        b.payload || "[]",
      );
      if (storyboard) data.storyboardStatus = "submitted";
    } catch {
      return Response.json(
        { error: "Invalid production submission" },
        { status: 400 },
      );
    }
    await db
      .prepare(
        "UPDATE projects SET script_data=?,assignment_stage=?,assignment_status='Awaiting Approval',approval_title=?,stage=?,progress=? WHERE id=?",
      )
      .bind(
        JSON.stringify(data),
        storyboard ? "Storyboard" : "Image Generation",
        storyboard ? "Storyboard Review" : "Image Generation Review",
        storyboard
          ? "Storyboard · Waiting Approval"
          : "Image Generation · Waiting Approval",
        storyboard ? 70 : 74,
        b.id,
      )
      .run();
  }
  if (b.action === "submitSavedProduction") {
    const p = await db
        .prepare(
          "SELECT project_nature AS nature,script_data AS data FROM projects WHERE id=?",
        )
        .bind(b.id)
        .first<Record<string, any>>(),
      storyboard = p?.nature !== "recurring";
    let data: any = {};
    try {
      data = JSON.parse(p?.data || "{}");
    } catch {}
    const content = data[storyboard ? "storyboard" : "imageGeneration"];
    if (!Array.isArray(content) || !content.length)
      return Response.json(
        {
          error: `Save the ${storyboard ? "Storyboard" : "Image Generation prompts"} before submitting.`,
        },
        { status: 400 },
      );
    if (!storyboard) {
      await ensureAssetTable(db);
      const missing: number[] = [];
      for (let i = 0; i < content.length; i++) {
        const row = await db
          .prepare(
            "SELECT COUNT(*) count FROM visual_asset_revisions WHERE project_id=? AND phase='social-image' AND item_key=? AND is_current=1",
          )
          .bind(b.id, `block-${i + 1}`)
          .first<any>();
        if (!Number(row?.count || 0)) missing.push(i + 1);
      }
      if (missing.length)
        return Response.json(
          {
            error: `Upload at least one current image for every social block before approval. Missing blocks: ${missing.join(", ")}`,
          },
          { status: 400 },
        );
    }
    await db
      .prepare(
        "UPDATE projects SET assignment_stage=?,assignment_status='Awaiting Approval',approval_title=?,stage=?,progress=? WHERE id=?",
      )
      .bind(
        storyboard ? "Storyboard" : "Image Generation",
        storyboard ? "Storyboard Review" : "Image Generation Review",
        storyboard
          ? "Storyboard · Waiting Approval"
          : "Image Generation · Waiting Approval",
        storyboard ? 70 : 74,
        b.id,
      )
      .run();
  }
  if (b.action === "reviewProductionItems") {
    if (a.member.tier > 1)
      return Response.json(
        { error: "Management access required" },
        { status: 403 },
      );
    const p = await db
      .prepare(
        "SELECT approval_title AS title,type,project_nature AS nature,script_data AS data FROM projects WHERE id=?",
      )
      .bind(b.id)
      .first<Record<string, any>>();
    let data: any = {},
      reviews: any[] = [];
    try {
      data = JSON.parse(p?.data || "{}");
      reviews = JSON.parse(b.reviews || b.payload || "[]");
    } catch {
      return Response.json(
        { error: "Invalid production review" },
        { status: 400 },
      );
    }
    const storyboard = p?.title?.includes("Storyboard"),
      content = data[storyboard ? "storyboard" : "imageGeneration"] || [];
    if (reviews.length !== content.length)
      return Response.json(
        { error: "Review every item before submitting." },
        { status: 400 },
      );
    data.productionReviews = reviews.map((r: any, i: number) => ({
      index: i,
      status: r.status === "approved" ? "approved" : "refine",
      note: String(r.note || "").trim(),
      reviewedBy: a.member.name,
      reviewedAt: new Date().toISOString(),
    }));
    const refine = data.productionReviews.filter(
        (r: any) => r.status === "refine",
      ),
      stage = storyboard ? "Storyboard" : "Image Generation";
    if (refine.length) {
      const summary = refine
        .map(
          (r: any) =>
            `${storyboard ? "Shot" : "Block"} ${r.index + 1}: ${r.note || "Please refine this item."}`,
        )
        .join(" | ");
      await db
        .prepare(
          "UPDATE projects SET script_data=?,assignment_stage=?,assignment_status='Revision Requested',revision_note=?,approval_title=NULL,stage=?,progress=? WHERE id=?",
        )
        .bind(
          JSON.stringify(data),
          stage,
          summary,
          `${stage} · Revision`,
          storyboard ? 68 : 72,
          b.id,
        )
        .run();
    } else {
      const hasVideo = (data.ideas || []).some((x: any) =>
          /reel|video/i.test(String(x.format || "")),
        ),
        next = storyboard
          ? p?.type === "MV"
            ? "Visual Script"
            : "Visual Development & Image Generation"
          : hasVideo
            ? "Video Generation"
            : "Client Review";
      if (storyboard) {
        data.storyboardStatus = "approved";
        if (p?.type === "MV") data.visualScriptStatus = "draft";
      }
      if (!storyboard)
        data.itemRoutes = (data.ideas || []).map((x: any, i: number) => ({
          index: i,
          next: /reel|video/i.test(String(x.format || ""))
            ? "Video Generation"
            : "Client Review",
        }));
      await db
        .prepare(
          "INSERT INTO document_versions(project_id,document_type,version,snapshot,approved_by,created_at) VALUES(?,?,?,?,?,?)",
        )
        .bind(
          b.id,
          stage,
          1,
          JSON.stringify(data),
          a.email,
          new Date().toISOString(),
        )
        .run();
      await db
        .prepare(
          "UPDATE projects SET script_data=?,assignment_stage=?,assignment_status='Ongoing',revision_note=NULL,approval_title=NULL,stage=?,progress=? WHERE id=?",
        )
        .bind(
          JSON.stringify(data),
          next,
          `${next} · Ready`,
          storyboard ? 76 : 80,
          b.id,
        )
        .run();
    }
  }
  if (b.action === "reviseProduction") {
    if (a.member.tier > 1)
      return Response.json(
        { error: "Management access required" },
        { status: 403 },
      );
    const p = await db
        .prepare("SELECT approval_title AS title FROM projects WHERE id=?")
        .bind(b.id)
        .first<{ title: string }>(),
      stage = p?.title?.includes("Storyboard")
        ? "Storyboard"
        : "Image Generation";
    await db
      .prepare(
        "UPDATE projects SET assignment_stage=?,assignment_status='Revision Requested',revision_note=?,approval_title=NULL,stage=?,progress=? WHERE id=?",
      )
      .bind(
        stage,
        b.revisionNote || `Please refine the ${stage}.`,
        `${stage} · Revision`,
        stage === "Storyboard" ? 68 : 72,
        b.id,
      )
      .run();
  }
  if (b.action === "approveProduction") {
    if (a.member.tier > 1)
      return Response.json(
        { error: "Management access required" },
        { status: 403 },
      );
    const p = await db
        .prepare(
          "SELECT approval_title AS title,type,project_nature AS nature,script_data AS data FROM projects WHERE id=?",
        )
        .bind(b.id)
        .first<Record<string, any>>(),
      storyboard = p?.title?.includes("Storyboard"),
      next = storyboard
        ? "Character Design"
        : p?.nature === "recurring"
          ? "Video Generation / Client Review"
          : "Next Production Stage";
    await db
      .prepare(
        "INSERT INTO document_versions(project_id,document_type,version,snapshot,approved_by,created_at) VALUES(?,?,?,?,?,?)",
      )
      .bind(
        b.id,
        storyboard ? "Storyboard" : "Image Generation",
        1,
        p?.data || "{}",
        a.email,
        new Date().toISOString(),
      )
      .run();
    await db
      .prepare(
        "UPDATE projects SET assignment_stage=?,assignment_status='Ongoing',revision_note=NULL,approval_title=NULL,stage=?,progress=? WHERE id=?",
      )
      .bind(next, `${next} · Ready`, storyboard ? 76 : 80, b.id)
      .run();
  }
  if (b.action === "submitMarket") {
    await logResearchEdit(db, a, b, "Market");
    await db
      .prepare(
        `UPDATE projects SET market_snapshot=?,market_opportunities=?,market_direction=?,market_references=?,market_status='Submitted',stage='Market Research · Waiting Approval',approval_title='Market Research Review',progress=31 WHERE id=?`,
      )
      .bind(
        b.marketSnapshot || "",
        b.marketOpportunities || "",
        b.marketDirection || "",
        b.marketReferences || "[]",
        b.id,
      )
      .run();
  }
  if (b.action === "submitTrend") {
    await logResearchEdit(db, a, b, "Trend");
    await db
      .prepare(
        `UPDATE projects SET trend_observations=?,trend_fit=?,trend_references=?,trend_status='Submitted',stage='Trend Research · Waiting Approval',approval_title='Trend Research Review',progress=36 WHERE id=?`,
      )
      .bind(
        b.trendObservations || "",
        b.trendFit || "",
        b.trendReferences || "[]",
        b.id,
      )
      .run();
  }
  if (b.action === "approveMarket")
    await db
      .prepare(
        "UPDATE projects SET market_status='Approved',approval_title=CASE WHEN trend_status='Submitted' THEN 'Trend Research Review' ELSE NULL END,stage=CASE WHEN trend_status='Approved' THEN 'Research Complete' ELSE 'Trend Research · In Progress' END,progress=42 WHERE id=?",
      )
      .bind(b.id)
      .run();
  if (b.action === "approveTrend")
    await db
      .prepare(
        "UPDATE projects SET trend_status='Approved',approval_title=CASE WHEN market_status='Submitted' THEN 'Market Research Review' ELSE NULL END,stage=CASE WHEN market_status='Approved' THEN 'Research Complete' ELSE 'Market Research · In Progress' END,progress=42 WHERE id=?",
      )
      .bind(b.id)
      .run();
  if (b.action === "reviseMarket")
    await db
      .prepare(
        "UPDATE projects SET market_status='Revision Requested',approval_title=NULL,stage='Market Research · Revision',progress=28 WHERE id=?",
      )
      .bind(b.id)
      .run();
  if (b.action === "reviseTrend")
    await db
      .prepare(
        "UPDATE projects SET trend_status='Revision Requested',approval_title=NULL,stage='Trend Research · Revision',progress=33 WHERE id=?",
      )
      .bind(b.id)
      .run();
  if (
    b.action === "reviewProductionItems" ||
    b.action === "approveProduction"
  ) {
    const current = await db
      .prepare("SELECT assignment_stage AS stage FROM projects WHERE id=?")
      .bind(b.id)
      .first<any>();
    if (current?.stage === "Character Design")
      await db
        .prepare(
          "UPDATE projects SET assignment_stage='Visual Development & Image Generation',stage='Visual Development & Image Generation · Ready',progress=76 WHERE id=?",
        )
        .bind(b.id)
        .run();
  }
  if (b.action === "saveBrief") {
    const now = new Date().toISOString();
    await db
      .prepare(
        "UPDATE phase_records SET status='Approved',version=version+1,approved_at=?,updated_at=? WHERE project_id=? AND phase_key='client-brief'",
      )
      .bind(now, now, b.id)
      .run();
    await db
      .prepare("UPDATE projects SET phase_status='Approved' WHERE id=?")
      .bind(b.id)
      .run();
  }
  if (b.action === "assign") {
    const now = new Date().toISOString(),
      next = await db
        .prepare(
          "SELECT phase_key AS phaseKey,label,position FROM phase_records WHERE project_id=? AND status='Locked' ORDER BY position LIMIT 1",
        )
        .bind(b.id)
        .first<any>();
    if (next) {
      await db
        .prepare(
          "UPDATE phase_records SET status='In Progress',opened_at=COALESCE(opened_at,?),updated_at=? WHERE project_id=? AND phase_key=? AND status='Locked'",
        )
        .bind(now, now, b.id, next.phaseKey)
        .run();
      await db
        .prepare(
          "UPDATE projects SET phase_status='In Progress',stage=?,assignment_stage=?,assignment_status='Ongoing',progress=? WHERE id=?",
        )
        .bind(
          `${next.label} · In Progress`,
          next.label,
          Math.round(
            (next.position /
              Math.max(
                1,
                (
                  await db
                    .prepare(
                      "SELECT COUNT(*) AS count FROM phase_records WHERE project_id=?",
                    )
                    .bind(b.id)
                    .first<any>()
                )?.count || 1,
              )) *
              100,
          ),
          b.id,
        )
        .run();
    }
  }
  const eventData = {
      action: b.action,
      stage:
        (await db
          .prepare(
            "SELECT stage,assignment_status AS assignmentStatus,approval_title AS approvalTitle FROM projects WHERE id=?",
          )
          .bind(b.id)
          .first()) || {},
      reviewOrRevision: b.reviews || b.revisionNote || null,
    },
    eventTime = new Date().toISOString();
  await db
    .prepare(
      "INSERT INTO production_events(project_id,event_type,actor_email,actor_name,actor_tier,event_data,created_at) VALUES(?,?,?,?,?,?,?)",
    )
    .bind(
      b.id,
      b.action,
      a.email,
      a.member.name,
      a.member.tier,
      JSON.stringify(eventData),
      eventTime,
    )
    .run();
  await queueProjectDriveRecord(db, {
    eventKey: `legacy:${b.id}:${b.action}:${crypto.randomUUID()}`,
    projectId: b.id,
    phaseKey: "_system",
    eventType: b.action,
    actorEmail: a.email,
    payload: eventData,
  });
  return Response.json({ ok: true });
}

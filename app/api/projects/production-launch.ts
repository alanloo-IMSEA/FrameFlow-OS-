const PRODUCTION_LAUNCH_ID = "v213_production_launch_cleanup_20260928";
const PRODUCTION_CONSISTENCY_ID = "v214_production_batch_consistency_20260928";
const DEMO_EMAIL_SUFFIX = ".demo@imarketing.test";

async function deletePrefix(bucket: any, prefix: string) {
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix, cursor });
    const keys = (page.objects || [])
      .map((object: any) => String(object.key))
      .filter(Boolean);
    if (keys.length) await bucket.delete(keys);
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}

export async function deleteProjectObjects(bucket: any, projectIds: string[]) {
  for (const projectId of projectIds)
    await deletePrefix(bucket, `projects/${projectId}/`);
}

function parseStringArray(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

async function repairProductionBatchConsistency(db: any) {
  const applied = await db
    .prepare("SELECT id FROM app_migrations WHERE id=?")
    .bind(PRODUCTION_CONSISTENCY_ID)
    .first();
  if (applied) return;

  const rows = await db
    .prepare(
      "SELECT id,project_id AS projectId,planned_count AS plannedCount FROM production_batches",
    )
    .all();
  const statements: any[] = [
    db.prepare(
      "UPDATE phase_records SET label='Task Files' WHERE phase_key='publishing' AND label='Publishing'",
    ),
  ];
  const repaired: Array<{ batchId: number; plannedCount: number }> = [];

  for (const batch of rows.results as any[]) {
    const [records, assets] = await Promise.all([
      db
        .prepare(
          "SELECT COUNT(DISTINCT COALESCE(NULLIF(content_key,''),CAST(content_item_id AS TEXT))) AS count FROM publishing_records WHERE project_id=? AND batch_id=? AND status!='CANCELLED'",
        )
        .bind(batch.projectId, batch.id)
        .first<any>(),
      db
        .prepare(
          "SELECT COUNT(DISTINCT CASE WHEN instr(item_key,'-asset-')>0 THEN substr(item_key,1,instr(item_key,'-asset-')-1) ELSE item_key END) AS count FROM visual_asset_revisions WHERE project_id=? AND phase='content-production' AND item_key LIKE ?",
        )
        .bind(batch.projectId, `batch-${batch.id}-%`)
        .first<any>(),
    ]);
    const plannedCount = Math.max(
      Number(batch.plannedCount || 0),
      Number(records?.count || 0),
      Number(assets?.count || 0),
    );
    if (plannedCount !== Number(batch.plannedCount || 0)) {
      statements.push(
        db
          .prepare("UPDATE production_batches SET planned_count=? WHERE id=?")
          .bind(plannedCount, batch.id),
      );
      repaired.push({ batchId: Number(batch.id), plannedCount });
    }
  }

  const now = new Date().toISOString();
  statements.push(
    db
      .prepare(
        "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at,demo_data) VALUES(NULL,'production_batch_consistency_repaired','system:production-launch',?,?,0)",
      )
      .bind(JSON.stringify({ repaired, phaseLabel: "Task Files" }), now),
    db
      .prepare("INSERT INTO app_migrations(id,applied_at) VALUES(?,?)")
      .bind(PRODUCTION_CONSISTENCY_ID, now),
  );
  await db.batch(statements);
}

export async function prepareProductionWorkspace(db: any) {
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS app_migrations (id TEXT PRIMARY KEY,applied_at TEXT NOT NULL)",
    )
    .run();
  const applied = await db
    .prepare("SELECT id FROM app_migrations WHERE id=?")
    .bind(PRODUCTION_LAUNCH_ID)
    .first();
  if (applied) {
    await repairProductionBatchConsistency(db);
    return;
  }

  const memberRows = await db
    .prepare("SELECT email FROM members WHERE lower(email) LIKE ?")
    .bind(`%${DEMO_EMAIL_SUFFIX}`)
    .all();
  const demoEmails = (memberRows.results as any[]).map((row) =>
    String(row.email).toLowerCase(),
  );
  const projectRows = await db
    .prepare("SELECT id,assignment_members AS assignmentMembers FROM projects")
    .all();
  const now = new Date().toISOString();
  const statements: any[] = [db.prepare("UPDATE projects SET is_demo=0")];

  for (const project of projectRows.results as any[]) {
    const members = parseStringArray(project.assignmentMembers);
    const productionMembers = members.filter(
      (email) => !demoEmails.includes(email.toLowerCase()),
    );
    if (productionMembers.length !== members.length)
      statements.push(
        db
          .prepare("UPDATE projects SET assignment_members=? WHERE id=?")
          .bind(JSON.stringify(productionMembers), project.id),
      );
  }

  statements.push(
    db.prepare("UPDATE approved_phase_snapshots SET demo_data=0"),
    db.prepare("UPDATE phase_generation_records SET demo_data=0"),
    db.prepare("UPDATE generation_context_cache SET demo_data=0"),
    db.prepare("UPDATE audit_log SET demo_data=0"),
    db.prepare("UPDATE project_drive_folders SET demo=0"),
    db.prepare(
      "DELETE FROM orchestrator_job_events WHERE job_id IN (SELECT id FROM orchestrator_jobs WHERE provider LIKE 'sandbox:%' OR (json_valid(input_payload) AND json_extract(input_payload,'$.publishMode')='sandbox'))",
    ),
    db.prepare(
      "DELETE FROM orchestrator_job_tokens WHERE job_id IN (SELECT id FROM orchestrator_jobs WHERE provider LIKE 'sandbox:%' OR (json_valid(input_payload) AND json_extract(input_payload,'$.publishMode')='sandbox'))",
    ),
    db.prepare(
      "DELETE FROM orchestrator_costs WHERE job_id IN (SELECT id FROM orchestrator_jobs WHERE provider LIKE 'sandbox:%' OR (json_valid(input_payload) AND json_extract(input_payload,'$.publishMode')='sandbox'))",
    ),
    db.prepare(
      "DELETE FROM orchestrator_jobs WHERE provider LIKE 'sandbox:%' OR (json_valid(input_payload) AND json_extract(input_payload,'$.publishMode')='sandbox')",
    ),
    db.prepare(
      "UPDATE publishing_records SET result=json_remove(result,'$.sandboxPublishing') WHERE json_valid(result) AND json_type(result,'$.sandboxPublishing') IS NOT NULL",
    ),
    db.prepare(
      "DELETE FROM audit_log WHERE event_type IN ('publishing_sandbox_completed','publishing_sandbox_failed')",
    ),
  );

  for (const email of demoEmails) {
    statements.push(
      db
        .prepare("UPDATE teams SET lead_email=NULL WHERE lead_email=?")
        .bind(email),
      db
        .prepare("DELETE FROM project_members WHERE member_email=?")
        .bind(email),
      db
        .prepare("DELETE FROM member_telegram_sessions WHERE member_email=?")
        .bind(email),
      db
        .prepare("DELETE FROM member_telegram_identities WHERE member_email=?")
        .bind(email),
      db.prepare("DELETE FROM members WHERE email=?").bind(email),
    );
  }

  statements.push(
    db
      .prepare(
        "INSERT INTO audit_log(project_id,event_type,actor_email,event_data,created_at,demo_data) VALUES(NULL,'production_workspace_prepared','system:production-launch',?,?,0)",
      )
      .bind(
        JSON.stringify({
          projectsPromoted: projectRows.results.length,
          demoMembersRemoved: demoEmails,
          sandboxExecutionDataRemoved: true,
          projectAssetsPreserved: true,
        }),
        now,
      ),
    db
      .prepare("INSERT INTO app_migrations(id,applied_at) VALUES(?,?)")
      .bind(PRODUCTION_LAUNCH_ID, now),
  );
  await db.batch(statements);
  await repairProductionBatchConsistency(db);
}

UPDATE `phase_records`
SET `data` = '{}', `updated_at` = CURRENT_TIMESTAMP
WHERE `project_id` = 'PRJ-0002'
  AND `phase_key` = 'batch-ideas'
  AND `status` IN ('In Progress', 'Retake', 'Reopened');--> statement-breakpoint
UPDATE `production_batches`
SET `planned_count` = 0, `gate_status` = 'Locked'
WHERE `project_id` = 'PRJ-0002'
  AND `status` = 'Active';--> statement-breakpoint
DELETE FROM `generation_context_cache`
WHERE `project_id` = 'PRJ-0002'
  AND `current_phase_key` = 'batch-ideas';--> statement-breakpoint
INSERT INTO `audit_log` (`project_id`, `event_type`, `actor_email`, `event_data`, `created_at`)
VALUES (
  'PRJ-0002',
  'batch_working_draft_cleared',
  'alanloo927@gmail.com',
  '{"phaseKey":"batch-ideas","scope":"working-draft-only","approvedSnapshotsPreserved":true}',
  CURRENT_TIMESTAMP
);

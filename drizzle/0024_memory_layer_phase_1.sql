CREATE TABLE IF NOT EXISTS `agent_project_controls` (
	`project_id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`active` integer DEFAULT 0 NOT NULL,
	`stop_phase_key` text DEFAULT 'reel-video-production' NOT NULL,
	`status` text NOT NULL,
	`activated_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_phase_key` text,
	`last_error` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `agent_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`phase_key` text NOT NULL,
	`status` text NOT NULL,
	`formula_id` text,
	`formula_version` text,
	`provider` text,
	`model` text,
	`started_at` text NOT NULL,
	`completed_at` text,
	`error` text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agent_runs_project_phase_started` ON `agent_runs` (`project_id`,`phase_key`,`started_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `app_migrations` (
	`id` text PRIMARY KEY NOT NULL,
	`applied_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `approved_phase_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`project_type` text NOT NULL,
	`phase_key` text NOT NULL,
	`phase_label` text NOT NULL,
	`version` integer NOT NULL,
	`approved_content` text NOT NULL,
	`approved_by` text NOT NULL,
	`approved_at` text NOT NULL,
	`formula_id` text,
	`formula_version` text,
	`generation_method` text NOT NULL,
	`demo_data` integer DEFAULT 1 NOT NULL,
	`learning_status` text DEFAULT 'Not Applicable' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `approved_snapshots_project_phase_version_unique` ON `approved_phase_snapshots` (`project_id`,`phase_key`,`version`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `approved_snapshots_latest_lookup` ON `approved_phase_snapshots` (`project_id`,`phase_key`,`version`,`id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `drive_connections` (
	`account_email` text PRIMARY KEY NOT NULL,
	`encrypted_refresh_token` text NOT NULL,
	`root_folder_id` text NOT NULL,
	`root_folder_url` text NOT NULL,
	`connected_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `drive_sync_queue` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_key` text NOT NULL,
	`project_id` text NOT NULL,
	`phase_key` text NOT NULL,
	`event_type` text NOT NULL,
	`actor_email` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'Pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` text NOT NULL,
	`synced_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `drive_sync_queue_event_key_unique` ON `drive_sync_queue` (`event_key`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `drive_sync_project_status_created` ON `drive_sync_queue` (`project_id`,`status`,`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `formula_library` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`formula_id` text NOT NULL,
	`formula_name` text NOT NULL,
	`project_type` text NOT NULL,
	`phase_key` text NOT NULL,
	`version` text NOT NULL,
	`status` text NOT NULL,
	`prompt_template` text NOT NULL,
	`expected_output_schema` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `formula_library_formula_version_unique` ON `formula_library` (`formula_id`,`version`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `formula_library_active_phase_lookup` ON `formula_library` (`project_type`,`phase_key`,`status`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `generation_context_cache` (
	`project_id` text NOT NULL,
	`current_phase_key` text NOT NULL,
	`context_json` text NOT NULL,
	`built_at` text NOT NULL,
	`demo_data` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`project_id`, `current_phase_key`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `phase_generation_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`project_type` text NOT NULL,
	`phase_key` text NOT NULL,
	`formula_id` text,
	`formula_version` text,
	`generation_method` text NOT NULL,
	`original_generated_draft` text,
	`human_edited_version` text,
	`final_approved_version` text,
	`changed_fields` text,
	`created_at` text NOT NULL,
	`edited_at` text,
	`approved_at` text,
	`review_result` text,
	`demo_data` integer DEFAULT 1 NOT NULL,
	`learning_status` text DEFAULT 'Pending Review' NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `phase_generation_project_learning_created` ON `phase_generation_records` (`project_id`,`learning_status`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `phase_generation_project_phase_approved` ON `phase_generation_records` (`project_id`,`phase_key`,`approved_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `production_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`event_type` text NOT NULL,
	`actor_email` text NOT NULL,
	`actor_name` text NOT NULL,
	`actor_tier` integer NOT NULL,
	`event_data` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `production_events_project_created_lookup` ON `production_events` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `project_drive_folders` (
	`project_id` text PRIMARY KEY NOT NULL,
	`folder_id` text NOT NULL,
	`folder_url` text NOT NULL,
	`demo` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `change_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`phase_key` text NOT NULL,
	`requested_by` text NOT NULL,
	`request_note` text,
	`status` text DEFAULT 'Requested' NOT NULL,
	`decided_by` text,
	`decided_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `review_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`scope_type` text NOT NULL,
	`scope_id` text NOT NULL,
	`review_kind` text NOT NULL,
	`session_number` integer NOT NULL,
	`max_included` integer NOT NULL,
	`status` text NOT NULL,
	`submitted_at` text,
	`completed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `video_slots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`slot_number` integer NOT NULL,
	`purpose` text,
	`status` text DEFAULT 'Available' NOT NULL,
	`phase_status` text DEFAULT 'Locked' NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	UNIQUE(`project_id`,`slot_number`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `production_cycles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`cycle_type` text NOT NULL,
	`starts_at` text NOT NULL,
	`ends_at` text,
	`status` text NOT NULL,
	`configuration` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `production_batches` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`cycle_id` integer,
	`batch_number` integer NOT NULL,
	`starts_at` text,
	`ends_at` text,
	`status` text NOT NULL,
	`gate_status` text DEFAULT 'Locked' NOT NULL,
	`planned_count` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `content_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`cycle_id` integer,
	`batch_id` integer,
	`original_cycle_id` integer,
	`content_type` text NOT NULL,
	`title` text,
	`status` text NOT NULL,
	`quota_type` text,
	`quota_consumed` integer DEFAULT 0 NOT NULL,
	`carry_count` integer DEFAULT 0 NOT NULL,
	`is_outstanding` integer DEFAULT 0 NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `integration_connections` (
	`provider` text PRIMARY KEY NOT NULL,
	`encrypted_secret` text NOT NULL,
	`config_json` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'Configured' NOT NULL,
	`last_tested_at` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `external_review_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`batch_id` integer NOT NULL,
	`token_hash` text NOT NULL UNIQUE,
	`status` text DEFAULT 'Active' NOT NULL,
	`expires_at` text NOT NULL,
	`submitted_at` text,
	`invalidated_at` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text,
	`event_type` text NOT NULL,
	`actor_email` text,
	`event_data` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`demo_data` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `client_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`brand_name` text NOT NULL,
	`market` text NOT NULL,
	`positioning` text,
	`audience` text,
	`core_products` text,
	`brand_identity` text,
	`status` text DEFAULT 'Active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	UNIQUE(`brand_name`,`market`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `learning_differences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`client_profile_id` integer,
	`content_kind` text NOT NULL,
	`ai_original` text,
	`human_edit` text,
	`final_approved` text,
	`extracted_pattern` text,
	`created_at` text NOT NULL,
	`demo_data` integer DEFAULT 1 NOT NULL,
	`learning_status` text DEFAULT 'Pending Review' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `phase_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`phase_key` text NOT NULL,
	`position` integer NOT NULL,
	`label` text NOT NULL,
	`review_kind` text DEFAULT 'none' NOT NULL,
	`max_reviews` integer,
	`status` text DEFAULT 'Locked' NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`opened_at` text,
	`approved_at` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `audit_log_project_created_lookup` ON `audit_log` (`project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `audit_log_event_created_lookup` ON `audit_log` (`event_type`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `learning_differences_project_status_created` ON `learning_differences` (`project_id`,`learning_status`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `agent_file_events_grant_created` ON `agent_file_grant_events` (`grant_id`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `batch_learning_project_status_updated` ON `batch_learning_records` (`project_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `batch_learning_project_key_id` ON `batch_learning_records` (`project_id`,`batch_key`,`id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `orchestrator_events_job_created` ON `orchestrator_job_events` (`job_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `phase_records_project_phase_unique` ON `phase_records` (`project_id`,`phase_key`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `phase_records_project_status_position` ON `phase_records` (`project_id`,`status`,`position`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `publishing_attempts_project_started_lookup` ON `publishing_attempts` (`project_id`,`started_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `publishing_attempts_record_attempt_lookup` ON `publishing_attempts` (`publishing_record_id`,`attempt_number`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `publishing_project_status_published` ON `publishing_records` (`project_id`,`status`,`published_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `publishing_project_batch_order` ON `publishing_records` (`project_id`,`batch_id`,`publishing_order`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `performance_project_captured_lookup` ON `social_performance_snapshots` (`project_id`,`captured_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `performance_record_captured_lookup` ON `social_performance_snapshots` (`publishing_record_id`,`captured_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `visual_asset_lookup` ON `visual_asset_revisions` (`project_id`,`phase`,`item_key`,`version`);

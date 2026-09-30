CREATE TABLE `agent_api_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`label` text,
	`scopes_json` text DEFAULT '["projects:read"]' NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text,
	`last_used_at` text,
	`revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_api_tokens_hash_unique` ON `agent_api_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `agent_api_tokens_agent_status_lookup` ON `agent_api_tokens` (`agent_id`,`status`);--> statement-breakpoint
CREATE TABLE `agent_file_grant_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`grant_id` text NOT NULL,
	`event_type` text NOT NULL,
	`item_key` text,
	`event_data` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `agent_file_events_grant_created` ON `agent_file_grant_events` (`grant_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `agent_file_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`job_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`project_id` text NOT NULL,
	`phase_key` text NOT NULL,
	`content_id` text NOT NULL,
	`read_asset_ids` text DEFAULT '[]' NOT NULL,
	`write_item_keys` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`last_used_at` text,
	`revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_file_grants_token_hash_unique` ON `agent_file_grants` (`token_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `agent_file_grants_job_id_unique` ON `agent_file_grants` (`job_id`);--> statement-breakpoint
CREATE TABLE `agent_project_controls` (
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
CREATE TABLE `agent_runs` (
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
CREATE INDEX `agent_runs_project_phase_started` ON `agent_runs` (`project_id`,`phase_key`,`started_at`);--> statement-breakpoint
CREATE TABLE `app_migrations` (
	`id` text PRIMARY KEY NOT NULL,
	`applied_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `approved_phase_snapshots` (
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
CREATE UNIQUE INDEX `approved_snapshots_project_phase_version_unique` ON `approved_phase_snapshots` (`project_id`,`phase_key`,`version`);--> statement-breakpoint
CREATE INDEX `approved_snapshots_latest_lookup` ON `approved_phase_snapshots` (`project_id`,`phase_key`,`version`,`id`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text,
	`event_type` text NOT NULL,
	`actor_email` text,
	`event_data` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	`demo_data` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_log_project_created_lookup` ON `audit_log` (`project_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_log_event_created_lookup` ON `audit_log` (`event_type`,`created_at`);--> statement-breakpoint
CREATE TABLE `batch_learning_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`batch_key` text NOT NULL,
	`source_window_start` text,
	`source_window_end` text,
	`keep_json` text DEFAULT '[]' NOT NULL,
	`improve_json` text DEFAULT '[]' NOT NULL,
	`test_next_json` text DEFAULT '[]' NOT NULL,
	`evidence_json` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'READY' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `batch_learning_project_status_updated` ON `batch_learning_records` (`project_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `batch_learning_project_key_id` ON `batch_learning_records` (`project_id`,`batch_key`,`id`);--> statement-breakpoint
CREATE TABLE `change_requests` (
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
CREATE TABLE `client_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`brand_name` text NOT NULL,
	`market` text NOT NULL,
	`positioning` text,
	`audience` text,
	`core_products` text,
	`brand_identity` text,
	`status` text DEFAULT 'Active' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `content_items` (
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
CREATE TABLE `document_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`document_type` text NOT NULL,
	`version` integer NOT NULL,
	`snapshot` text NOT NULL,
	`approved_by` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `drive_connections` (
	`account_email` text PRIMARY KEY NOT NULL,
	`encrypted_refresh_token` text NOT NULL,
	`root_folder_id` text NOT NULL,
	`root_folder_url` text NOT NULL,
	`connected_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `drive_sync_queue` (
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
CREATE UNIQUE INDEX `drive_sync_queue_event_key_unique` ON `drive_sync_queue` (`event_key`);--> statement-breakpoint
CREATE INDEX `drive_sync_project_status_created` ON `drive_sync_queue` (`project_id`,`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `external_review_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`batch_id` integer NOT NULL,
	`token_hash` text NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`expires_at` text NOT NULL,
	`submitted_at` text,
	`invalidated_at` text,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `formula_library` (
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
CREATE UNIQUE INDEX `formula_library_formula_version_unique` ON `formula_library` (`formula_id`,`version`);--> statement-breakpoint
CREATE INDEX `formula_library_active_phase_lookup` ON `formula_library` (`project_type`,`phase_key`,`status`);--> statement-breakpoint
CREATE TABLE `generation_context_cache` (
	`project_id` text NOT NULL,
	`current_phase_key` text NOT NULL,
	`context_json` text NOT NULL,
	`built_at` text NOT NULL,
	`demo_data` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`project_id`, `current_phase_key`)
);
--> statement-breakpoint
CREATE TABLE `idea_folders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`idea_index` integer NOT NULL,
	`title` text,
	`publish_date` text,
	`folder_name` text NOT NULL,
	`drive_status` text DEFAULT 'Pending Drive connection' NOT NULL,
	`drive_url` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `integration_connections` (
	`provider` text PRIMARY KEY NOT NULL,
	`encrypted_secret` text NOT NULL,
	`config_json` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'Configured' NOT NULL,
	`last_tested_at` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `learning_differences` (
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
CREATE INDEX `learning_differences_project_status_created` ON `learning_differences` (`project_id`,`learning_status`,`created_at`);--> statement-breakpoint
CREATE TABLE `member_telegram_identities` (
	`member_email` text PRIMARY KEY NOT NULL,
	`expected_username` text,
	`telegram_user_id` text,
	`username` text,
	`display_name` text,
	`picture_url` text,
	`status` text DEFAULT 'Ready to link' NOT NULL,
	`linked_at` text,
	`last_login_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_telegram_identities_telegram_user_id_unique` ON `member_telegram_identities` (`telegram_user_id`);--> statement-breakpoint
CREATE TABLE `member_telegram_login_requests` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`member_email` text NOT NULL,
	`code_verifier` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `member_telegram_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`member_email` text NOT NULL,
	`telegram_user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`revoked_at` text
);
--> statement-breakpoint
CREATE TABLE `members` (
	`email` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`tier` integer DEFAULT 2 NOT NULL,
	`status` text DEFAULT 'Pending site access' NOT NULL,
	`telegram_chat_id` text,
	`telegram_status` text DEFAULT 'Not connected' NOT NULL,
	`member_kind` text DEFAULT 'human' NOT NULL,
	`telegram_username` text,
	`agent_language` text,
	`agent_stop_phase` text,
	`team_id` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orchestrator_costs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` text NOT NULL,
	`provider` text NOT NULL,
	`model` text,
	`currency` text DEFAULT 'USD' NOT NULL,
	`amount_micros` integer DEFAULT 0 NOT NULL,
	`input_units` integer DEFAULT 0 NOT NULL,
	`output_units` integer DEFAULT 0 NOT NULL,
	`pricing_status` text DEFAULT 'UNPRICED' NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orchestrator_job_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` text NOT NULL,
	`event_type` text NOT NULL,
	`actor` text NOT NULL,
	`event_data` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `orchestrator_events_job_created` ON `orchestrator_job_events` (`job_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `orchestrator_job_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`scope` text NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orchestrator_job_tokens_token_hash_unique` ON `orchestrator_job_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `orchestrator_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`parent_job_id` text,
	`project_id` text NOT NULL,
	`content_id` text,
	`task_id` text NOT NULL,
	`job_type` text NOT NULL,
	`actor` text NOT NULL,
	`provider` text,
	`model` text,
	`input_assets` text DEFAULT '[]' NOT NULL,
	`output_assets` text DEFAULT '[]' NOT NULL,
	`input_payload` text DEFAULT '{}' NOT NULL,
	`output_payload` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'QUEUED' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`scheduled_for` text,
	`started_at` text,
	`completed_at` text,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orchestrator_jobs_idempotency_key_unique` ON `orchestrator_jobs` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `phase_generation_records` (
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
CREATE INDEX `phase_generation_project_learning_created` ON `phase_generation_records` (`project_id`,`learning_status`,`created_at`);--> statement-breakpoint
CREATE INDEX `phase_generation_project_phase_approved` ON `phase_generation_records` (`project_id`,`phase_key`,`approved_at`);--> statement-breakpoint
CREATE TABLE `phase_records` (
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
CREATE UNIQUE INDEX `phase_records_project_phase_unique` ON `phase_records` (`project_id`,`phase_key`);--> statement-breakpoint
CREATE INDEX `phase_records_project_status_position` ON `phase_records` (`project_id`,`status`,`position`);--> statement-breakpoint
CREATE TABLE `production_batches` (
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
CREATE TABLE `production_cycles` (
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
CREATE TABLE `production_events` (
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
CREATE INDEX `production_events_project_created_lookup` ON `production_events` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `project_drive_folders` (
	`project_id` text PRIMARY KEY NOT NULL,
	`folder_id` text NOT NULL,
	`folder_url` text NOT NULL,
	`demo` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `project_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`member_email` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `project_social_connections` (
	`connection_id` text,
	`project_id` text NOT NULL,
	`platform` text NOT NULL,
	`provider_key` text NOT NULL,
	`external_account_id` text NOT NULL,
	`profile_url` text DEFAULT '' NOT NULL,
	`handle` text DEFAULT '' NOT NULL,
	`account_type` text,
	`status` text DEFAULT 'DISCONNECTED' NOT NULL,
	`permissions_json` text DEFAULT '[]' NOT NULL,
	`capabilities_json` text DEFAULT '{}' NOT NULL,
	`token_expires_at` text,
	`connected_by` text,
	`connected_at` text,
	`last_checked_at` text,
	`disconnected_at` text,
	`is_default` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `social_connection_id_unique` ON `project_social_connections` (`connection_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `social_connection_project_account_unique` ON `project_social_connections` (`project_id`,`platform`,`external_account_id`);--> statement-breakpoint
CREATE INDEX `social_connection_project_platform_lookup` ON `project_social_connections` (`project_id`,`platform`,`is_default`);--> statement-breakpoint
CREATE INDEX `social_connection_account_lookup` ON `project_social_connections` (`platform`,`external_account_id`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`client` text NOT NULL,
	`type` text NOT NULL,
	`project_type_code` text,
	`project_mode` text,
	`purpose` text,
	`mv_entry` text,
	`project_config` text DEFAULT '{}' NOT NULL,
	`legacy_type` text,
	`status` text NOT NULL,
	`project_status` text DEFAULT 'Active' NOT NULL,
	`phase_status` text DEFAULT 'In Progress' NOT NULL,
	`payment_confirmed` integer DEFAULT 0 NOT NULL,
	`payment_percentage` integer DEFAULT 0 NOT NULL,
	`delivery_confirmed` integer DEFAULT 0 NOT NULL,
	`payment_cleared` integer DEFAULT 0 NOT NULL,
	`stage` text NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`recurring` text,
	`project_nature` text DEFAULT 'one_off' NOT NULL,
	`frequency_count` integer DEFAULT 0 NOT NULL,
	`frequency_unit` text,
	`project_start_date` text,
	`project_end_date` text,
	`project_duration` text,
	`foundation_status` text DEFAULT 'Locked' NOT NULL,
	`foundation_version` integer DEFAULT 0 NOT NULL,
	`completed_at` text,
	`is_demo` integer DEFAULT 1 NOT NULL,
	`assignment_members` text,
	`assignment_stage` text,
	`assignment_status` text,
	`assigned_at` text,
	`assignment_due_at` text,
	`revision_note` text,
	`drive_url` text,
	`approval_title` text,
	`brief_owner` text,
	`client_name` text,
	`brand_overview` text,
	`project_goal` text,
	`audience` text,
	`deliverables` text,
	`key_message` text,
	`tone` text,
	`due_date` text,
	`restrictions` text,
	`brief_status` text DEFAULT 'Draft' NOT NULL,
	`brief_doc_url` text,
	`research_assignee` text,
	`trend_assignee` text,
	`market_snapshot` text,
	`market_opportunities` text,
	`market_direction` text,
	`market_references` text,
	`market_status` text DEFAULT 'Locked' NOT NULL,
	`trend_observations` text,
	`trend_fit` text,
	`trend_references` text,
	`trend_status` text DEFAULT 'Locked' NOT NULL,
	`creative_concept` text,
	`creative_objective` text,
	`content_pillars` text,
	`visual_style` text,
	`tone_mood` text,
	`key_takeaway` text,
	`format_direction` text,
	`script_data` text,
	`script_status` text DEFAULT 'Locked' NOT NULL,
	`script_version` integer DEFAULT 0 NOT NULL,
	`team_id` integer,
	`brief_version` integer DEFAULT 0 NOT NULL,
	`research_version` integer DEFAULT 0 NOT NULL,
	`drive_sync_status` text DEFAULT 'Not connected' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `publishing_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`publishing_record_id` integer,
	`job_id` text,
	`project_id` text NOT NULL,
	`platform` text NOT NULL,
	`attempt_number` integer NOT NULL,
	`status` text NOT NULL,
	`error_code` text,
	`error_message` text,
	`provider_response` text DEFAULT '{}' NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `publishing_attempts_project_started_lookup` ON `publishing_attempts` (`project_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `publishing_attempts_record_attempt_lookup` ON `publishing_attempts` (`publishing_record_id`,`attempt_number`);--> statement-breakpoint
CREATE TABLE `publishing_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` text,
	`project_id` text NOT NULL,
	`batch_id` integer,
	`content_item_id` integer,
	`content_key` text,
	`publishing_order` integer DEFAULT 0 NOT NULL,
	`platform` text NOT NULL,
	`social_connection_id` text,
	`connected_account_id` text,
	`connected_handle` text,
	`caption` text DEFAULT '' NOT NULL,
	`assets` text DEFAULT '[]' NOT NULL,
	`scheduled_at` text,
	`published_at` text,
	`provider_container_id` text,
	`provider_post_id` text,
	`provider_media_id` text,
	`post_url` text,
	`status` text DEFAULT 'READY' NOT NULL,
	`result` text DEFAULT '{}' NOT NULL,
	`error_code` text,
	`error_message` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`performance_sync_status` text DEFAULT 'PENDING' NOT NULL,
	`raw_metrics` text DEFAULT '{}' NOT NULL,
	`normalized_metrics` text DEFAULT '{}' NOT NULL,
	`telegram_notification_status` text DEFAULT 'PENDING' NOT NULL,
	`telegram_notified_at` text,
	`telegram_notification_error` text,
	`requires_human_action` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `publishing_records_job_id_unique` ON `publishing_records` (`job_id`);--> statement-breakpoint
CREATE INDEX `publishing_project_status_published` ON `publishing_records` (`project_id`,`status`,`published_at`);--> statement-breakpoint
CREATE INDEX `publishing_project_batch_order` ON `publishing_records` (`project_id`,`batch_id`,`publishing_order`);--> statement-breakpoint
CREATE TABLE `research_edits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`research_type` text NOT NULL,
	`editor_email` text NOT NULL,
	`editor_name` text NOT NULL,
	`editor_tier` integer NOT NULL,
	`changed_fields` text NOT NULL,
	`created_at` text NOT NULL,
	`seen_by_management` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `review_sessions` (
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
CREATE TABLE `social_performance_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`batch_id` integer,
	`platform` text NOT NULL,
	`social_connection_id` text,
	`connected_account_id` text,
	`publishing_record_id` integer,
	`scope` text DEFAULT 'CONTENT' NOT NULL,
	`captured_at` text NOT NULL,
	`raw_metrics` text DEFAULT '{}' NOT NULL,
	`normalized_metrics` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `performance_project_captured_lookup` ON `social_performance_snapshots` (`project_id`,`captured_at`);--> statement-breakpoint
CREATE INDEX `performance_record_captured_lookup` ON `social_performance_snapshots` (`publishing_record_id`,`captured_at`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`lead_email` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `temporary_publishing_assets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`publishing_record_id` integer,
	`job_id` text,
	`access_token` text NOT NULL,
	`original_storage_key` text NOT NULL,
	`temporary_storage_key` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`expires_at` text NOT NULL,
	`delete_after` text,
	`first_fetched_at` text,
	`last_fetched_at` text,
	`deleted_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `temporary_publishing_assets_access_token_unique` ON `temporary_publishing_assets` (`access_token`);--> statement-breakpoint
CREATE UNIQUE INDEX `temporary_publishing_assets_temporary_storage_key_unique` ON `temporary_publishing_assets` (`temporary_storage_key`);--> statement-breakpoint
CREATE INDEX `temporary_publishing_assets_expiry_lookup` ON `temporary_publishing_assets` (`status`,`expires_at`);--> statement-breakpoint
CREATE INDEX `temporary_publishing_assets_record_lookup` ON `temporary_publishing_assets` (`publishing_record_id`,`original_storage_key`);--> statement-breakpoint
CREATE TABLE `video_slots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`slot_number` integer NOT NULL,
	`purpose` text,
	`status` text DEFAULT 'Available' NOT NULL,
	`phase_status` text DEFAULT 'Locked' NOT NULL,
	`data` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `visual_asset_revisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`phase` text NOT NULL,
	`item_key` text NOT NULL,
	`version` integer NOT NULL,
	`storage_key` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`uploaded_by` text NOT NULL,
	`is_current` integer DEFAULT 1 NOT NULL,
	`drive_sync_status` text DEFAULT 'Pending Drive sync' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `visual_asset_lookup` ON `visual_asset_revisions` (`project_id`,`phase`,`item_key`,`version`);
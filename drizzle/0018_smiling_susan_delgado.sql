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
CREATE TABLE IF NOT EXISTS `project_social_connections` (
	`project_id` text NOT NULL,
	`platform` text NOT NULL,
	`provider_key` text NOT NULL,
	`external_account_id` text NOT NULL,
	`profile_url` text NOT NULL,
	`handle` text NOT NULL,
	`account_type` text,
	`status` text NOT NULL,
	`capabilities_json` text DEFAULT '{}' NOT NULL,
	`connected_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`project_id`, `platform`)
);
--> statement-breakpoint
ALTER TABLE `project_social_connections` ADD `permissions_json` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `project_social_connections` ADD `token_expires_at` text;--> statement-breakpoint
ALTER TABLE `project_social_connections` ADD `connected_by` text;--> statement-breakpoint
ALTER TABLE `project_social_connections` ADD `last_checked_at` text;--> statement-breakpoint
ALTER TABLE `project_social_connections` ADD `disconnected_at` text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `social_connection_account_lookup` ON `project_social_connections` (`platform`,`external_account_id`);--> statement-breakpoint
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
CREATE TABLE `social_performance_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`platform` text NOT NULL,
	`connected_account_id` text,
	`publishing_record_id` integer,
	`scope` text DEFAULT 'CONTENT' NOT NULL,
	`captured_at` text NOT NULL,
	`raw_metrics` text DEFAULT '{}' NOT NULL,
	`normalized_metrics` text DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `publishing_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`content_item_id` integer,
	`platform` text NOT NULL,
	`published_at` text,
	`post_url` text,
	`result` text NOT NULL,
	`requires_human_action` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_publishing_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` text,
	`project_id` text NOT NULL,
	`content_item_id` integer,
	`content_key` text,
	`platform` text NOT NULL,
	`connected_account_id` text,
	`connected_handle` text,
	`caption` text DEFAULT '' NOT NULL,
	`assets` text DEFAULT '[]' NOT NULL,
	`scheduled_at` text,
	`published_at` text,
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
	`requires_human_action` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text
);
--> statement-breakpoint
INSERT INTO `__new_publishing_records`("id", "project_id", "content_item_id", "platform", "published_at", "post_url", "status", "result", "requires_human_action", "created_at", "updated_at") SELECT "id", "project_id", "content_item_id", "platform", "published_at", "post_url", CASE WHEN "published_at" IS NOT NULL THEN 'PUBLISHED' WHEN "requires_human_action"=1 THEN 'MANUAL_EXCEPTION' ELSE 'READY' END, "result", "requires_human_action", "created_at", "created_at" FROM `publishing_records`;--> statement-breakpoint
DROP TABLE `publishing_records`;--> statement-breakpoint
ALTER TABLE `__new_publishing_records` RENAME TO `publishing_records`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `publishing_records_job_id_unique` ON `publishing_records` (`job_id`);

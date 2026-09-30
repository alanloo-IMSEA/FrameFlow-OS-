CREATE TABLE `agent_file_grant_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`grant_id` text NOT NULL,
	`event_type` text NOT NULL,
	`item_key` text,
	`event_data` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
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

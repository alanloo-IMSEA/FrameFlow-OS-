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
CREATE INDEX `temporary_publishing_assets_record_lookup` ON `temporary_publishing_assets` (`publishing_record_id`,`original_storage_key`);
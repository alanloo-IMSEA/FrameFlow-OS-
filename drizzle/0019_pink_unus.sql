PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_project_social_connections` (
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
INSERT INTO `__new_project_social_connections`("connection_id", "project_id", "platform", "provider_key", "external_account_id", "profile_url", "handle", "account_type", "status", "permissions_json", "capabilities_json", "token_expires_at", "connected_by", "connected_at", "last_checked_at", "disconnected_at", "is_default", "updated_at") SELECT NULL, "project_id", "platform", "provider_key", "external_account_id", "profile_url", "handle", "account_type", "status", "permissions_json", "capabilities_json", "token_expires_at", "connected_by", "connected_at", "last_checked_at", "disconnected_at", 1, "updated_at" FROM `project_social_connections`;--> statement-breakpoint
DROP TABLE `project_social_connections`;--> statement-breakpoint
ALTER TABLE `__new_project_social_connections` RENAME TO `project_social_connections`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `social_connection_id_unique` ON `project_social_connections` (`connection_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `social_connection_project_account_unique` ON `project_social_connections` (`project_id`,`platform`,`external_account_id`);--> statement-breakpoint
CREATE INDEX `social_connection_project_platform_lookup` ON `project_social_connections` (`project_id`,`platform`,`is_default`);--> statement-breakpoint
CREATE INDEX `social_connection_account_lookup` ON `project_social_connections` (`platform`,`external_account_id`);--> statement-breakpoint
ALTER TABLE `publishing_records` ADD `batch_id` integer;--> statement-breakpoint
ALTER TABLE `publishing_records` ADD `publishing_order` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `publishing_records` ADD `social_connection_id` text;--> statement-breakpoint
ALTER TABLE `social_performance_snapshots` ADD `batch_id` integer;--> statement-breakpoint
ALTER TABLE `social_performance_snapshots` ADD `social_connection_id` text;

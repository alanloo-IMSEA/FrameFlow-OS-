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

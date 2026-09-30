ALTER TABLE `projects` ADD `brief_version` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `projects` ADD `research_version` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `projects` ADD `drive_sync_status` text NOT NULL DEFAULT 'Not connected';--> statement-breakpoint
CREATE TABLE `document_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` text NOT NULL,
	`document_type` text NOT NULL,
	`version` integer NOT NULL,
	`snapshot` text NOT NULL,
	`approved_by` text,
	`created_at` text NOT NULL
);

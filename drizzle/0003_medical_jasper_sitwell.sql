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

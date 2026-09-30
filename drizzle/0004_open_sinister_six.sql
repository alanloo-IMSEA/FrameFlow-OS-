CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`lead_email` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `members` ADD `team_id` integer;--> statement-breakpoint
ALTER TABLE `projects` ADD `team_id` integer;
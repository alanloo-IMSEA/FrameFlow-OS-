CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`client` text NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`stage` text NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`recurring` text,
	`drive_url` text,
	`approval_title` text,
	`created_at` text NOT NULL
);

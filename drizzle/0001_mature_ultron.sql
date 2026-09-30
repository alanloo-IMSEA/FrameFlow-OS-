ALTER TABLE `projects` ADD `brief_owner` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `client_name` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `brand_overview` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `project_goal` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `audience` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `deliverables` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `key_message` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `tone` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `due_date` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `restrictions` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `brief_status` text DEFAULT 'Draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `brief_doc_url` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `research_assignee` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `trend_assignee` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `market_snapshot` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `market_opportunities` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `market_direction` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `market_references` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `market_status` text DEFAULT 'Locked' NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `trend_observations` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `trend_fit` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `trend_references` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `trend_status` text DEFAULT 'Locked' NOT NULL;
--> statement-breakpoint
UPDATE `projects` SET `status`='In production', `stage`='Client Brief · Draft', `progress`=8, `approval_title`=NULL WHERE `id` IN ('PRJ-0001','PRJ-0002');
--> statement-breakpoint
UPDATE `projects` SET `brief_doc_url`='https://docs.google.com/document/d/1Xfu1QZK7ZZRpzL2Ob2fJAdId38vFx4SqKPjca7iDt04/edit' WHERE `id`='PRJ-0001';
--> statement-breakpoint
UPDATE `projects` SET `brief_doc_url`='https://docs.google.com/document/d/1A07grWk32wplsvYg8xcp0Wnzd_R4r-1ABnTibUwmHTA/edit' WHERE `id`='PRJ-0002';

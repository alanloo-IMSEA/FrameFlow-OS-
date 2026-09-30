ALTER TABLE `projects` ADD `project_nature` text NOT NULL DEFAULT 'one_off';--> statement-breakpoint
ALTER TABLE `projects` ADD `frequency_count` integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE `projects` ADD `frequency_unit` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `script_version` integer NOT NULL DEFAULT 0;--> statement-breakpoint
UPDATE `projects` SET `project_nature`='recurring',`frequency_count`=3,`frequency_unit`='week' WHERE `id`='PRJ-0001';--> statement-breakpoint
CREATE TABLE `idea_folders` (`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,`project_id` text NOT NULL,`idea_index` integer NOT NULL,`title` text,`publish_date` text,`folder_name` text NOT NULL,`drive_status` text NOT NULL DEFAULT 'Pending Drive connection',`drive_url` text,`created_at` text NOT NULL);

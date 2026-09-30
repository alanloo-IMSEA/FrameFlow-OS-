CREATE TABLE `asset_upscale_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`project_id` text NOT NULL,
	`source_asset_id` integer NOT NULL,
	`derived_asset_id` integer,
	`content_id` text,
	`phase` text NOT NULL,
	`item_key` text NOT NULL,
	`runninghub_workflow_id` text NOT NULL,
	`runninghub_task_id` text,
	`runninghub_file_name` text,
	`status` text DEFAULT 'UPSCALE_PENDING' NOT NULL,
	`original_dimensions` text,
	`final_dimensions` text,
	`asset_purpose` text DEFAULT 'UPSCALED_MASTER' NOT NULL,
	`poll_count` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `asset_upscale_jobs_job_id_unique` ON `asset_upscale_jobs` (`job_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `asset_upscale_jobs_source_asset_id_unique` ON `asset_upscale_jobs` (`source_asset_id`);--> statement-breakpoint
CREATE INDEX `asset_upscale_project_status_lookup` ON `asset_upscale_jobs` (`project_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `asset_upscale_task_lookup` ON `asset_upscale_jobs` (`runninghub_task_id`);
CREATE TABLE `orchestrator_costs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` text NOT NULL,
	`provider` text NOT NULL,
	`model` text,
	`currency` text DEFAULT 'USD' NOT NULL,
	`amount_micros` integer DEFAULT 0 NOT NULL,
	`input_units` integer DEFAULT 0 NOT NULL,
	`output_units` integer DEFAULT 0 NOT NULL,
	`pricing_status` text DEFAULT 'UNPRICED' NOT NULL,
	`metadata` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orchestrator_job_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job_id` text NOT NULL,
	`event_type` text NOT NULL,
	`actor` text NOT NULL,
	`event_data` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orchestrator_job_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`scope` text NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orchestrator_job_tokens_token_hash_unique` ON `orchestrator_job_tokens` (`token_hash`);--> statement-breakpoint
CREATE TABLE `orchestrator_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`parent_job_id` text,
	`project_id` text NOT NULL,
	`content_id` text,
	`task_id` text NOT NULL,
	`job_type` text NOT NULL,
	`actor` text NOT NULL,
	`provider` text,
	`model` text,
	`input_assets` text DEFAULT '[]' NOT NULL,
	`output_assets` text DEFAULT '[]' NOT NULL,
	`input_payload` text DEFAULT '{}' NOT NULL,
	`output_payload` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'QUEUED' NOT NULL,
	`attempt_count` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`scheduled_for` text,
	`started_at` text,
	`completed_at` text,
	`last_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orchestrator_jobs_idempotency_key_unique` ON `orchestrator_jobs` (`idempotency_key`);
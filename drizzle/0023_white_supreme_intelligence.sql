CREATE TABLE `agent_api_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`label` text,
	`scopes_json` text DEFAULT '["projects:read"]' NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text,
	`last_used_at` text,
	`revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agent_api_tokens_hash_unique` ON `agent_api_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `agent_api_tokens_agent_status_lookup` ON `agent_api_tokens` (`agent_id`,`status`);
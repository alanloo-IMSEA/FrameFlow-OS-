CREATE TABLE `member_telegram_identities` (
	`member_email` text PRIMARY KEY NOT NULL,
	`expected_username` text,
	`telegram_user_id` text,
	`username` text,
	`display_name` text,
	`picture_url` text,
	`status` text DEFAULT 'Ready to link' NOT NULL,
	`linked_at` text,
	`last_login_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_telegram_identities_telegram_user_id_unique` ON `member_telegram_identities` (`telegram_user_id`);--> statement-breakpoint
CREATE TABLE `member_telegram_login_requests` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`member_email` text NOT NULL,
	`code_verifier` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `member_telegram_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`member_email` text NOT NULL,
	`telegram_user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`revoked_at` text
);

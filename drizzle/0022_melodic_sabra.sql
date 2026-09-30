ALTER TABLE `publishing_records` ADD `telegram_notification_status` text DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE `publishing_records` ADD `telegram_notified_at` text;--> statement-breakpoint
ALTER TABLE `publishing_records` ADD `telegram_notification_error` text;--> statement-breakpoint
UPDATE `publishing_records` SET `telegram_notification_status` = 'LEGACY_SKIPPED' WHERE `status` = 'PUBLISHED';

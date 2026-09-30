ALTER TABLE `projects` ADD `creative_concept` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `creative_objective` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `content_pillars` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `visual_style` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `tone_mood` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `key_takeaway` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `format_direction` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `script_data` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `script_status` text NOT NULL DEFAULT 'Locked';

CREATE TABLE `kk_conversations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` text NOT NULL,
	`sender` text NOT NULL,
	`body` text NOT NULL,
	`order_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_conversations_member` ON `kk_conversations` (`member_id`,`id`);--> statement-breakpoint
ALTER TABLE `kk_photo_drafts` ADD `country` text DEFAULT 'JP' NOT NULL;
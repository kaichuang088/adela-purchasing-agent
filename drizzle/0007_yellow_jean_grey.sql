CREATE TABLE `kk_photo_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`image_key` text NOT NULL,
	`image_type` text NOT NULL,
	`note` text NOT NULL,
	`state` text DEFAULT 'uploaded' NOT NULL,
	`analysis_json` text,
	`pricing_json` text,
	`expires_at` text NOT NULL,
	`order_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_photo_drafts_member` ON `kk_photo_drafts` (`member_id`,`created_at`);
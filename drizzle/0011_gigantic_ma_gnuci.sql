CREATE TABLE `kk_support_threads` (
	`member_id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'ai' NOT NULL,
	`needs_human` integer DEFAULT 0 NOT NULL,
	`ai_summary` text DEFAULT '' NOT NULL,
	`unread_admin` integer DEFAULT 0 NOT NULL,
	`unread_member` integer DEFAULT 0 NOT NULL,
	`last_member_at` text,
	`last_admin_at` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_support_threads_queue` ON `kk_support_threads` (`needs_human`,`updated_at`);--> statement-breakpoint
PRAGMA optimize;

CREATE TABLE `request_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_id` integer NOT NULL,
	`status` text NOT NULL,
	`title_zh` text NOT NULL,
	`title_en` text NOT NULL,
	`detail_zh` text DEFAULT '' NOT NULL,
	`detail_en` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_request_events_request_created` ON `request_events` (`request_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `request_notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_id` integer NOT NULL,
	`email` text NOT NULL,
	`channel` text DEFAULT 'in_app_browser' NOT NULL,
	`title_zh` text NOT NULL,
	`title_en` text NOT NULL,
	`body_zh` text DEFAULT '' NOT NULL,
	`body_en` text DEFAULT '' NOT NULL,
	`delivery_status` text DEFAULT 'queued' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_request_notifications_request_created` ON `request_notifications` (`request_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `shopping_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_no` text NOT NULL,
	`customer_name` text NOT NULL,
	`email` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`image_key` text NOT NULL,
	`image_name` text NOT NULL,
	`image_type` text NOT NULL,
	`status` text DEFAULT 'submitted' NOT NULL,
	`analysis_state` text DEFAULT 'pending' NOT NULL,
	`identified_name_zh` text DEFAULT '' NOT NULL,
	`identified_name_en` text DEFAULT '' NOT NULL,
	`ai_analysis_json` text,
	`quote_json` text,
	`browser_notifications` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shopping_requests_request_no_unique` ON `shopping_requests` (`request_no`);--> statement-breakpoint
CREATE INDEX `idx_shopping_requests_email_created` ON `shopping_requests` (`email`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_shopping_requests_status_updated` ON `shopping_requests` (`status`,`updated_at`);--> statement-breakpoint
PRAGMA optimize;

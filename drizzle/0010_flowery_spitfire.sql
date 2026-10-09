CREATE TABLE `kk_member_credentials` (
	`email` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`password_hash` text NOT NULL,
	`salt` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kk_member_credentials_member_id_unique` ON `kk_member_credentials` (`member_id`);--> statement-breakpoint
CREATE TABLE `kk_member_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_member_sessions_member_expiry` ON `kk_member_sessions` (`member_id`,`expires_at`);
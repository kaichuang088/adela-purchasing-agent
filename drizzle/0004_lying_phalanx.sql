CREATE TABLE `kk_coupon_uses` (
	`id` text PRIMARY KEY NOT NULL,
	`offer_id` integer NOT NULL,
	`member_id` text NOT NULL,
	`order_no` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `kk_ledger` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_key` text NOT NULL,
	`member_id` text NOT NULL,
	`order_id` integer,
	`miles` integer NOT NULL,
	`spend_jpy` integer DEFAULT 0 NOT NULL,
	`reason` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `kk_ledger_event_key_unique` ON `kk_ledger` (`event_key`);--> statement-breakpoint
CREATE TABLE `kk_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`title_en` text DEFAULT '' NOT NULL,
	`body_en` text DEFAULT '' NOT NULL,
	`order_id` integer,
	`read_at` text,
	`email_status` text DEFAULT 'not_requested' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `kk_members` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`spend_jpy` integer DEFAULT 0 NOT NULL,
	`miles` integer DEFAULT 0 NOT NULL,
	`override_tier` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "miles_nonnegative" CHECK("kk_members"."miles" >= 0),
	CONSTRAINT "spend_nonnegative" CHECK("kk_members"."spend_jpy" >= 0)
);
--> statement-breakpoint
CREATE TABLE `kk_offers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`data` text NOT NULL,
	`code` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT 1 NOT NULL
);

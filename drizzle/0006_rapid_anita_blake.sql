CREATE TABLE `kk_price_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` integer NOT NULL,
	`previous_json` text NOT NULL,
	`proposed_json` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`payment_reference` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`accepted_at` text,
	`settled_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_kk_price_revisions_order` ON `kk_price_revisions` (`order_id`,`created_at`);
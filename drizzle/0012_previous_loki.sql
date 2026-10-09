CREATE TABLE `kk_exchange_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` integer NOT NULL,
	`member_id` text NOT NULL,
	`content_type` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE `kk_messages` ADD `delivery_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `kk_messages_delivery_key_unique` ON `kk_messages` (`delivery_key`);--> statement-breakpoint
ALTER TABLE `shopping_requests` ADD `purchase_at` text;--> statement-breakpoint
ALTER TABLE `shopping_requests` ADD `cancel_until` text;--> statement-breakpoint
ALTER TABLE `shopping_requests` ADD `received_at` text;--> statement-breakpoint
ALTER TABLE `shopping_requests` ADD `refund_amount_twd` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `shopping_requests` ADD `refund_account` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `shopping_requests` ADD `refund_reference` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `shopping_requests` ADD `cancel_reason` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `shopping_requests` ADD `exchange_status` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `shopping_requests` ADD `exchange_reason` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `shopping_requests` ADD `exchange_photo_id` text;
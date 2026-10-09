ALTER TABLE `products` ADD `commerce_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `shopping_requests` ADD `member_id` text;--> statement-breakpoint
ALTER TABLE `shopping_requests` ADD `pricing_json` text;--> statement-breakpoint
ALTER TABLE `shopping_requests` ADD `paid_at` text;--> statement-breakpoint
ALTER TABLE `shopping_requests` ADD `purchased_at` text;--> statement-breakpoint
ALTER TABLE `shopping_requests` ADD `eta` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `shopping_requests` ADD `eta_reason` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `shopping_requests` ADD `snack_redeemed` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `shopping_requests` ADD `payment_reference` text DEFAULT '' NOT NULL;
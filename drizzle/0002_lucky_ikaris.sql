ALTER TABLE `products` ADD `quote_json` text;--> statement-breakpoint
ALTER TABLE `products` ADD `source_request_id` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `products_source_request_id_unique` ON `products` (`source_request_id`);--> statement-breakpoint
ALTER TABLE `shopping_requests` ADD `submission_key` text;--> statement-breakpoint
ALTER TABLE `shopping_requests` ADD `kind` text DEFAULT 'custom' NOT NULL;--> statement-breakpoint
ALTER TABLE `shopping_requests` ADD `product_id` integer;--> statement-breakpoint
ALTER TABLE `shopping_requests` ADD `quantity` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `shopping_requests_submission_key_unique` ON `shopping_requests` (`submission_key`);
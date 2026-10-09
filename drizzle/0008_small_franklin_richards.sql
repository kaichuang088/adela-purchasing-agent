ALTER TABLE `shopping_requests` ADD `payment_method` text DEFAULT 'transfer' NOT NULL;--> statement-breakpoint
ALTER TABLE `shopping_requests` ADD `payment_due_at` text;--> statement-breakpoint
ALTER TABLE `shopping_requests` ADD `payment_reported_at` text;
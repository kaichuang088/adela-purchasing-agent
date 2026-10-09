CREATE TABLE `orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_no` text NOT NULL,
	`customer_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`locale` text DEFAULT 'zh-TW' NOT NULL,
	`status` text DEFAULT 'pending_confirmation' NOT NULL,
	`subtotal_jpy` integer NOT NULL,
	`exchange_rate` real NOT NULL,
	`service_fee_twd` integer DEFAULT 0 NOT NULL,
	`intl_shipping_twd` integer DEFAULT 0 NOT NULL,
	`local_shipping_twd` integer DEFAULT 0 NOT NULL,
	`tax_twd` integer DEFAULT 0 NOT NULL,
	`total_twd` integer NOT NULL,
	`items_json` text NOT NULL,
	`timeline_json` text NOT NULL,
	`customer_notes` text DEFAULT '' NOT NULL,
	`admin_notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `orders_order_no_unique` ON `orders` (`order_no`);--> statement-breakpoint
CREATE INDEX `idx_orders_email_created` ON `orders` (`email`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_orders_status_updated` ON `orders` (`status`,`updated_at`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name_zh` text NOT NULL,
	`name_en` text NOT NULL,
	`category_zh` text NOT NULL,
	`category_en` text NOT NULL,
	`description_zh` text DEFAULT '' NOT NULL,
	`description_en` text DEFAULT '' NOT NULL,
	`price_jpy` integer NOT NULL,
	`image_key` text,
	`status` text DEFAULT 'active' NOT NULL,
	`featured` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_products_status_sort` ON `products` (`status`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_products_category` ON `products` (`category_zh`);--> statement-breakpoint
CREATE TABLE `store_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
PRAGMA optimize;

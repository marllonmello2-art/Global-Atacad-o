CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`document` text,
	`phone` text,
	`email` text,
	`type` text DEFAULT 'varejo' NOT NULL,
	`credit_limit` real DEFAULT 0 NOT NULL,
	`payment_term_days` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'aprovado' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `financial_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`type` text NOT NULL,
	`order_id` text,
	`description` text NOT NULL,
	`category` text,
	`amount` real NOT NULL,
	`due_date` text NOT NULL,
	`paid_at` text,
	`status` text DEFAULT 'pendente' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`product_id` text,
	`variant_id` text,
	`description` text NOT NULL,
	`quantity` real NOT NULL,
	`unit_price` real NOT NULL,
	`total` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`customer_id` text,
	`customer_name_snapshot` text,
	`customer_phone_snapshot` text,
	`status` text DEFAULT 'orcamento' NOT NULL,
	`payment_method` text DEFAULT 'pix' NOT NULL,
	`subtotal` real DEFAULT 0 NOT NULL,
	`discount` real DEFAULT 0 NOT NULL,
	`total` real DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `price_tiers` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`min_quantity` real NOT NULL,
	`price` real NOT NULL,
	`label` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`name` text NOT NULL,
	`sku` text,
	`ean` text,
	`price_override` real,
	`stock` real DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`sku` text,
	`ean` text,
	`name` text NOT NULL,
	`description` text,
	`category` text,
	`brand` text,
	`unit` text DEFAULT 'un' NOT NULL,
	`cost_price` real DEFAULT 0 NOT NULL,
	`retail_price` real DEFAULT 0 NOT NULL,
	`min_stock` real DEFAULT 0 NOT NULL,
	`current_stock` real DEFAULT 0 NOT NULL,
	`image_key` text,
	`image_mime` text,
	`active` integer DEFAULT true NOT NULL,
	`visible_in_catalog` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`product_id` text NOT NULL,
	`variant_id` text,
	`type` text NOT NULL,
	`quantity` real NOT NULL,
	`reason` text,
	`reference_order_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `store_settings` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`store_name` text NOT NULL,
	`whatsapp_number` text,
	`description` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);

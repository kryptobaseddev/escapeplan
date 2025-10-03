CREATE TABLE `discount_code_games` (
	`id` text PRIMARY KEY NOT NULL,
	`discount_code_id` text NOT NULL,
	`game_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`discount_code_id`) REFERENCES `discount_codes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_discount_game_unique` ON `discount_code_games` (`discount_code_id`,`game_id`);--> statement-breakpoint
CREATE INDEX `idx_discount_game_code` ON `discount_code_games` (`discount_code_id`);--> statement-breakpoint
CREATE INDEX `idx_discount_game_game` ON `discount_code_games` (`game_id`);--> statement-breakpoint
CREATE TABLE `discount_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`description` text,
	`type` text NOT NULL,
	`percent_off` integer,
	`amount_off_cents` integer,
	`valid_from` text,
	`valid_until` text,
	`max_uses` integer,
	`current_uses` integer DEFAULT 0 NOT NULL,
	`applies_to` text DEFAULT 'all' NOT NULL,
	`minimum_party_size` integer,
	`notes` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`created_by`) REFERENCES `operators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discount_codes_code_unique` ON `discount_codes` (`code`);--> statement-breakpoint
CREATE INDEX `idx_discount_codes_code` ON `discount_codes` (`code`);--> statement-breakpoint
CREATE INDEX `idx_discount_codes_active` ON `discount_codes` (`archived_at`,`valid_from`,`valid_until`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_games` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`story_intro` text,
	`duration_minutes` integer DEFAULT 60 NOT NULL,
	`difficulty` text,
	`game_type` text DEFAULT 'storefront' NOT NULL,
	`pricing_model` text,
	`category` text,
	`categories` text,
	`min_players` integer DEFAULT 1 NOT NULL,
	`max_players` integer DEFAULT 1 NOT NULL,
	`price_per_player_cents` integer,
	`resources_required` integer DEFAULT 1 NOT NULL,
	`validation_notes` text,
	`default_volume` integer DEFAULT 80 NOT NULL,
	`camera_ids` text DEFAULT '[]',
	`media_config` text,
	`pricing_config` text,
	`booking_rules_config` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`archived_at` text,
	`archived_by` text,
	`archived_reason` text
);
--> statement-breakpoint
INSERT INTO `__new_games`("id", "slug", "name", "description", "story_intro", "duration_minutes", "difficulty", "game_type", "pricing_model", "category", "categories", "min_players", "max_players", "price_per_player_cents", "resources_required", "validation_notes", "default_volume", "camera_ids", "media_config", "pricing_config", "booking_rules_config", "created_at", "updated_at", "archived_at", "archived_by", "archived_reason") SELECT "id", "slug", "name", "description", "story_intro", "duration_minutes", "difficulty", 'storefront', "pricing_model", "category", "categories", "min_players", "max_players", "price_per_player_cents", "resources_required", "validation_notes", "default_volume", "camera_ids", "media_config", "pricing_config", "booking_rules_config", "created_at", "updated_at", "archived_at", "archived_by", "archived_reason" FROM `games`;--> statement-breakpoint
DROP TABLE `games`;--> statement-breakpoint
ALTER TABLE `__new_games` RENAME TO `games`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `games_slug_unique` ON `games` (`slug`);
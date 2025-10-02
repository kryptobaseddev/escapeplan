CREATE TABLE `alert_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`category` text NOT NULL,
	`level` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`conditions` text NOT NULL,
	`title_template` text NOT NULL,
	`message_template` text NOT NULL,
	`auto_dismiss_on` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `alert_rules_name_unique` ON `alert_rules` (`name`);--> statement-breakpoint
CREATE INDEX `idx_alert_rules_enabled` ON `alert_rules` (`enabled`);--> statement-breakpoint
CREATE INDEX `idx_alert_rules_category` ON `alert_rules` (`category`);--> statement-breakpoint
CREATE TABLE `alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text,
	`level` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`context` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`dismissed_at` text,
	`dismissed_by` text,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`dismissed_by`) REFERENCES `operators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_alerts_session` ON `alerts` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_alerts_level` ON `alerts` (`level`);--> statement-breakpoint
CREATE INDEX `idx_alerts_created` ON `alerts` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_alerts_active` ON `alerts` (`dismissed_at`);--> statement-breakpoint
CREATE TABLE `asset_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`used_in_game_id` text,
	`used_in_puzzle_id` text,
	`usage_type` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`used_in_game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_asset_usage_asset` ON `asset_usage` (`asset_id`);--> statement-breakpoint
CREATE INDEX `idx_asset_usage_game` ON `asset_usage` (`used_in_game_id`);--> statement-breakpoint
CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`filename` text NOT NULL,
	`original_filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`asset_type` text NOT NULL,
	`media_type` text,
	`file_path` text NOT NULL,
	`game_id` text,
	`puzzle_id` text,
	`hint_order` integer,
	`default_volume` integer DEFAULT 80 NOT NULL,
	`is_reusable` integer DEFAULT false NOT NULL,
	`uploaded_by` text NOT NULL,
	`uploaded_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`metadata` text,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `operators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_assets_game_id` ON `assets` (`game_id`);--> statement-breakpoint
CREATE INDEX `idx_assets_type` ON `assets` (`asset_type`);--> statement-breakpoint
CREATE INDEX `idx_assets_reusable` ON `assets` (`is_reusable`);--> statement-breakpoint
CREATE TABLE `bookings` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_code` text NOT NULL,
	`game_id` text NOT NULL,
	`room_id` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`status` text NOT NULL,
	`party_size` integer NOT NULL,
	`deposit_due_cents` integer DEFAULT 0 NOT NULL,
	`total_due_cents` integer DEFAULT 0 NOT NULL,
	`price_tier` text NOT NULL,
	`discount_code` text,
	`is_mobile` integer DEFAULT false NOT NULL,
	`is_adhoc` integer DEFAULT false NOT NULL,
	`location_note` text,
	`contact_name` text NOT NULL,
	`contact_phone` text NOT NULL,
	`notes` text,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_booking_code_unique` ON `bookings` (`booking_code`);--> statement-breakpoint
CREATE TABLE `game_milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`media_type` text,
	`content` text,
	`asset_id` text,
	`volume_level` integer DEFAULT 80 NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`trigger_type` text NOT NULL,
	`trigger_config` text,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_game_milestones_game` ON `game_milestones` (`game_id`);--> statement-breakpoint
CREATE INDEX `idx_game_milestones_type` ON `game_milestones` (`type`);--> statement-breakpoint
CREATE INDEX `idx_game_milestones_enabled` ON `game_milestones` (`enabled`);--> statement-breakpoint
CREATE TABLE `game_puzzles` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`solution` text,
	`media_asset` text,
	`operator_actions` text,
	`display_order` integer DEFAULT 0 NOT NULL,
	`hints` text,
	`media_asset_meta` text,
	`slug` text,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`story_intro` text,
	`duration_minutes` integer DEFAULT 60 NOT NULL,
	`difficulty` text,
	`pricing_model` text,
	`category` text,
	`categories` text,
	`min_players` integer DEFAULT 1 NOT NULL,
	`max_players` integer DEFAULT 1 NOT NULL,
	`price_per_player_cents` integer DEFAULT 0 NOT NULL,
	`resources_required` integer DEFAULT 1 NOT NULL,
	`validation_notes` text,
	`default_volume` integer DEFAULT 80 NOT NULL,
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
CREATE UNIQUE INDEX `games_slug_unique` ON `games` (`slug`);--> statement-breakpoint
CREATE TABLE `network_health` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`status` text NOT NULL,
	`message` text NOT NULL,
	`last_checked` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `network_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`ssid` text NOT NULL,
	`password` text,
	`description` text,
	`band` text,
	`channel` integer,
	`security` text,
	`broadcast_enabled` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'offline' NOT NULL,
	`status_message` text,
	`details` text,
	`last_updated` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `operator_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` text,
	`refresh_token_expires_at` text,
	`scope` text,
	`password` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `operators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `operator_auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`impersonated_by` text,
	FOREIGN KEY (`user_id`) REFERENCES `operators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `operator_auth_sessions_token_unique` ON `operator_auth_sessions` (`token`);--> statement-breakpoint
CREATE TABLE `operator_verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `operators` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`email_verified` integer DEFAULT false NOT NULL,
	`role` text NOT NULL,
	`avatar_config` text,
	`bio` text,
	`permissions` text DEFAULT '[]' NOT NULL,
	`must_reset_password` integer DEFAULT false NOT NULL,
	`password_hash` text,
	`last_login_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`banned` integer DEFAULT false NOT NULL,
	`ban_reason` text,
	`ban_expires` text,
	`archived_at` text,
	`archived_by` text,
	`archived_reason` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `operators_username_unique` ON `operators` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `operators_email_unique` ON `operators` (`email`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` text NOT NULL,
	`name` text NOT NULL,
	`is_mobile_capable` integer DEFAULT false NOT NULL,
	`theme_token` text,
	`description` text,
	`slug` text,
	`capacity` integer,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session_hints` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`puzzle_id` text,
	`type` text NOT NULL,
	`message` text NOT NULL,
	`asset_url` text,
	`volume_level` integer,
	`delivered_by` text NOT NULL,
	`delivered_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session_milestones` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`milestone_id` text NOT NULL,
	`milestone_type` text NOT NULL,
	`milestone_name` text NOT NULL,
	`media_type` text,
	`content` text,
	`asset_url` text,
	`volume_level` integer,
	`triggered_at` text NOT NULL,
	`triggered_by` text,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`milestone_id`) REFERENCES `game_milestones`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`triggered_by`) REFERENCES `operators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_session_milestones_session` ON `session_milestones` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_session_milestones_milestone` ON `session_milestones` (`milestone_id`);--> statement-breakpoint
CREATE INDEX `idx_session_milestones_triggered` ON `session_milestones` (`triggered_at`);--> statement-breakpoint
CREATE INDEX `idx_session_milestone_unique` ON `session_milestones` (`session_id`,`milestone_id`);--> statement-breakpoint
CREATE TABLE `session_puzzles` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`puzzle_id` text,
	`title` text NOT NULL,
	`description` text,
	`solution` text,
	`status` text NOT NULL,
	`display_order` integer NOT NULL,
	`hints` text,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`booking_id` text NOT NULL,
	`status` text NOT NULL,
	`timer_total_seconds` integer NOT NULL,
	`timer_remaining_seconds` integer NOT NULL,
	`timer_total_elapsed_seconds` integer DEFAULT 0 NOT NULL,
	`timer_status` text NOT NULL,
	`started_at` text NOT NULL,
	`scheduled_end` text NOT NULL,
	`hints_used` integer DEFAULT 0 NOT NULL,
	`stream_thumbnail_url` text,
	`background_audio_track` text,
	`background_audio_is_playing` integer DEFAULT false NOT NULL,
	`crew_primary` text NOT NULL,
	`crew_support` text,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `storage_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`total_size_bytes` integer NOT NULL,
	`total_files` integer NOT NULL,
	`by_type` text NOT NULL,
	`by_game` text NOT NULL,
	`last_backup_at` text,
	`recorded_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `system_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`level` text NOT NULL,
	`category` text NOT NULL,
	`message` text NOT NULL,
	`context` text,
	`timestamp` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_logs_timestamp` ON `system_logs` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_logs_level` ON `system_logs` (`level`);--> statement-breakpoint
CREATE INDEX `idx_logs_category` ON `system_logs` (`category`);--> statement-breakpoint
CREATE INDEX `idx_logs_created` ON `system_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `timer_slugs` (
	`slug` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`narrative` text,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);

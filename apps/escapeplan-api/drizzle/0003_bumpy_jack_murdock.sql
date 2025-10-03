CREATE TABLE `cameras` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`game_id` text,
	`protocol` text NOT NULL,
	`host` text NOT NULL,
	`port` integer DEFAULT 554 NOT NULL,
	`username` text,
	`password_encrypted` text,
	`stream_path` text,
	`resolution` text DEFAULT '720p',
	`frame_rate` integer DEFAULT 15,
	`transport` text DEFAULT 'tcp',
	`status` text DEFAULT 'offline',
	`last_seen` text,
	`error_message` text,
	`hls_streaming` integer DEFAULT false,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_cameras_game` ON `cameras` (`game_id`);--> statement-breakpoint
CREATE INDEX `idx_cameras_status` ON `cameras` (`status`);--> statement-breakpoint
ALTER TABLE `games` ADD `camera_ids` text DEFAULT '[]';
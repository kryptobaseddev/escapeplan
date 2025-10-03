CREATE TABLE `backups` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`file_path` text,
	`file_size_bytes` integer,
	`includes` text NOT NULL,
	`destination` text NOT NULL,
	`usb_device` text,
	`checksum_sha256` text,
	`error_message` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`created_by`) REFERENCES `operators`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_backups_created` ON `backups` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_backups_status` ON `backups` (`status`);--> statement-breakpoint
CREATE INDEX `idx_backups_type` ON `backups` (`type`);--> statement-breakpoint
CREATE TABLE `system_health` (
	`id` text PRIMARY KEY NOT NULL,
	`cpu_usage_percent` integer NOT NULL,
	`memory_total_mb` integer NOT NULL,
	`memory_used_mb` integer NOT NULL,
	`disk_total_gb` integer NOT NULL,
	`disk_used_gb` integer NOT NULL,
	`uptime_seconds` integer NOT NULL,
	`services_status` text NOT NULL,
	`recorded_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_system_health_recorded` ON `system_health` (`recorded_at`);--> statement-breakpoint
CREATE TABLE `usb_devices` (
	`id` text PRIMARY KEY NOT NULL,
	`device_path` text NOT NULL,
	`mount_point` text,
	`label` text,
	`total_space_gb` integer,
	`available_space_gb` integer,
	`is_mounted` integer DEFAULT false NOT NULL,
	`last_seen` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_usb_devices_path` ON `usb_devices` (`device_path`);--> statement-breakpoint
CREATE INDEX `idx_usb_devices_mounted` ON `usb_devices` (`is_mounted`);
CREATE TABLE `system_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`type` text NOT NULL,
	`category` text NOT NULL,
	`label` text NOT NULL,
	`description` text,
	`is_editable` integer DEFAULT true NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text,
	FOREIGN KEY (`updated_by`) REFERENCES `operators`(`id`) ON UPDATE no action ON DELETE no action
);

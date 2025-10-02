PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_operators` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`email_verified` integer DEFAULT false NOT NULL,
	`role` text NOT NULL,
	`permissions` text DEFAULT '[]' NOT NULL,
	`role_id` text NOT NULL,
	`avatar_config` text,
	`bio` text,
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
	`archived_reason` text,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_operators`(
  "id",
  "username",
  "name",
  "email",
  "email_verified",
  "role",
  "permissions",
  "role_id",
  "avatar_config",
  "bio",
  "must_reset_password",
  "password_hash",
  "last_login_at",
  "created_at",
  "updated_at",
  "banned",
  "ban_reason",
  "ban_expires",
  "archived_at",
  "archived_by",
  "archived_reason"
) 
SELECT
  "id",
  "username",
  "name",
  "email",
  "email_verified",
  COALESCE(
    (
      SELECT r."name"
      FROM `roles` r
      WHERE r."id" = `operators`.`role_id`
      LIMIT 1
    ),
    'manager'
  ) AS "role",
  '[]' AS "permissions",
  "role_id",
  "avatar_config",
  "bio",
  "must_reset_password",
  "password_hash",
  "last_login_at",
  "created_at",
  "updated_at",
  "banned",
  "ban_reason",
  "ban_expires",
  "archived_at",
  "archived_by",
  "archived_reason"
FROM `operators`;--> statement-breakpoint
DROP TABLE `operators`;--> statement-breakpoint
ALTER TABLE `__new_operators` RENAME TO `operators`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `operators_username_unique` ON `operators` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `operators_email_unique` ON `operators` (`email`);

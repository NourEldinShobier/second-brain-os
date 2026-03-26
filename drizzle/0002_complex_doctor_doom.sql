CREATE TABLE `entity_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_entity_id` text NOT NULL,
	`owner_entity_type` text NOT NULL,
	`path_in_package` text NOT NULL,
	`original_filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`title` text,
	`description` text,
	`sha256` text,
	`imported_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `entity_assets_owner_idx` ON `entity_assets` (`owner_entity_id`);--> statement-breakpoint
CREATE INDEX `entity_assets_owner_type_idx` ON `entity_assets` (`owner_entity_type`,`owner_entity_id`);
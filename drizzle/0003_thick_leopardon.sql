CREATE TABLE `drive_items` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`file_path` text NOT NULL,
	`item_type` text NOT NULL,
	`description` text,
	`original_name` text NOT NULL,
	`source_path` text,
	`imported_at` text NOT NULL,
	`mime_type` text,
	`sha256` text,
	`child_count` integer,
	`archived` integer DEFAULT false NOT NULL,
	`archived_at` text,
	`archive_reason` text,
	`area_ids_json` text,
	`project_ids_json` text,
	`task_ids_json` text,
	`note_ids_json` text,
	`goal_ids_json` text,
	`tags_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `drive_items_slug_idx` ON `drive_items` (`slug`);--> statement-breakpoint
CREATE INDEX `drive_items_file_path_idx` ON `drive_items` (`file_path`);
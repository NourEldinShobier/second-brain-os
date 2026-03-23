CREATE TABLE `areas` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`file_path` text NOT NULL,
	`status` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`area_type` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `areas_slug_idx` ON `areas` (`slug`);--> statement-breakpoint
CREATE INDEX `areas_file_path_idx` ON `areas` (`file_path`);--> statement-breakpoint
CREATE TABLE `goals` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`file_path` text NOT NULL,
	`status` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`target_date` text,
	`quarter` text,
	`year` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `goals_slug_idx` ON `goals` (`slug`);--> statement-breakpoint
CREATE INDEX `goals_file_path_idx` ON `goals` (`file_path`);--> statement-breakpoint
CREATE TABLE `goal_key_results` (
	`id` text PRIMARY KEY NOT NULL,
	`goal_id` text NOT NULL,
	`title` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`target_date` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `goal_key_results_goal_id_idx` ON `goal_key_results` (`goal_id`);--> statement-breakpoint
CREATE TABLE `inbox_items` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`file_path` text NOT NULL,
	`status` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`raw_input` text,
	`suggested_entity_type` text,
	`processed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inbox_items_slug_idx` ON `inbox_items` (`slug`);--> statement-breakpoint
CREATE INDEX `inbox_items_file_path_idx` ON `inbox_items` (`file_path`);--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`file_path` text NOT NULL,
	`status` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`topic_summary` text,
	`pinned` integer,
	`favorite` integer,
	`notebook` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `notes_slug_idx` ON `notes` (`slug`);--> statement-breakpoint
CREATE INDEX `notes_file_path_idx` ON `notes` (`file_path`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`file_path` text NOT NULL,
	`status` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`priority` integer,
	`start_date` text,
	`end_date` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `projects_slug_idx` ON `projects` (`slug`);--> statement-breakpoint
CREATE INDEX `projects_file_path_idx` ON `projects` (`file_path`);--> statement-breakpoint
CREATE TABLE `resources` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`file_path` text NOT NULL,
	`status` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`resource_type` text,
	`source_url` text,
	`pinned` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `resources_slug_idx` ON `resources` (`slug`);--> statement-breakpoint
CREATE INDEX `resources_file_path_idx` ON `resources` (`file_path`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`file_path` text NOT NULL,
	`status` text NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`priority` integer,
	`energy` text,
	`do_date` text,
	`start_time` text,
	`end_time` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tasks_slug_idx` ON `tasks` (`slug`);--> statement-breakpoint
CREATE INDEX `tasks_file_path_idx` ON `tasks` (`file_path`);--> statement-breakpoint
CREATE TABLE `taxonomy_terms` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `taxonomy_terms_name_kind_idx` ON `taxonomy_terms` (`name`,`kind`);--> statement-breakpoint
CREATE TABLE `entity_taxonomy_links` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`taxonomy_term_id` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`taxonomy_term_id`) REFERENCES `taxonomy_terms`(`id`) ON UPDATE cascade ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `entity_taxonomy_entity_idx` ON `entity_taxonomy_links` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `entity_taxonomy_term_idx` ON `entity_taxonomy_links` (`taxonomy_term_id`);--> statement-breakpoint
CREATE TABLE `ai_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text,
	`action` text NOT NULL,
	`confidence` real,
	`rationale` text,
	`metadata_json` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_operations_created_idx` ON `ai_operations` (`created_at`);--> statement-breakpoint
CREATE TABLE `archive_events` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`occurred_at` text NOT NULL,
	`reason` text,
	`previous_path` text,
	`new_path` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `archive_events_entity_idx` ON `archive_events` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `entity_links` (
	`id` text PRIMARY KEY NOT NULL,
	`from_entity_type` text NOT NULL,
	`from_entity_id` text NOT NULL,
	`to_entity_type` text NOT NULL,
	`to_entity_id` text NOT NULL,
	`link_kind` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text
);
--> statement-breakpoint
CREATE INDEX `entity_links_from_idx` ON `entity_links` (`from_entity_type`,`from_entity_id`);--> statement-breakpoint
CREATE INDEX `entity_links_to_idx` ON `entity_links` (`to_entity_type`,`to_entity_id`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`review_kind` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`artifact_path` text,
	`summary` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `reviews_kind_idx` ON `reviews` (`review_kind`);

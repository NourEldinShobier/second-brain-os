-- Remove ai_operations table and the created_by column from entity_links.
-- ai_operations was an internal audit log for AI provider calls; it is no longer maintained.
-- created_by on entity_links was the only field that referenced AI authorship.

DROP TABLE IF EXISTS `ai_operations`;
--> statement-breakpoint
ALTER TABLE `entity_links` DROP COLUMN `created_by`;

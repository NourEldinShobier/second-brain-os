import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const timestamps = {
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
};

export const driveItems = sqliteTable(
  'drive_items',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    file_path: text('file_path').notNull(),
    item_type: text('item_type').notNull(),
    description: text('description'),
    original_name: text('original_name').notNull(),
    source_path: text('source_path'),
    imported_at: text('imported_at').notNull(),
    mime_type: text('mime_type'),
    sha256: text('sha256'),
    child_count: integer('child_count'),
    area_ids_json: text('area_ids_json'),
    project_ids_json: text('project_ids_json'),
    task_ids_json: text('task_ids_json'),
    note_ids_json: text('note_ids_json'),
    goal_ids_json: text('goal_ids_json'),
    tags_json: text('tags_json'),
    item_path: text('item_path'),
    primary_entity_type: text('primary_entity_type'),
    primary_entity_id: text('primary_entity_id'),
    primary_entity_slug: text('primary_entity_slug'),
    ...timestamps,
  },
  (t) => [
    index('drive_items_slug_idx').on(t.slug),
    index('drive_items_file_path_idx').on(t.file_path),
  ],
);

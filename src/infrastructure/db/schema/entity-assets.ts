import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const timestamps = {
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
};

/**
 * Derivative index for entity-owned files. Durable truth is the owning `index.md` manifest
 * plus files under `<package>/assets/`.
 */
export const entityAssets = sqliteTable(
  'entity_assets',
  {
    id: text('id').primaryKey(),
    owner_entity_id: text('owner_entity_id').notNull(),
    owner_entity_type: text('owner_entity_type').notNull(),
    path_in_package: text('path_in_package').notNull(),
    original_filename: text('original_filename').notNull(),
    mime_type: text('mime_type').notNull(),
    title: text('title'),
    description: text('description'),
    sha256: text('sha256'),
    imported_at: text('imported_at').notNull(),
    ...timestamps,
  },
  (t) => [
    index('entity_assets_owner_idx').on(t.owner_entity_id),
    index('entity_assets_owner_type_idx').on(t.owner_entity_type, t.owner_entity_id),
  ],
);

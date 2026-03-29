import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const workspaceKv = sqliteTable('workspace_kv', {
  key: text('key').primaryKey().notNull(),
  value: text('value').notNull(),
});

export const taxonomyTerms = sqliteTable(
  'taxonomy_terms',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    kind: text('kind').notNull(),
    created_at: text('created_at').notNull(),
    updated_at: text('updated_at').notNull(),
  },
  (t) => [index('taxonomy_terms_name_kind_idx').on(t.name, t.kind)],
);

export const entityTaxonomyLinks = sqliteTable(
  'entity_taxonomy_links',
  {
    id: text('id').primaryKey(),
    entity_type: text('entity_type').notNull(),
    entity_id: text('entity_id').notNull(),
    taxonomy_term_id: text('taxonomy_term_id')
      .notNull()
      .references(() => taxonomyTerms.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    created_at: text('created_at').notNull(),
  },
  (t) => [
    index('entity_taxonomy_entity_idx').on(t.entity_type, t.entity_id),
    index('entity_taxonomy_term_idx').on(t.taxonomy_term_id),
  ],
);

export const entityLinks = sqliteTable(
  'entity_links',
  {
    id: text('id').primaryKey(),
    from_entity_type: text('from_entity_type').notNull(),
    from_entity_id: text('from_entity_id').notNull(),
    to_entity_type: text('to_entity_type').notNull(),
    to_entity_id: text('to_entity_id').notNull(),
    link_kind: text('link_kind').notNull(),
    created_at: text('created_at').notNull(),
  },
  (t) => [
    index('entity_links_from_idx').on(t.from_entity_type, t.from_entity_id),
    index('entity_links_to_idx').on(t.to_entity_type, t.to_entity_id),
  ],
);

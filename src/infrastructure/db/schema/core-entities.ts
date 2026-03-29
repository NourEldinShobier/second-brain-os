import { index, sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

/**
 * `file_path` columns: workspace-relative path to the canonical entity Markdown file
 * (`<para-folder>/<slug>/index.md`), not the package directory alone. See `activeEntityDocumentPath`.
 */

/** Shared: ISO-8601 timestamps stored as text for inspectability. */
const timestamps = {
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
};

export const areas = sqliteTable(
  'areas',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    file_path: text('file_path').notNull(),
    status: text('status').notNull(),
    area_type: text('area_type'),
    ...timestamps,
  },
  (t) => [index('areas_slug_idx').on(t.slug), index('areas_file_path_idx').on(t.file_path)],
);

export const goals = sqliteTable(
  'goals',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    file_path: text('file_path').notNull(),
    status: text('status').notNull(),
    target_date: text('target_date'),
    quarter: text('quarter'),
    year: integer('year'),
    ...timestamps,
  },
  (t) => [index('goals_slug_idx').on(t.slug), index('goals_file_path_idx').on(t.file_path)],
);

export const goalKeyResults = sqliteTable(
  'goal_key_results',
  {
    id: text('id').primaryKey(),
    goal_id: text('goal_id')
      .notNull()
      .references(() => goals.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    title: text('title').notNull(),
    completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
    target_date: text('target_date'),
    sort_order: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('goal_key_results_goal_id_idx').on(t.goal_id)],
);

export const projects = sqliteTable(
  'projects',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    file_path: text('file_path').notNull(),
    status: text('status').notNull(),
    priority: integer('priority'),
    start_date: text('start_date'),
    end_date: text('end_date'),
    ...timestamps,
  },
  (t) => [index('projects_slug_idx').on(t.slug), index('projects_file_path_idx').on(t.file_path)],
);

export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    file_path: text('file_path').notNull(),
    status: text('status').notNull(),
    priority: integer('priority'),
    energy: text('energy'),
    do_date: text('do_date'),
    start_time: text('start_time'),
    end_time: text('end_time'),
    ...timestamps,
  },
  (t) => [index('tasks_slug_idx').on(t.slug), index('tasks_file_path_idx').on(t.file_path)],
);

export const resources = sqliteTable(
  'resources',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    file_path: text('file_path').notNull(),
    status: text('status').notNull(),
    resource_type: text('resource_type'),
    source_url: text('source_url'),
    pinned: integer('pinned', { mode: 'boolean' }),
    ...timestamps,
  },
  (t) => [
    index('resources_slug_idx').on(t.slug),
    index('resources_file_path_idx').on(t.file_path),
  ],
);

export const notes = sqliteTable(
  'notes',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    file_path: text('file_path').notNull(),
    status: text('status').notNull(),
    topic_summary: text('topic_summary'),
    pinned: integer('pinned', { mode: 'boolean' }),
    favorite: integer('favorite', { mode: 'boolean' }),
    notebook: text('notebook'),
    ...timestamps,
  },
  (t) => [index('notes_slug_idx').on(t.slug), index('notes_file_path_idx').on(t.file_path)],
);

export const inboxItems = sqliteTable(
  'inbox_items',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    file_path: text('file_path').notNull(),
    status: text('status').notNull(),
    raw_input: text('raw_input'),
    suggested_entity_type: text('suggested_entity_type'),
    processed_at: text('processed_at'),
    ...timestamps,
  },
  (t) => [
    index('inbox_items_slug_idx').on(t.slug),
    index('inbox_items_file_path_idx').on(t.file_path),
  ],
);

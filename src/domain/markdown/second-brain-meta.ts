import { z } from 'zod';

const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be kebab-case');

const keyResultSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1),
  done: z.boolean(),
  order: z.number().int(),
});

/** Root `second_brain` object stored in YAML front matter (rebuild-critical). */
export const secondBrainMetaSchema = z.object({
  id: z.uuid(),
  kind: z.enum([
    'inbox_item',
    'area',
    'goal',
    'project',
    'task',
    'resource',
    'note',
    'archive_record',
  ]),
  /** Bump when fields change; keep migrations in mind. */
  version: z.literal(1),
  slug: slugSchema,
  title: z.string().min(1),
  /** Workflow status (kind-specific vocabulary; PRD §10). */
  status: z.string().min(1),
  /** Distinct from workflow status — archive is a first-class transition (PRD). */
  archived: z.boolean(),

  captured_at: z.string().optional(),
  suggested_entity_type: z.string().optional(),
  processed_at: z.string().nullable().optional(),

  target_date: z.string().nullable().optional(),
  quarter: z.string().nullable().optional(),
  year: z.number().int().nullable().optional(),

  priority: z.number().nullable().optional(),
  due_date: z.string().nullable().optional(),
  energy: z.string().nullable().optional(),

  source_url: z.string().nullable().optional(),
  notebook: z.string().nullable().optional(),
  pinned: z.boolean().optional(),
  favorite: z.boolean().optional(),

  key_results: z.array(keyResultSchema).optional(),

  /** Outgoing typed edges mirrored into `entity_links` (PRD relationship model). */
  area_ids: z.array(z.uuid()).optional(),
  goal_ids: z.array(z.uuid()).optional(),
  project_ids: z.array(z.uuid()).optional(),
  task_ids: z.array(z.uuid()).optional(),
  resource_ids: z.array(z.uuid()).optional(),
  note_ids: z.array(z.uuid()).optional(),

  /** When archived, optional bookkeeping for restore/doctor. */
  archived_at: z.string().nullable().optional(),
  archive_reason: z.string().nullable().optional(),
});

export type SecondBrainMeta = z.infer<typeof secondBrainMetaSchema>;

/** Wrapper key in parsed YAML / serialized front matter. */
export const FRONTMATTER_ROOT_KEY = 'second_brain' as const;

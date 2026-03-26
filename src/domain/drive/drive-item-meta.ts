import { z } from 'zod';

const slugSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug must be kebab-case');

/** Root `drive_item` object in `item.md` front matter (PRD §8.2). */
export const driveItemMetaSchema = z.object({
  id: z.uuid(),
  version: z.literal(1),
  slug: slugSchema,
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  item_type: z.enum(['file', 'folder']),
  original_name: z.string().min(1),
  source_path: z.string().nullable().optional(),
  imported_at: z.string().min(1),
  mime_type: z.string().nullable().optional(),
  sha256: z.string().nullable().optional(),
  child_count: z.number().int().nullable().optional(),
  archived: z.boolean().optional(),
  archived_at: z.string().nullable().optional(),
  archive_reason: z.string().nullable().optional(),
  area_ids: z.array(z.uuid()).optional(),
  project_ids: z.array(z.uuid()).optional(),
  task_ids: z.array(z.uuid()).optional(),
  note_ids: z.array(z.uuid()).optional(),
  goal_ids: z.array(z.uuid()).optional(),
  tags: z.array(z.string()).optional(),
});

export type DriveItemMeta = z.infer<typeof driveItemMetaSchema>;

export const DRIVE_FRONTMATTER_ROOT_KEY = 'drive_item' as const;

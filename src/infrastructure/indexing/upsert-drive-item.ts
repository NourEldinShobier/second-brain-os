import { eq } from 'drizzle-orm';
import type { DriveItemMeta } from '../../domain/drive/drive-item-meta.js';
import type { SecondBrainDb } from '../db/open-database.js';
import * as schema from '../db/schema.js';

function jsonOrNull(v: readonly string[] | undefined): string | null {
  return v !== undefined && v.length > 0 ? JSON.stringify([...v]) : null;
}

export function upsertDriveItem(
  db: SecondBrainDb,
  meta: DriveItemMeta,
  relPath: string,
  createdAt: string,
  updatedAt: string,
): void {
  db.insert(schema.driveItems)
    .values({
      id: meta.id,
      slug: meta.slug,
      title: meta.title,
      file_path: relPath,
      item_type: meta.item_type,
      description: meta.description ?? null,
      original_name: meta.original_name,
      source_path: meta.source_path ?? null,
      imported_at: meta.imported_at,
      mime_type: meta.mime_type ?? null,
      sha256: meta.sha256 ?? null,
      child_count: meta.child_count ?? null,

      area_ids_json: jsonOrNull(meta.area_ids),
      project_ids_json: jsonOrNull(meta.project_ids),
      task_ids_json: jsonOrNull(meta.task_ids),
      note_ids_json: jsonOrNull(meta.note_ids),
      goal_ids_json: jsonOrNull(meta.goal_ids),
      tags_json: meta.tags !== undefined && meta.tags.length > 0 ? JSON.stringify([...meta.tags]) : null,
      created_at: createdAt,
      updated_at: updatedAt,
    })
    .onConflictDoUpdate({
      target: schema.driveItems.id,
      set: {
        slug: meta.slug,
        title: meta.title,
        file_path: relPath,
        item_type: meta.item_type,
        description: meta.description ?? null,
        original_name: meta.original_name,
        source_path: meta.source_path ?? null,
        imported_at: meta.imported_at,
        mime_type: meta.mime_type ?? null,
        sha256: meta.sha256 ?? null,
        child_count: meta.child_count ?? null,

        area_ids_json: jsonOrNull(meta.area_ids),
        project_ids_json: jsonOrNull(meta.project_ids),
        task_ids_json: jsonOrNull(meta.task_ids),
        note_ids_json: jsonOrNull(meta.note_ids),
        goal_ids_json: jsonOrNull(meta.goal_ids),
        tags_json: meta.tags !== undefined && meta.tags.length > 0 ? JSON.stringify([...meta.tags]) : null,
        updated_at: updatedAt,
      },
    })
    .run();
}

export function deleteDriveItemById(db: SecondBrainDb, id: string): void {
  db.delete(schema.driveItems).where(eq(schema.driveItems.id, id)).run();
}

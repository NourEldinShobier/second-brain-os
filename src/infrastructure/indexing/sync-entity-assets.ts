import { eq } from 'drizzle-orm';
import type { SecondBrainMeta } from '../../domain/markdown/second-brain-meta.js';
import type { SecondBrainDb } from '../db/open-database.js';
import * as schema from '../db/schema.js';

const ASSET_OWNER_KINDS = new Set<string>([
  'area',
  'goal',
  'project',
  'task',
  'resource',
  'note',
]);

/**
 * Replace SQLite rows for entity-owned assets from manifest. Call after upserting the owner entity row.
 */
export function replaceEntityAssetsForOwner(
  db: SecondBrainDb,
  meta: SecondBrainMeta,
  _relPath: string,
  createdAt: string,
  updatedAt: string,
): void {
  db.delete(schema.entityAssets).where(eq(schema.entityAssets.owner_entity_id, meta.id)).run();

  if (!ASSET_OWNER_KINDS.has(meta.kind)) {
    return;
  }

  const list = meta.assets ?? [];
  for (const a of list) {
    db.insert(schema.entityAssets)
      .values({
        id: a.id,
        owner_entity_id: meta.id,
        owner_entity_type: meta.kind,
        path_in_package: a.path,
        original_filename: a.original_filename,
        mime_type: a.mime_type,
        title: a.title ?? null,
        description: a.description ?? null,
        sha256: a.sha256 ?? null,
        imported_at: a.imported_at,
        created_at: createdAt,
        updated_at: updatedAt,
      })
      .run();
  }
}

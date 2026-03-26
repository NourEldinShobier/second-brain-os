import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { ReindexResult } from '../../domain/indexing/drift.js';
import type { DriftItem } from '../../domain/indexing/drift.js';
import { parseDriveItemDocument } from '../markdown/parse-drive-item.js';
import { parseMarkdownEntity } from '../markdown/parse-document.js';
import type { SecondBrainDb } from '../db/open-database.js';
import { isDriveItemMarkdownPath } from './drive-markdown-path.js';
import { listIndexedMarkdownPaths } from './list-markdown-files.js';
import { syncEntityLinksFromMeta } from './sync-entity-links.js';
import { upsertByKind } from './upsert-entity-row.js';
import { upsertDriveItem } from './upsert-drive-item.js';

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Scan canonical Markdown folders, parse `second_brain` front matter, and upsert SQLite rows.
 * Safe to run repeatedly (idempotent upserts).
 */
export async function reindexWorkspace(workspaceRoot: string, db: SecondBrainDb): Promise<ReindexResult> {
  const root = path.resolve(workspaceRoot);
  const paths = await listIndexedMarkdownPaths(root);
  const drift: DriftItem[] = [];
  const idToPaths = new Map<string, string[]>();
  const driveIdToPaths = new Map<string, string[]>();
  let indexed = 0;

  for (const rel of paths) {
    const abs = path.join(root, rel);
    let raw: string;
    try {
      raw = await readFile(abs, 'utf8');
    } catch (e) {
      drift.push({
        category: 'missing_file',
        path: rel,
        message: e instanceof Error ? e.message : String(e),
      });
      continue;
    }

    let st;
    try {
      st = await stat(abs);
    } catch {
      st = undefined;
    }
    const updatedAt = st ? st.mtime.toISOString() : nowIso();
    const createdAt = updatedAt;

    if (isDriveItemMarkdownPath(rel)) {
      const parsed = parseDriveItemDocument(raw);
      if (!parsed.ok) {
        drift.push({
          category: 'unreadable_frontmatter',
          path: rel,
          message: parsed.error,
        });
        continue;
      }
      const { meta } = parsed.value;
      const dlist = driveIdToPaths.get(meta.id) ?? [];
      dlist.push(rel);
      driveIdToPaths.set(meta.id, dlist);
      upsertDriveItem(db, meta, rel, createdAt, updatedAt);
      indexed += 1;
      continue;
    }

    const parsed = parseMarkdownEntity(raw);
    if (!parsed.ok) {
      drift.push({
        category: 'unreadable_frontmatter',
        path: rel,
        message: parsed.error,
      });
      continue;
    }

    const { meta } = parsed.value;
    const list = idToPaths.get(meta.id) ?? [];
    list.push(rel);
    idToPaths.set(meta.id, list);

    upsertByKind(
      db,
      meta,
      rel,
      createdAt,
      updatedAt,
      meta.kind === 'inbox_item' ? { body: parsed.value.body } : undefined,
    );
    syncEntityLinksFromMeta(db, meta, updatedAt);
    indexed += 1;
  }

  for (const [id, filePaths] of idToPaths) {
    if (filePaths.length > 1) {
      drift.push({
        category: 'duplicate_stable_id',
        id,
        message: `Stable id appears in ${String(filePaths.length)} files`,
        detail: { paths: filePaths },
      });
    }
  }

  for (const [id, filePaths] of driveIdToPaths) {
    if (filePaths.length > 1) {
      drift.push({
        category: 'duplicate_stable_id',
        id,
        message: `Drive item id appears in ${String(filePaths.length)} files`,
        detail: { paths: filePaths },
      });
    }
  }

  return { indexedFiles: indexed, drift };
}

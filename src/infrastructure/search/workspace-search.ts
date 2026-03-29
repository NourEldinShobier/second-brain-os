import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ListableEntityKind } from '../../domain/listable-kind.js';
import { isDriveItemMarkdownPath } from '../indexing/drive-markdown-path.js';
import { listIndexedMarkdownPaths } from '../indexing/list-markdown-files.js';
import { parseDriveItemDocument } from '../markdown/parse-drive-item.js';
import { parseMarkdownEntity } from '../markdown/parse-document.js';
import type { SecondBrainDb } from '../db/open-database.js';
import { listBacklinks, listForwardLinks } from '../relationships/entity-link-queries.js';

/** Entity rows or vault drive packages (`item.md`). */
export type SearchHitKind = ListableEntityKind | 'drive_item';

export interface SearchHit {
  readonly kind: SearchHitKind;
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly file_path: string;
  readonly match: 'title' | 'body' | 'both' | 'description';
}

export async function searchWorkspaceMarkdown(
  workspaceRoot: string,
  q: string,
  limit: number,
): Promise<SearchHit[]> {
  const ql = q.trim().toLowerCase();
  if (ql.length === 0) {
    return [];
  }
  const cap = Math.min(Math.max(limit, 1), 200);
  const paths = await listIndexedMarkdownPaths(workspaceRoot);
  const hits: SearchHit[] = [];
  const seen = new Set<string>();

  for (const rel of paths) {
    if (hits.length >= cap) {
      break;
    }
    let raw: string;
    try {
      raw = await readFile(path.join(workspaceRoot, rel), 'utf8');
    } catch {
      continue;
    }
    const p = parseMarkdownEntity(raw);
    if (!p.ok) {
      if (isDriveItemMarkdownPath(rel)) {
        const d = parseDriveItemDocument(raw);
        if (!d.ok) {
          continue;
        }
        const meta = d.value.meta;
        const titleHit = meta.title.toLowerCase().includes(ql);
        const bodyHit = d.value.body.toLowerCase().includes(ql);
        const descHit = (meta.description ?? '').toLowerCase().includes(ql);
        if (!titleHit && !bodyHit && !descHit) {
          continue;
        }
        let match: SearchHit['match'];
        if (descHit && !titleHit && !bodyHit) {
          match = 'description';
        } else if (titleHit && bodyHit) {
          match = 'both';
        } else if (titleHit) {
          match = 'title';
        } else {
          match = 'body';
        }
        const key = `drive_item:${meta.id}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        hits.push({
          kind: 'drive_item',
          id: meta.id,
          slug: meta.slug,
          title: meta.title,
          file_path: rel,
          match,
        });
      }
      continue;
    }
    const kind = p.value.meta.kind;
    if (kind === 'archive_record') {
      continue;
    }
    const k = kind as ListableEntityKind;
    const titleHit = p.value.meta.title.toLowerCase().includes(ql);
    const bodyHit = p.value.body.toLowerCase().includes(ql);
    if (!titleHit && !bodyHit) {
      continue;
    }
    let match: SearchHit['match'];
    if (titleHit && bodyHit) {
      match = 'both';
    } else if (titleHit) {
      match = 'title';
    } else {
      match = 'body';
    }
    const key = `${k}:${p.value.meta.id}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    hits.push({
      kind: k,
      id: p.value.meta.id,
      slug: p.value.meta.slug,
      title: p.value.meta.title,
      file_path: rel,
      match,
    });
  }
  return hits;
}

export interface ExpandedLinkRow {
  readonly from_entity_id: string;
  readonly from_kind: string;
  readonly direction: 'forward' | 'backlink';
  readonly to_entity_id: string;
  readonly to_kind: string;
}

/** Relationship expansion for search hits (for `--expand`). */
export function expandSearchHitsWithLinks(db: SecondBrainDb, hits: readonly SearchHit[]): ExpandedLinkRow[] {
  const rows: ExpandedLinkRow[] = [];
  for (const h of hits) {
    if (h.kind === 'drive_item') {
      continue;
    }
    const entityKind = h.kind;
    for (const e of listForwardLinks(db, entityKind, h.id)) {
      rows.push({
        from_entity_id: h.id,
        from_kind: entityKind,
        direction: 'forward',
        to_entity_id: e.toEntityId,
        to_kind: e.toEntityType,
      });
    }
    for (const e of listBacklinks(db, entityKind, h.id)) {
      rows.push({
        from_entity_id: e.fromEntityId,
        from_kind: e.fromEntityType,
        direction: 'backlink',
        to_entity_id: h.id,
        to_kind: entityKind,
      });
    }
  }
  return rows;
}

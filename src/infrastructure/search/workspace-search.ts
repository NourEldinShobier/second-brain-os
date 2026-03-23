import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { ListableEntityKind } from '../../domain/listable-kind.js';
import { listIndexedMarkdownPaths } from '../indexing/list-markdown-files.js';
import { parseMarkdownEntity } from '../markdown/parse-document.js';
import type { SecondBrainDb } from '../db/open-database.js';
import { listBacklinks, listForwardLinks } from '../relationships/entity-link-queries.js';

export interface SearchHit {
  readonly kind: ListableEntityKind;
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly file_path: string;
  readonly match: 'title' | 'body' | 'both';
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
    const lower = raw.toLowerCase();
    if (!lower.includes(ql)) {
      continue;
    }
    const p = parseMarkdownEntity(raw);
    if (!p.ok) {
      continue;
    }
    const kind = p.value.meta.kind;
    if (kind === 'archive_record') {
      continue;
    }
    const k = kind as ListableEntityKind;
    const titleHit = p.value.meta.title.toLowerCase().includes(ql);
    const bodyHit = p.value.body.toLowerCase().includes(ql);
    const match: SearchHit['match'] = titleHit && bodyHit ? 'both' : titleHit ? 'title' : 'body';
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
    for (const e of listForwardLinks(db, h.kind, h.id)) {
      rows.push({
        from_entity_id: h.id,
        from_kind: h.kind,
        direction: 'forward',
        to_entity_id: e.toEntityId,
        to_kind: e.toEntityType,
      });
    }
    for (const e of listBacklinks(db, h.kind, h.id)) {
      rows.push({
        from_entity_id: e.fromEntityId,
        from_kind: e.fromEntityType,
        direction: 'backlink',
        to_entity_id: h.id,
        to_kind: h.kind,
      });
    }
  }
  return rows;
}

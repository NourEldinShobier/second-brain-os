import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { SecondBrainMeta } from '../../domain/markdown/second-brain-meta.js';
import type { SecondBrainDb } from '../db/open-database.js';
import * as schema from '../db/schema.js';

export interface OutgoingEdge {
  readonly toKind: string;
  readonly toId: string;
  readonly linkKind: string;
}

export function replaceOutgoingLinks(
  db: SecondBrainDb,
  fromKind: string,
  fromId: string,
  edges: readonly OutgoingEdge[],
  createdAt: string,
): void {
  db.delete(schema.entityLinks)
    .where(
      and(eq(schema.entityLinks.from_entity_type, fromKind), eq(schema.entityLinks.from_entity_id, fromId)),
    )
    .run();
  for (const e of edges) {
    db.insert(schema.entityLinks)
      .values({
        id: randomUUID(),
        from_entity_type: fromKind,
        from_entity_id: fromId,
        to_entity_type: e.toKind,
        to_entity_id: e.toId,
        link_kind: e.linkKind,
        created_at: createdAt,
        created_by: null,
      })
      .run();
  }
}

function pushEdges(
  edges: OutgoingEdge[],
  toKind: string,
  ids: readonly string[] | undefined,
  linkKind: string,
): void {
  if (ids === undefined) {
    return;
  }
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    edges.push({ toKind, toId: id, linkKind });
  }
}

/** Sync `entity_links` rows from optional `*_ids` arrays on front matter. */
export function syncEntityLinksFromMeta(db: SecondBrainDb, meta: SecondBrainMeta, createdAt?: string): void {
  if (meta.kind === 'archive_record') {
    return;
  }
  const at = createdAt ?? new Date().toISOString();
  const edges: OutgoingEdge[] = [];
  pushEdges(edges, 'area', meta.area_ids, 'area');
  pushEdges(edges, 'goal', meta.goal_ids, 'goal');
  pushEdges(edges, 'project', meta.project_ids, 'project');
  pushEdges(edges, 'task', meta.task_ids, 'task');
  pushEdges(edges, 'resource', meta.resource_ids, 'resource');
  pushEdges(edges, 'note', meta.note_ids, 'note');
  replaceOutgoingLinks(db, meta.kind, meta.id, edges, at);
}

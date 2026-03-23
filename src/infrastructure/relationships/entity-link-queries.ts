import { and, eq } from 'drizzle-orm';
import type { SecondBrainDb } from '../db/open-database.js';
import * as schema from '../db/schema.js';

export interface EntityLinkRow {
  readonly id: string;
  readonly fromEntityType: string;
  readonly fromEntityId: string;
  readonly toEntityType: string;
  readonly toEntityId: string;
  readonly linkKind: string;
}

function mapRow(r: typeof schema.entityLinks.$inferSelect): EntityLinkRow {
  return {
    id: r.id,
    fromEntityType: r.from_entity_type,
    fromEntityId: r.from_entity_id,
    toEntityType: r.to_entity_type,
    toEntityId: r.to_entity_id,
    linkKind: r.link_kind,
  };
}

/** Outgoing edges from an entity (matches `entity_links` rows). */
export function listForwardLinks(db: SecondBrainDb, fromKind: string, fromId: string): EntityLinkRow[] {
  return db
    .select()
    .from(schema.entityLinks)
    .where(
      and(eq(schema.entityLinks.from_entity_type, fromKind), eq(schema.entityLinks.from_entity_id, fromId)),
    )
    .all()
    .map(mapRow);
}

/** Incoming edges pointing at an entity (backlinks). */
export function listBacklinks(db: SecondBrainDb, toKind: string, toId: string): EntityLinkRow[] {
  return db
    .select()
    .from(schema.entityLinks)
    .where(and(eq(schema.entityLinks.to_entity_type, toKind), eq(schema.entityLinks.to_entity_id, toId)))
    .all()
    .map(mapRow);
}

import { and, eq, or } from 'drizzle-orm';
import type { ListableEntityKind } from '../../domain/listable-kind.js';
import type { SecondBrainDb } from '../db/open-database.js';
import * as schema from '../db/schema.js';

function deleteEntityAssetsForOwner(db: SecondBrainDb, entityId: string): void {
  db.delete(schema.entityAssets).where(eq(schema.entityAssets.owner_entity_id, entityId)).run();
}

/** Remove all `entity_links` rows touching this entity (as source or target). */
export function deleteEntityLinksForEntity(db: SecondBrainDb, kind: string, entityId: string): void {
  db.delete(schema.entityLinks)
    .where(
      or(
        and(eq(schema.entityLinks.from_entity_type, kind), eq(schema.entityLinks.from_entity_id, entityId)),
        and(eq(schema.entityLinks.to_entity_type, kind), eq(schema.entityLinks.to_entity_id, entityId)),
      ),
    )
    .run();
}

/** Delete the SQLite row for a core entity (does not touch Markdown or entity_links). */
export function deleteEntityIndexRow(db: SecondBrainDb, kind: ListableEntityKind, entityId: string): void {
  deleteEntityAssetsForOwner(db, entityId);
  switch (kind) {
    case 'area':
      db.delete(schema.areas).where(eq(schema.areas.id, entityId)).run();
      break;
    case 'goal':
      db.delete(schema.goalKeyResults).where(eq(schema.goalKeyResults.goal_id, entityId)).run();
      db.delete(schema.goals).where(eq(schema.goals.id, entityId)).run();
      break;
    case 'project':
      db.delete(schema.projects).where(eq(schema.projects.id, entityId)).run();
      break;
    case 'task':
      db.delete(schema.tasks).where(eq(schema.tasks.id, entityId)).run();
      break;
    case 'resource':
      db.delete(schema.resources).where(eq(schema.resources.id, entityId)).run();
      break;
    case 'note':
      db.delete(schema.notes).where(eq(schema.notes.id, entityId)).run();
      break;
    case 'inbox_item':
      db.delete(schema.inboxItems).where(eq(schema.inboxItems.id, entityId)).run();
      break;
  }
}

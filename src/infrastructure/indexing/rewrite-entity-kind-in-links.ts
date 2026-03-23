import { and, eq } from 'drizzle-orm';
import type { SecondBrainDb } from '../db/open-database.js';
import * as schema from '../db/schema.js';

/** Update `entity_links` when an entity's kind changes but stable `id` is preserved. */
export function rewriteEntityKindInLinks(
  db: SecondBrainDb,
  entityId: string,
  oldKind: string,
  newKind: string,
): void {
  db.update(schema.entityLinks)
    .set({ from_entity_type: newKind })
    .where(
      and(eq(schema.entityLinks.from_entity_id, entityId), eq(schema.entityLinks.from_entity_type, oldKind)),
    )
    .run();
  db.update(schema.entityLinks)
    .set({ to_entity_type: newKind })
    .where(and(eq(schema.entityLinks.to_entity_id, entityId), eq(schema.entityLinks.to_entity_type, oldKind)))
    .run();
}

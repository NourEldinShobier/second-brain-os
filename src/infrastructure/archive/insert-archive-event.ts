import { randomUUID } from 'node:crypto';
import type { SecondBrainDb } from '../db/open-database.js';
import * as schema from '../db/schema.js';

export function insertArchiveEvent(
  db: SecondBrainDb,
  input: {
    readonly entityType: string;
    readonly entityId: string;
    readonly previousPath: string | null;
    readonly newPath: string | null;
    readonly reason?: string | null;
  },
): void {
  const now = new Date().toISOString();
  db.insert(schema.archiveEvents)
    .values({
      id: randomUUID(),
      entity_type: input.entityType,
      entity_id: input.entityId,
      occurred_at: now,
      reason: input.reason ?? null,
      previous_path: input.previousPath,
      new_path: input.newPath,
      created_at: now,
    })
    .run();
}

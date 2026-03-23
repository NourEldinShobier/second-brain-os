import { eq } from 'drizzle-orm';
import type { SecondBrainMeta } from '../../domain/markdown/second-brain-meta.js';
import type { SecondBrainDb } from '../db/open-database.js';
import * as schema from '../db/schema.js';

export function getCoreEntityCreatedAt(
  db: SecondBrainDb,
  kind: SecondBrainMeta['kind'],
  id: string,
): string | undefined {
  switch (kind) {
    case 'area':
      return db.select({ c: schema.areas.created_at }).from(schema.areas).where(eq(schema.areas.id, id)).get()?.c;
    case 'goal':
      return db.select({ c: schema.goals.created_at }).from(schema.goals).where(eq(schema.goals.id, id)).get()?.c;
    case 'project':
      return db.select({ c: schema.projects.created_at }).from(schema.projects).where(eq(schema.projects.id, id)).get()?.c;
    case 'task':
      return db.select({ c: schema.tasks.created_at }).from(schema.tasks).where(eq(schema.tasks.id, id)).get()?.c;
    case 'resource':
      return db.select({ c: schema.resources.created_at }).from(schema.resources).where(eq(schema.resources.id, id)).get()?.c;
    case 'note':
      return db.select({ c: schema.notes.created_at }).from(schema.notes).where(eq(schema.notes.id, id)).get()?.c;
    case 'inbox_item':
      return db.select({ c: schema.inboxItems.created_at }).from(schema.inboxItems).where(eq(schema.inboxItems.id, id)).get()?.c;
    case 'archive_record':
      return undefined;
  }
}

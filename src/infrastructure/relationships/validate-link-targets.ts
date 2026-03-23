import { eq } from 'drizzle-orm';
import type { SecondBrainMeta } from '../../domain/markdown/second-brain-meta.js';
import type { Result } from '../../domain/result.js';
import { err, ok } from '../../domain/result.js';
import type { SecondBrainDb } from '../db/open-database.js';
import * as schema from '../db/schema.js';

type LinkTargetKind = 'area' | 'goal' | 'project' | 'task' | 'resource' | 'note';

function rowExists(db: SecondBrainDb, kind: LinkTargetKind, id: string): boolean {
  switch (kind) {
    case 'area':
      return db.select().from(schema.areas).where(eq(schema.areas.id, id)).get() !== undefined;
    case 'goal':
      return db.select().from(schema.goals).where(eq(schema.goals.id, id)).get() !== undefined;
    case 'project':
      return db.select().from(schema.projects).where(eq(schema.projects.id, id)).get() !== undefined;
    case 'task':
      return db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).get() !== undefined;
    case 'resource':
      return db.select().from(schema.resources).where(eq(schema.resources.id, id)).get() !== undefined;
    case 'note':
      return db.select().from(schema.notes).where(eq(schema.notes.id, id)).get() !== undefined;
  }
}

/** Ensure every referenced id exists in the indexed table for its kind. */
export function validateLinkTargetsExist(db: SecondBrainDb, meta: SecondBrainMeta): Result<true, string> {
  const pairs: { readonly kind: LinkTargetKind; readonly id: string }[] = [];
  for (const id of meta.area_ids ?? []) {
    pairs.push({ kind: 'area', id });
  }
  for (const id of meta.goal_ids ?? []) {
    pairs.push({ kind: 'goal', id });
  }
  for (const id of meta.project_ids ?? []) {
    pairs.push({ kind: 'project', id });
  }
  for (const id of meta.task_ids ?? []) {
    pairs.push({ kind: 'task', id });
  }
  for (const id of meta.resource_ids ?? []) {
    pairs.push({ kind: 'resource', id });
  }
  for (const id of meta.note_ids ?? []) {
    pairs.push({ kind: 'note', id });
  }
  for (const { kind, id } of pairs) {
    if (!rowExists(db, kind, id)) {
      return err(`Unknown ${kind} id: ${id}`);
    }
  }
  return ok(true);
}

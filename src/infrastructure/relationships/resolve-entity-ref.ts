import { eq } from 'drizzle-orm';
import type { Result } from '../../domain/result.js';
import { err, ok } from '../../domain/result.js';
import type { SecondBrainDb } from '../db/open-database.js';
import * as schema from '../db/schema.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function isUuid(s: string): boolean {
  return UUID_RE.test(s.trim());
}

export function resolveAreaId(db: SecondBrainDb, ref: string): Result<string, string> {
  const r = ref.trim();
  if (r.length === 0) {
    return err('Empty area reference');
  }
  if (isUuid(r)) {
    const row = db.select().from(schema.areas).where(eq(schema.areas.id, r)).get();
    if (row === undefined) {
      return err(`Unknown area id: ${r}`);
    }
    return ok(r);
  }
  const row = db.select().from(schema.areas).where(eq(schema.areas.slug, r)).get();
  if (row === undefined) {
    return err(`Unknown area slug: ${r}`);
  }
  return ok(row.id);
}

export function resolveProjectId(db: SecondBrainDb, ref: string): Result<string, string> {
  const r = ref.trim();
  if (r.length === 0) {
    return err('Empty project reference');
  }
  if (isUuid(r)) {
    const row = db.select().from(schema.projects).where(eq(schema.projects.id, r)).get();
    if (row === undefined) {
      return err(`Unknown project id: ${r}`);
    }
    return ok(r);
  }
  const row = db.select().from(schema.projects).where(eq(schema.projects.slug, r)).get();
  if (row === undefined) {
    return err(`Unknown project slug: ${r}`);
  }
  return ok(row.id);
}

export function resolveAreaIds(db: SecondBrainDb, refs: readonly string[]): Result<readonly string[], string> {
  const ids: string[] = [];
  for (const ref of refs) {
    const r = resolveAreaId(db, ref);
    if (!r.ok) {
      return r;
    }
    ids.push(r.value);
  }
  return ok(ids);
}

export function resolveProjectIds(db: SecondBrainDb, refs: readonly string[]): Result<readonly string[], string> {
  const ids: string[] = [];
  for (const ref of refs) {
    const r = resolveProjectId(db, ref);
    if (!r.ok) {
      return r;
    }
    ids.push(r.value);
  }
  return ok(ids);
}

export function resolveTaskId(db: SecondBrainDb, ref: string): Result<string, string> {
  const r = ref.trim();
  if (r.length === 0) {
    return err('Empty task reference');
  }
  if (isUuid(r)) {
    const row = db.select().from(schema.tasks).where(eq(schema.tasks.id, r)).get();
    if (row === undefined) {
      return err(`Unknown task id: ${r}`);
    }
    return ok(r);
  }
  const row = db.select().from(schema.tasks).where(eq(schema.tasks.slug, r)).get();
  if (row === undefined) {
    return err(`Unknown task slug: ${r}`);
  }
  return ok(row.id);
}

export function resolveNoteId(db: SecondBrainDb, ref: string): Result<string, string> {
  const r = ref.trim();
  if (r.length === 0) {
    return err('Empty note reference');
  }
  if (isUuid(r)) {
    const row = db.select().from(schema.notes).where(eq(schema.notes.id, r)).get();
    if (row === undefined) {
      return err(`Unknown note id: ${r}`);
    }
    return ok(r);
  }
  const row = db.select().from(schema.notes).where(eq(schema.notes.slug, r)).get();
  if (row === undefined) {
    return err(`Unknown note slug: ${r}`);
  }
  return ok(row.id);
}

export function resolveGoalId(db: SecondBrainDb, ref: string): Result<string, string> {
  const r = ref.trim();
  if (r.length === 0) {
    return err('Empty goal reference');
  }
  if (isUuid(r)) {
    const row = db.select().from(schema.goals).where(eq(schema.goals.id, r)).get();
    if (row === undefined) {
      return err(`Unknown goal id: ${r}`);
    }
    return ok(r);
  }
  const row = db.select().from(schema.goals).where(eq(schema.goals.slug, r)).get();
  if (row === undefined) {
    return err(`Unknown goal slug: ${r}`);
  }
  return ok(row.id);
}

export type DriveLinkableKind = 'area' | 'project' | 'task' | 'note' | 'goal';

/** Resolve a slug or id for drive item links; rejects archived entities. */
export function resolveDriveLinkTargetRef(
  db: SecondBrainDb,
  kind: DriveLinkableKind,
  ref: string,
): Result<string, string> {
  const idResult =
    kind === 'area'
      ? resolveAreaId(db, ref)
      : kind === 'project'
        ? resolveProjectId(db, ref)
        : kind === 'task'
          ? resolveTaskId(db, ref)
          : kind === 'note'
            ? resolveNoteId(db, ref)
            : resolveGoalId(db, ref);
  if (!idResult.ok) {
    return idResult;
  }
  const id = idResult.value;

  return ok(id);
}

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

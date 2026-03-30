import { and, eq } from 'drizzle-orm';
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

export function resolveAreaIds(
  db: SecondBrainDb,
  refs: readonly string[],
): Result<readonly string[], string> {
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

export function resolveProjectIds(
  db: SecondBrainDb,
  refs: readonly string[],
): Result<readonly string[], string> {
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

export type CoreEntityKind = 'area' | 'project' | 'task' | 'note' | 'goal';

export interface EntityReference {
  readonly type: CoreEntityKind;
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly status: string | null;
  readonly filePath: string;
}

export function resolveEntityByRef(
  db: SecondBrainDb,
  entityType: CoreEntityKind,
  ref: string,
): Result<EntityReference, string> {
  const r = ref.trim();
  if (r.length === 0) {
    return err('Empty entity reference');
  }

  if (entityType === 'area') {
    const row = isUuid(r)
      ? db.select().from(schema.areas).where(eq(schema.areas.id, r)).get()
      : db.select().from(schema.areas).where(eq(schema.areas.slug, r)).get();
    if (row === undefined) {
      return err(`Area not found: ${r}`);
    }
    return ok({
      type: 'area',
      id: row.id,
      slug: row.slug,
      title: row.title,
      status: row.status,
      filePath: row.file_path,
    });
  }

  if (entityType === 'project') {
    const row = isUuid(r)
      ? db.select().from(schema.projects).where(eq(schema.projects.id, r)).get()
      : db.select().from(schema.projects).where(eq(schema.projects.slug, r)).get();
    if (row === undefined) {
      return err(`Project not found: ${r}`);
    }
    return ok({
      type: 'project',
      id: row.id,
      slug: row.slug,
      title: row.title,
      status: row.status,
      filePath: row.file_path,
    });
  }

  if (entityType === 'task') {
    const row = isUuid(r)
      ? db.select().from(schema.tasks).where(eq(schema.tasks.id, r)).get()
      : db.select().from(schema.tasks).where(eq(schema.tasks.slug, r)).get();
    if (row === undefined) {
      return err(`Task not found: ${r}`);
    }
    return ok({
      type: 'task',
      id: row.id,
      slug: row.slug,
      title: row.title,
      status: row.status,
      filePath: row.file_path,
    });
  }

  if (entityType === 'note') {
    const row = isUuid(r)
      ? db.select().from(schema.notes).where(eq(schema.notes.id, r)).get()
      : db.select().from(schema.notes).where(eq(schema.notes.slug, r)).get();
    if (row === undefined) {
      return err(`Note not found: ${r}`);
    }
    return ok({
      type: 'note',
      id: row.id,
      slug: row.slug,
      title: row.title,
      status: row.status,
      filePath: row.file_path,
    });
  }

  if (entityType === 'goal') {
    const row = isUuid(r)
      ? db.select().from(schema.goals).where(eq(schema.goals.id, r)).get()
      : db.select().from(schema.goals).where(eq(schema.goals.slug, r)).get();
    if (row === undefined) {
      return err(`Goal not found: ${r}`);
    }
    return ok({
      type: 'goal',
      id: row.id,
      slug: row.slug,
      title: row.title,
      status: row.status,
      filePath: row.file_path,
    });
  }

  return err(`Invalid entity type: ${entityType}`);
}

export function countEntityChildren(
  db: SecondBrainDb,
  entityType: CoreEntityKind,
  entityId: string,
): { goals: number; projects: number; tasks: number } {
  let goals = 0;
  let projects = 0;
  let tasks = 0;

  if (entityType === 'area') {
    const projectRows = db
      .select()
      .from(schema.entityLinks)
      .where(
        and(
          eq(schema.entityLinks.to_entity_type, 'area'),
          eq(schema.entityLinks.to_entity_id, entityId),
          eq(schema.entityLinks.from_entity_type, 'project'),
        ),
      )
      .all();
    projects = projectRows.length;

    const goalRows = db
      .select()
      .from(schema.entityLinks)
      .where(
        and(
          eq(schema.entityLinks.to_entity_type, 'area'),
          eq(schema.entityLinks.to_entity_id, entityId),
          eq(schema.entityLinks.from_entity_type, 'goal'),
        ),
      )
      .all();
    goals = goalRows.length;
  }

  if (entityType === 'project') {
    const taskRows = db
      .select()
      .from(schema.entityLinks)
      .where(
        and(
          eq(schema.entityLinks.to_entity_type, 'project'),
          eq(schema.entityLinks.to_entity_id, entityId),
          eq(schema.entityLinks.from_entity_type, 'task'),
        ),
      )
      .all();
    tasks = taskRows.length;
  }

  if (entityType === 'goal') {
    const taskRows = db
      .select()
      .from(schema.entityLinks)
      .where(
        and(
          eq(schema.entityLinks.to_entity_type, 'goal'),
          eq(schema.entityLinks.to_entity_id, entityId),
          eq(schema.entityLinks.from_entity_type, 'task'),
        ),
      )
      .all();
    tasks = taskRows.length;
  }

  return { goals, projects, tasks };
}

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

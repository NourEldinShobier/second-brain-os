import { and, eq } from 'drizzle-orm';
import type { Result } from '../domain/result.js';
import { err, ok } from '../domain/result.js';
import type { SecondBrainDb } from '../infrastructure/db/open-database.js';
import * as schema from '../infrastructure/db/schema.js';
import {
  DRIVE_AREAS_FOLDER,
  DRIVE_INBOX_FOLDER,
  DRIVE_PROJECTS_FOLDER,
  DRIVE_ITEMS_ROOT,
} from '../infrastructure/workspace/canonical-layout.js';

export interface ParentEntity {
  type: 'area' | 'project';
  id: string;
  slug: string;
  title: string;
}

export interface SourceEntity {
  type: 'task' | 'note' | 'goal';
  id: string;
  slug: string;
  title: string;
}

export interface ParentResolution {
  entity: SourceEntity;
  parent: ParentEntity | null;
  suggestedPath: string;
  suggestionReason: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function isUuid(s: string): boolean {
  return UUID_RE.test(s.trim());
}

function findTaskByRef(
  db: SecondBrainDb,
  ref: string,
): typeof schema.tasks.$inferSelect | undefined {
  const r = ref.trim();
  if (isUuid(r)) {
    return db.select().from(schema.tasks).where(eq(schema.tasks.id, r)).get();
  }
  return db.select().from(schema.tasks).where(eq(schema.tasks.slug, r)).get();
}

function findNoteByRef(
  db: SecondBrainDb,
  ref: string,
): typeof schema.notes.$inferSelect | undefined {
  const r = ref.trim();
  if (isUuid(r)) {
    return db.select().from(schema.notes).where(eq(schema.notes.id, r)).get();
  }
  return db.select().from(schema.notes).where(eq(schema.notes.slug, r)).get();
}

function findGoalByRef(
  db: SecondBrainDb,
  ref: string,
): typeof schema.goals.$inferSelect | undefined {
  const r = ref.trim();
  if (isUuid(r)) {
    return db.select().from(schema.goals).where(eq(schema.goals.id, r)).get();
  }
  return db.select().from(schema.goals).where(eq(schema.goals.slug, r)).get();
}

function findProjectById(
  db: SecondBrainDb,
  id: string,
): typeof schema.projects.$inferSelect | undefined {
  return db.select().from(schema.projects).where(eq(schema.projects.id, id)).get();
}

function findAreaById(db: SecondBrainDb, id: string): typeof schema.areas.$inferSelect | undefined {
  return db.select().from(schema.areas).where(eq(schema.areas.id, id)).get();
}

function getLinkedEntityIds(
  db: SecondBrainDb,
  fromKind: string,
  fromId: string,
  toKind: 'area' | 'project' | 'task' | 'note' | 'goal' | 'resource',
): string[] {
  const rows = db
    .select()
    .from(schema.entityLinks)
    .where(
      and(
        eq(schema.entityLinks.from_entity_type, fromKind),
        eq(schema.entityLinks.from_entity_id, fromId),
        eq(schema.entityLinks.to_entity_type, toKind),
      ),
    )
    .all();
  return rows.map((r) => r.to_entity_id);
}

function toSourceEntity(
  type: 'task' | 'note' | 'goal',
  row: { id: string; slug: string; title: string },
): SourceEntity {
  return { type, id: row.id, slug: row.slug, title: row.title };
}

function toParentEntity(
  type: 'area' | 'project',
  row: { id: string; slug: string; title: string },
): ParentEntity {
  return { type, id: row.id, slug: row.slug, title: row.title };
}

function buildSuggestedPath(
  parentType: 'area' | 'project' | null,
  parentSlug: string | null,
): string {
  if (!parentType || !parentSlug) {
    return `${DRIVE_ITEMS_ROOT}/${DRIVE_INBOX_FOLDER}`;
  }
  if (parentType === 'area') {
    return `${DRIVE_ITEMS_ROOT}/${DRIVE_AREAS_FOLDER}/${parentSlug}`;
  }
  return `${DRIVE_ITEMS_ROOT}/${DRIVE_PROJECTS_FOLDER}/${parentSlug}`;
}

export function resolveEntityParent(
  db: SecondBrainDb,
  entityType: 'task' | 'note' | 'goal',
  entityRef: string,
): Result<ParentResolution, string> {
  switch (entityType) {
    case 'task':
      return resolveTaskParent(db, entityRef);
    case 'note':
      return resolveNoteParent(db, entityRef);
    case 'goal':
      return resolveGoalParent(db, entityRef);
    default: {
      const _exhaustive: never = entityType;
      return err(`Invalid entity type: ${_exhaustive}`);
    }
  }
}

export function resolveTaskParent(
  db: SecondBrainDb,
  taskRef: string,
): Result<ParentResolution, string> {
  const task = findTaskByRef(db, taskRef);
  if (!task) {
    return err(`Task not found: ${taskRef}`);
  }

  const source = toSourceEntity('task', task);

  const projectIds = getLinkedEntityIds(db, 'task', task.id, 'project');
  const areaIds = getLinkedEntityIds(db, 'task', task.id, 'area');

  const firstProjectId = projectIds.length > 0 ? projectIds[0] : undefined;
  if (firstProjectId) {
    const project = findProjectById(db, firstProjectId);
    if (project) {
      const projectAreaIds = getLinkedEntityIds(db, 'project', project.id, 'area');
      const projectAreaId = projectAreaIds.length > 0 ? projectAreaIds[0] : undefined;
      if (projectAreaId) {
        const area = findAreaById(db, projectAreaId);
        if (area) {
          return ok({
            entity: source,
            parent: toParentEntity('area', area),
            suggestedPath: buildSuggestedPath('area', area.slug),
            suggestionReason: `Task links to project '${project.slug}' which links to area '${area.slug}'`,
          });
        }
      }
      return ok({
        entity: source,
        parent: toParentEntity('project', project),
        suggestedPath: buildSuggestedPath('project', project.slug),
        suggestionReason: `Task links to project '${project.slug}' (no area)`,
      });
    }
  }

  const firstAreaId = areaIds.length > 0 ? areaIds[0] : undefined;
  if (firstAreaId) {
    const area = findAreaById(db, firstAreaId);
    if (area) {
      return ok({
        entity: source,
        parent: toParentEntity('area', area),
        suggestedPath: buildSuggestedPath('area', area.slug),
        suggestionReason: `Task links directly to area '${area.slug}'`,
      });
    }
  }

  return ok({
    entity: source,
    parent: null,
    suggestedPath: buildSuggestedPath(null, null),
    suggestionReason: 'Task has no linked project or area',
  });
}

export function resolveNoteParent(
  db: SecondBrainDb,
  noteRef: string,
): Result<ParentResolution, string> {
  const note = findNoteByRef(db, noteRef);
  if (!note) {
    return err(`Note not found: ${noteRef}`);
  }

  const source = toSourceEntity('note', note);

  const projectIds = getLinkedEntityIds(db, 'note', note.id, 'project');
  const areaIds = getLinkedEntityIds(db, 'note', note.id, 'area');

  const firstProjectId = projectIds.length > 0 ? projectIds[0] : undefined;
  if (firstProjectId) {
    const project = findProjectById(db, firstProjectId);
    if (project) {
      const projectAreaIds = getLinkedEntityIds(db, 'project', project.id, 'area');
      const projectAreaId = projectAreaIds.length > 0 ? projectAreaIds[0] : undefined;
      if (projectAreaId) {
        const area = findAreaById(db, projectAreaId);
        if (area) {
          return ok({
            entity: source,
            parent: toParentEntity('area', area),
            suggestedPath: buildSuggestedPath('area', area.slug),
            suggestionReason: `Note links to project '${project.slug}' which links to area '${area.slug}'`,
          });
        }
      }
      return ok({
        entity: source,
        parent: toParentEntity('project', project),
        suggestedPath: buildSuggestedPath('project', project.slug),
        suggestionReason: `Note links to project '${project.slug}' (no area)`,
      });
    }
  }

  const firstAreaId = areaIds.length > 0 ? areaIds[0] : undefined;
  if (firstAreaId) {
    const area = findAreaById(db, firstAreaId);
    if (area) {
      return ok({
        entity: source,
        parent: toParentEntity('area', area),
        suggestedPath: buildSuggestedPath('area', area.slug),
        suggestionReason: `Note links directly to area '${area.slug}'`,
      });
    }
  }

  return ok({
    entity: source,
    parent: null,
    suggestedPath: buildSuggestedPath(null, null),
    suggestionReason: 'Note has no linked project or area',
  });
}

export function resolveGoalParent(
  db: SecondBrainDb,
  goalRef: string,
): Result<ParentResolution, string> {
  const goal = findGoalByRef(db, goalRef);
  if (!goal) {
    return err(`Goal not found: ${goalRef}`);
  }

  const source = toSourceEntity('goal', goal);

  const areaIds = getLinkedEntityIds(db, 'goal', goal.id, 'area');

  const firstAreaId = areaIds.length > 0 ? areaIds[0] : undefined;
  if (firstAreaId) {
    const area = findAreaById(db, firstAreaId);
    if (area) {
      return ok({
        entity: source,
        parent: toParentEntity('area', area),
        suggestedPath: buildSuggestedPath('area', area.slug),
        suggestionReason: `Goal links to area '${area.slug}'`,
      });
    }
  }

  return ok({
    entity: source,
    parent: null,
    suggestedPath: buildSuggestedPath(null, null),
    suggestionReason: 'Goal has no linked area',
  });
}

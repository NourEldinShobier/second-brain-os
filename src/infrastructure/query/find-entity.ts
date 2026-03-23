import { and, eq } from 'drizzle-orm';
import type { ListableEntityKind } from '../../domain/listable-kind.js';
import type { Result } from '../../domain/result.js';
import { err, ok } from '../../domain/result.js';
import type { SecondBrainDb } from '../db/open-database.js';
import * as schema from '../db/schema.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function isUuid(s: string): boolean {
  return UUID_RE.test(s.trim());
}

export interface FoundEntityRow {
  readonly kind: ListableEntityKind;
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly status: string;
  readonly file_path: string;
  readonly archived: boolean;
  readonly updated_at: string;
}

function rowFromArea(r: typeof schema.areas.$inferSelect): FoundEntityRow {
  return {
    kind: 'area',
    id: r.id,
    slug: r.slug,
    title: r.title,
    status: r.status,
    file_path: r.file_path,
    archived: r.archived,
    updated_at: r.updated_at,
  };
}

function rowFromGoal(r: typeof schema.goals.$inferSelect): FoundEntityRow {
  return {
    kind: 'goal',
    id: r.id,
    slug: r.slug,
    title: r.title,
    status: r.status,
    file_path: r.file_path,
    archived: r.archived,
    updated_at: r.updated_at,
  };
}

function rowFromProject(r: typeof schema.projects.$inferSelect): FoundEntityRow {
  return {
    kind: 'project',
    id: r.id,
    slug: r.slug,
    title: r.title,
    status: r.status,
    file_path: r.file_path,
    archived: r.archived,
    updated_at: r.updated_at,
  };
}

function rowFromTask(r: typeof schema.tasks.$inferSelect): FoundEntityRow {
  return {
    kind: 'task',
    id: r.id,
    slug: r.slug,
    title: r.title,
    status: r.status,
    file_path: r.file_path,
    archived: r.archived,
    updated_at: r.updated_at,
  };
}

function rowFromResource(r: typeof schema.resources.$inferSelect): FoundEntityRow {
  return {
    kind: 'resource',
    id: r.id,
    slug: r.slug,
    title: r.title,
    status: r.status,
    file_path: r.file_path,
    archived: r.archived,
    updated_at: r.updated_at,
  };
}

function rowFromNote(r: typeof schema.notes.$inferSelect): FoundEntityRow {
  return {
    kind: 'note',
    id: r.id,
    slug: r.slug,
    title: r.title,
    status: r.status,
    file_path: r.file_path,
    archived: r.archived,
    updated_at: r.updated_at,
  };
}

export type ArchivedFilter = 'active' | 'archived' | 'either';

function rowFromInbox(r: typeof schema.inboxItems.$inferSelect): FoundEntityRow {
  return {
    kind: 'inbox_item',
    id: r.id,
    slug: r.slug,
    title: r.title,
    status: r.status,
    file_path: r.file_path,
    archived: r.archived,
    updated_at: r.updated_at,
  };
}

/**
 * Resolve a slug within a single entity kind (for archive/restore where kind is explicit).
 */
export function findEntityByKindAndSlug(
  db: SecondBrainDb,
  kind: ListableEntityKind,
  slug: string,
  options: { readonly archived: ArchivedFilter },
): Result<FoundEntityRow, string> {
  const s = slug.trim();
  if (s.length === 0) {
    return err('Empty slug');
  }

  const mode = options.archived;

  switch (kind) {
    case 'area': {
      const cond =
        mode === 'either'
          ? eq(schema.areas.slug, s)
          : mode === 'active'
            ? and(eq(schema.areas.slug, s), eq(schema.areas.archived, false))
            : and(eq(schema.areas.slug, s), eq(schema.areas.archived, true));
      const r = db.select().from(schema.areas).where(cond).get();
      return r ? ok(rowFromArea(r)) : err(`No ${kind} with slug "${s}"`);
    }
    case 'goal': {
      const cond =
        mode === 'either'
          ? eq(schema.goals.slug, s)
          : mode === 'active'
            ? and(eq(schema.goals.slug, s), eq(schema.goals.archived, false))
            : and(eq(schema.goals.slug, s), eq(schema.goals.archived, true));
      const r = db.select().from(schema.goals).where(cond).get();
      return r ? ok(rowFromGoal(r)) : err(`No ${kind} with slug "${s}"`);
    }
    case 'project': {
      const cond =
        mode === 'either'
          ? eq(schema.projects.slug, s)
          : mode === 'active'
            ? and(eq(schema.projects.slug, s), eq(schema.projects.archived, false))
            : and(eq(schema.projects.slug, s), eq(schema.projects.archived, true));
      const r = db.select().from(schema.projects).where(cond).get();
      return r ? ok(rowFromProject(r)) : err(`No ${kind} with slug "${s}"`);
    }
    case 'task': {
      const cond =
        mode === 'either'
          ? eq(schema.tasks.slug, s)
          : mode === 'active'
            ? and(eq(schema.tasks.slug, s), eq(schema.tasks.archived, false))
            : and(eq(schema.tasks.slug, s), eq(schema.tasks.archived, true));
      const r = db.select().from(schema.tasks).where(cond).get();
      return r ? ok(rowFromTask(r)) : err(`No ${kind} with slug "${s}"`);
    }
    case 'resource': {
      const cond =
        mode === 'either'
          ? eq(schema.resources.slug, s)
          : mode === 'active'
            ? and(eq(schema.resources.slug, s), eq(schema.resources.archived, false))
            : and(eq(schema.resources.slug, s), eq(schema.resources.archived, true));
      const r = db.select().from(schema.resources).where(cond).get();
      return r ? ok(rowFromResource(r)) : err(`No ${kind} with slug "${s}"`);
    }
    case 'note': {
      const cond =
        mode === 'either'
          ? eq(schema.notes.slug, s)
          : mode === 'active'
            ? and(eq(schema.notes.slug, s), eq(schema.notes.archived, false))
            : and(eq(schema.notes.slug, s), eq(schema.notes.archived, true));
      const r = db.select().from(schema.notes).where(cond).get();
      return r ? ok(rowFromNote(r)) : err(`No ${kind} with slug "${s}"`);
    }
    case 'inbox_item': {
      const cond =
        mode === 'either'
          ? eq(schema.inboxItems.slug, s)
          : mode === 'active'
            ? and(eq(schema.inboxItems.slug, s), eq(schema.inboxItems.archived, false))
            : and(eq(schema.inboxItems.slug, s), eq(schema.inboxItems.archived, true));
      const r = db.select().from(schema.inboxItems).where(cond).get();
      return r ? ok(rowFromInbox(r)) : err(`No ${kind} with slug "${s}"`);
    }
  }
}

/** Resolve a stable id or slug to a single indexed entity (first slug match if ambiguous across kinds). */
export function findEntityByIdOrSlug(db: SecondBrainDb, ref: string): Result<FoundEntityRow, string> {
  const r = ref.trim();
  if (r.length === 0) {
    return err('Empty reference');
  }

  if (isUuid(r)) {
    const a = db.select().from(schema.areas).where(eq(schema.areas.id, r)).get();
    if (a) {
      return ok(rowFromArea(a));
    }
    const g = db.select().from(schema.goals).where(eq(schema.goals.id, r)).get();
    if (g) {
      return ok(rowFromGoal(g));
    }
    const p = db.select().from(schema.projects).where(eq(schema.projects.id, r)).get();
    if (p) {
      return ok(rowFromProject(p));
    }
    const t = db.select().from(schema.tasks).where(eq(schema.tasks.id, r)).get();
    if (t) {
      return ok(rowFromTask(t));
    }
    const res = db.select().from(schema.resources).where(eq(schema.resources.id, r)).get();
    if (res) {
      return ok(rowFromResource(res));
    }
    const n = db.select().from(schema.notes).where(eq(schema.notes.id, r)).get();
    if (n) {
      return ok(rowFromNote(n));
    }
    const i = db.select().from(schema.inboxItems).where(eq(schema.inboxItems.id, r)).get();
    if (i) {
      return ok(rowFromInbox(i));
    }
    return err(`No entity with id: ${r}`);
  }

  const matches: FoundEntityRow[] = [];
  const a = db.select().from(schema.areas).where(eq(schema.areas.slug, r)).get();
  if (a) {
    matches.push(rowFromArea(a));
  }
  const g = db.select().from(schema.goals).where(eq(schema.goals.slug, r)).get();
  if (g) {
    matches.push(rowFromGoal(g));
  }
  const p = db.select().from(schema.projects).where(eq(schema.projects.slug, r)).get();
  if (p) {
    matches.push(rowFromProject(p));
  }
  const t = db.select().from(schema.tasks).where(eq(schema.tasks.slug, r)).get();
  if (t) {
    matches.push(rowFromTask(t));
  }
  const res = db.select().from(schema.resources).where(eq(schema.resources.slug, r)).get();
  if (res) {
    matches.push(rowFromResource(res));
  }
  const n = db.select().from(schema.notes).where(eq(schema.notes.slug, r)).get();
  if (n) {
    matches.push(rowFromNote(n));
  }
  const i = db.select().from(schema.inboxItems).where(eq(schema.inboxItems.slug, r)).get();
  if (i) {
    matches.push(rowFromInbox(i));
  }

  if (matches.length === 0) {
    return err(`No entity with slug: ${r}`);
  }
  if (matches.length > 1) {
    return err(
      `Ambiguous slug "${r}" (${String(matches.length)} matches). Use a stable id from \`second-brain-os list\`.`,
    );
  }
  const only = matches[0];
  if (only === undefined) {
    return err(`No entity with slug: ${r}`);
  }
  return ok(only);
}

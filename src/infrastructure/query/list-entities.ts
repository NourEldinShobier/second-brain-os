import { and, desc, eq } from 'drizzle-orm';
import type { ListableEntityKind } from '../../domain/listable-kind.js';
import type { SecondBrainDb } from '../db/open-database.js';
import * as schema from '../db/schema.js';

export type { ListableEntityKind } from '../../domain/listable-kind.js';

export interface ListEntitiesFilters {
  readonly status?: string | undefined;

  readonly limit: number;
  /** Tasks only: exact match on `do_date` (YYYY-MM-DD). */
  readonly dueDate?: string | undefined;
}

export interface ListedEntityRow {
  readonly id: string;
  readonly kind: ListableEntityKind;
  readonly slug: string;
  readonly title: string;
  readonly status: string;
  readonly file_path: string;

  readonly updated_at: string;
  readonly priority: number | null;
  readonly do_date: string | null;
  readonly energy: string | null;
}

const MAX_LIMIT = 500;

function clampLimit(n: number): number {
  if (Number.isNaN(n) || n < 1) {
    return 100;
  }
  return Math.min(n, MAX_LIMIT);
}

export function listEntitiesInIndex(
  db: SecondBrainDb,
  kind: ListableEntityKind,
  filters: ListEntitiesFilters,
): ListedEntityRow[] {
  const limit = clampLimit(filters.limit);

  switch (kind) {
    case 'area': {
      const conds = [

        filters.status ? eq(schema.areas.status, filters.status) : undefined,
      ].filter((c): c is NonNullable<typeof c> => c !== undefined);
      const rows = db
        .select()
        .from(schema.areas)
        .where(conds.length > 0 ? and(...conds) : undefined)
        .orderBy(desc(schema.areas.updated_at))
        .limit(limit)
        .all();
      return rows.map((r) => ({
        id: r.id,
        kind: 'area' as const,
        slug: r.slug,
        title: r.title,
        status: r.status,
        file_path: r.file_path,

        updated_at: r.updated_at,
        priority: null,
        do_date: null,
        energy: null,
      }));
    }
    case 'goal': {
      const conds = [

        filters.status ? eq(schema.goals.status, filters.status) : undefined,
      ].filter((c): c is NonNullable<typeof c> => c !== undefined);
      const rows = db
        .select()
        .from(schema.goals)
        .where(conds.length > 0 ? and(...conds) : undefined)
        .orderBy(desc(schema.goals.updated_at))
        .limit(limit)
        .all();
      return rows.map((r) => ({
        id: r.id,
        kind: 'goal' as const,
        slug: r.slug,
        title: r.title,
        status: r.status,
        file_path: r.file_path,

        updated_at: r.updated_at,
        priority: null,
        do_date: null,
        energy: null,
      }));
    }
    case 'project': {
      const conds = [

        filters.status ? eq(schema.projects.status, filters.status) : undefined,
      ].filter((c): c is NonNullable<typeof c> => c !== undefined);
      const rows = db
        .select()
        .from(schema.projects)
        .where(conds.length > 0 ? and(...conds) : undefined)
        .orderBy(desc(schema.projects.updated_at))
        .limit(limit)
        .all();
      return rows.map((r) => ({
        id: r.id,
        kind: 'project' as const,
        slug: r.slug,
        title: r.title,
        status: r.status,
        file_path: r.file_path,

        updated_at: r.updated_at,
        priority: r.priority ?? null,
        do_date: null,
        energy: null,
      }));
    }
    case 'task': {
      const conds = [

        filters.status ? eq(schema.tasks.status, filters.status) : undefined,
        filters.dueDate ? eq(schema.tasks.do_date, filters.dueDate) : undefined,
      ].filter((c): c is NonNullable<typeof c> => c !== undefined);
      const rows = db
        .select()
        .from(schema.tasks)
        .where(conds.length > 0 ? and(...conds) : undefined)
        .orderBy(desc(schema.tasks.updated_at))
        .limit(limit)
        .all();
      return rows.map((r) => ({
        id: r.id,
        kind: 'task' as const,
        slug: r.slug,
        title: r.title,
        status: r.status,
        file_path: r.file_path,

        updated_at: r.updated_at,
        priority: r.priority ?? null,
        do_date: r.do_date ?? null,
        energy: r.energy ?? null,
      }));
    }
    case 'resource': {
      const conds = [

        filters.status ? eq(schema.resources.status, filters.status) : undefined,
      ].filter((c): c is NonNullable<typeof c> => c !== undefined);
      const rows = db
        .select()
        .from(schema.resources)
        .where(conds.length > 0 ? and(...conds) : undefined)
        .orderBy(desc(schema.resources.updated_at))
        .limit(limit)
        .all();
      return rows.map((r) => ({
        id: r.id,
        kind: 'resource' as const,
        slug: r.slug,
        title: r.title,
        status: r.status,
        file_path: r.file_path,

        updated_at: r.updated_at,
        priority: null,
        do_date: null,
        energy: null,
      }));
    }
    case 'note': {
      const conds = [

        filters.status ? eq(schema.notes.status, filters.status) : undefined,
      ].filter((c): c is NonNullable<typeof c> => c !== undefined);
      const rows = db
        .select()
        .from(schema.notes)
        .where(conds.length > 0 ? and(...conds) : undefined)
        .orderBy(desc(schema.notes.updated_at))
        .limit(limit)
        .all();
      return rows.map((r) => ({
        id: r.id,
        kind: 'note' as const,
        slug: r.slug,
        title: r.title,
        status: r.status,
        file_path: r.file_path,

        updated_at: r.updated_at,
        priority: null,
        do_date: null,
        energy: null,
      }));
    }
    case 'inbox_item': {
      const conds = [

        filters.status ? eq(schema.inboxItems.status, filters.status) : undefined,
      ].filter((c): c is NonNullable<typeof c> => c !== undefined);
      const rows = db
        .select()
        .from(schema.inboxItems)
        .where(conds.length > 0 ? and(...conds) : undefined)
        .orderBy(desc(schema.inboxItems.updated_at))
        .limit(limit)
        .all();
      return rows.map((r) => ({
        id: r.id,
        kind: 'inbox_item' as const,
        slug: r.slug,
        title: r.title,
        status: r.status,
        file_path: r.file_path,

        updated_at: r.updated_at,
        priority: null,
        do_date: null,
        energy: null,
      }));
    }
  }
}

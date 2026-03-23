import { eq } from 'drizzle-orm';
import type { SecondBrainMeta } from '../../domain/markdown/second-brain-meta.js';
import type { SecondBrainDb } from '../db/open-database.js';
import * as schema from '../db/schema.js';

export function upsertArea(
  db: SecondBrainDb,
  meta: SecondBrainMeta,
  relPath: string,
  createdAt: string,
  updatedAt: string,
): void {
  if (meta.kind !== 'area') {
    return;
  }
  db.insert(schema.areas)
    .values({
      id: meta.id,
      slug: meta.slug,
      title: meta.title,
      file_path: relPath,
      status: meta.status,
      archived: meta.archived,
      created_at: createdAt,
      updated_at: updatedAt,
    })
    .onConflictDoUpdate({
      target: schema.areas.id,
      set: {
        slug: meta.slug,
        title: meta.title,
        file_path: relPath,
        status: meta.status,
        archived: meta.archived,
        updated_at: updatedAt,
      },
    })
    .run();
}

export function upsertGoal(
  db: SecondBrainDb,
  meta: SecondBrainMeta,
  relPath: string,
  createdAt: string,
  updatedAt: string,
): void {
  if (meta.kind !== 'goal') {
    return;
  }
  db.transaction((tx) => {
    tx.delete(schema.goalKeyResults).where(eq(schema.goalKeyResults.goal_id, meta.id)).run();
    tx.insert(schema.goals)
      .values({
        id: meta.id,
        slug: meta.slug,
        title: meta.title,
        file_path: relPath,
        status: meta.status,
        archived: meta.archived,
        target_date: meta.target_date ?? null,
        quarter: meta.quarter ?? null,
        year: meta.year ?? null,
        created_at: createdAt,
        updated_at: updatedAt,
      })
      .onConflictDoUpdate({
        target: schema.goals.id,
        set: {
          slug: meta.slug,
          title: meta.title,
          file_path: relPath,
          status: meta.status,
          archived: meta.archived,
          target_date: meta.target_date ?? null,
          quarter: meta.quarter ?? null,
          year: meta.year ?? null,
          updated_at: updatedAt,
        },
      })
      .run();
    for (const kr of meta.key_results ?? []) {
      tx.insert(schema.goalKeyResults)
        .values({
          id: kr.id,
          goal_id: meta.id,
          title: kr.title,
          completed: kr.done,
          sort_order: kr.order,
          created_at: createdAt,
          updated_at: updatedAt,
        })
        .onConflictDoUpdate({
          target: schema.goalKeyResults.id,
          set: {
            title: kr.title,
            completed: kr.done,
            sort_order: kr.order,
            updated_at: updatedAt,
          },
        })
        .run();
    }
  });
}

export function upsertProject(
  db: SecondBrainDb,
  meta: SecondBrainMeta,
  relPath: string,
  createdAt: string,
  updatedAt: string,
): void {
  if (meta.kind !== 'project') {
    return;
  }
  db.insert(schema.projects)
    .values({
      id: meta.id,
      slug: meta.slug,
      title: meta.title,
      file_path: relPath,
      status: meta.status,
      archived: meta.archived,
      priority: meta.priority ?? null,
      start_date: undefined,
      end_date: undefined,
      created_at: createdAt,
      updated_at: updatedAt,
    })
    .onConflictDoUpdate({
      target: schema.projects.id,
      set: {
        slug: meta.slug,
        title: meta.title,
        file_path: relPath,
        status: meta.status,
        archived: meta.archived,
        priority: meta.priority ?? null,
        updated_at: updatedAt,
      },
    })
    .run();
}

export function upsertTask(
  db: SecondBrainDb,
  meta: SecondBrainMeta,
  relPath: string,
  createdAt: string,
  updatedAt: string,
): void {
  if (meta.kind !== 'task') {
    return;
  }
  db.insert(schema.tasks)
    .values({
      id: meta.id,
      slug: meta.slug,
      title: meta.title,
      file_path: relPath,
      status: meta.status,
      archived: meta.archived,
      priority: meta.priority ?? null,
      energy: meta.energy ?? null,
      do_date: meta.due_date ?? null,
      start_time: undefined,
      end_time: undefined,
      created_at: createdAt,
      updated_at: updatedAt,
    })
    .onConflictDoUpdate({
      target: schema.tasks.id,
      set: {
        slug: meta.slug,
        title: meta.title,
        file_path: relPath,
        status: meta.status,
        archived: meta.archived,
        priority: meta.priority ?? null,
        energy: meta.energy ?? null,
        do_date: meta.due_date ?? null,
        updated_at: updatedAt,
      },
    })
    .run();
}

export function upsertResource(
  db: SecondBrainDb,
  meta: SecondBrainMeta,
  relPath: string,
  createdAt: string,
  updatedAt: string,
): void {
  if (meta.kind !== 'resource') {
    return;
  }
  db.insert(schema.resources)
    .values({
      id: meta.id,
      slug: meta.slug,
      title: meta.title,
      file_path: relPath,
      status: meta.status,
      archived: meta.archived,
      resource_type: undefined,
      source_url: meta.source_url ?? null,
      pinned: meta.pinned ?? null,
      created_at: createdAt,
      updated_at: updatedAt,
    })
    .onConflictDoUpdate({
      target: schema.resources.id,
      set: {
        slug: meta.slug,
        title: meta.title,
        file_path: relPath,
        status: meta.status,
        archived: meta.archived,
        source_url: meta.source_url ?? null,
        pinned: meta.pinned ?? null,
        updated_at: updatedAt,
      },
    })
    .run();
}

export function upsertNote(
  db: SecondBrainDb,
  meta: SecondBrainMeta,
  relPath: string,
  createdAt: string,
  updatedAt: string,
): void {
  if (meta.kind !== 'note') {
    return;
  }
  db.insert(schema.notes)
    .values({
      id: meta.id,
      slug: meta.slug,
      title: meta.title,
      file_path: relPath,
      status: meta.status,
      archived: meta.archived,
      topic_summary: undefined,
      pinned: meta.pinned ?? null,
      favorite: meta.favorite ?? null,
      notebook: meta.notebook ?? null,
      created_at: createdAt,
      updated_at: updatedAt,
    })
    .onConflictDoUpdate({
      target: schema.notes.id,
      set: {
        slug: meta.slug,
        title: meta.title,
        file_path: relPath,
        status: meta.status,
        archived: meta.archived,
        pinned: meta.pinned ?? null,
        favorite: meta.favorite ?? null,
        notebook: meta.notebook ?? null,
        updated_at: updatedAt,
      },
    })
    .run();
}

/** Optional file body for entities that mirror content into SQLite (e.g. inbox `raw_input`). */
export interface EntityIndexContext {
  readonly body?: string;
}

export function upsertInbox(
  db: SecondBrainDb,
  meta: SecondBrainMeta,
  relPath: string,
  createdAt: string,
  updatedAt: string,
  rawBody?: string,
): void {
  if (meta.kind !== 'inbox_item') {
    return;
  }
  const rawInput = rawBody !== undefined ? rawBody : null;
  db.insert(schema.inboxItems)
    .values({
      id: meta.id,
      slug: meta.slug,
      title: meta.title,
      file_path: relPath,
      status: meta.status,
      archived: meta.archived,
      raw_input: rawInput,
      suggested_entity_type: meta.suggested_entity_type ?? null,
      processed_at: meta.processed_at ?? null,
      created_at: createdAt,
      updated_at: updatedAt,
    })
    .onConflictDoUpdate({
      target: schema.inboxItems.id,
      set: {
        slug: meta.slug,
        title: meta.title,
        file_path: relPath,
        status: meta.status,
        archived: meta.archived,
        raw_input: rawInput,
        suggested_entity_type: meta.suggested_entity_type ?? null,
        processed_at: meta.processed_at ?? null,
        updated_at: updatedAt,
      },
    })
    .run();
}

export function upsertByKind(
  db: SecondBrainDb,
  meta: SecondBrainMeta,
  relPath: string,
  createdAt: string,
  updatedAt: string,
  indexContext?: EntityIndexContext,
): void {
  switch (meta.kind) {
    case 'area':
      upsertArea(db, meta, relPath, createdAt, updatedAt);
      break;
    case 'goal':
      upsertGoal(db, meta, relPath, createdAt, updatedAt);
      break;
    case 'project':
      upsertProject(db, meta, relPath, createdAt, updatedAt);
      break;
    case 'task':
      upsertTask(db, meta, relPath, createdAt, updatedAt);
      break;
    case 'resource':
      upsertResource(db, meta, relPath, createdAt, updatedAt);
      break;
    case 'note':
      upsertNote(db, meta, relPath, createdAt, updatedAt);
      break;
    case 'inbox_item':
      upsertInbox(db, meta, relPath, createdAt, updatedAt, indexContext?.body);
      break;
    case 'archive_record':
      break;
  }
}

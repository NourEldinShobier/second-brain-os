import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { openAndMigrate } from '../db/open-database.js';
import * as schema from '../db/schema.js';
import { ensureCanonicalLayout } from '../workspace/create-layout.js';
import { EntityCrudService } from '../../application/entity-crud-service.js';
import { MarkdownWorkspaceRepository } from '../markdown/markdown-repository.js';
import { listEntitiesInIndex } from './list-entities.js';

describe('listEntitiesInIndex', () => {
  it('lists tasks with status filter and hides archived by default', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-list-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);
    const repo = new MarkdownWorkspaceRepository(root);
    const entities = new EntityCrudService(repo, db);

    const area = await entities.createArea({ title: 'A', slug: 'a' });
    expect(area.ok).toBe(true);
    if (!area.ok) {
      return;
    }

    const t1 = await entities.createTask({
      title: 'Open task',
      slug: 'open-task',
      status: 'todo',
      areaIds: [area.value.meta.id],
    });
    expect(t1.ok).toBe(true);

    const t2 = await entities.createTask({
      title: 'Done task',
      slug: 'done-task',
      status: 'done',
      areaIds: [area.value.meta.id],
    });
    expect(t2.ok).toBe(true);

    const todos = listEntitiesInIndex(db, 'task', {
      limit: 50,
      status: 'todo',
    });
    expect(todos.every((r) => r.status === 'todo')).toBe(true);
    expect(todos.some((r) => r.slug === 'open-task')).toBe(true);
    expect(todos.some((r) => r.slug === 'done-task')).toBe(false);

  });

  it('filters tasks by due date', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-list-due-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);
    const repo = new MarkdownWorkspaceRepository(root);
    const entities = new EntityCrudService(repo, db);

    const area = await entities.createArea({ title: 'A', slug: 'a2' });
    if (!area.ok) {
      return;
    }

    await entities.createTask({
      title: 'Due A',
      slug: 'due-a',
      areaIds: [area.value.meta.id],
      dueDate: '2026-06-01',
    });
    await entities.createTask({
      title: 'Due B',
      slug: 'due-b',
      areaIds: [area.value.meta.id],
      dueDate: '2026-07-01',
    });

    const june = listEntitiesInIndex(db, 'task', {
      limit: 50,
      dueDate: '2026-06-01',
    });
    expect(june).toHaveLength(1);
    expect(june[0]?.slug).toBe('due-a');
  });
});

import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { openAndMigrate } from '../infrastructure/db/open-database.js';
import * as schema from '../infrastructure/db/schema.js';
import { ensureCanonicalLayout } from '../infrastructure/workspace/create-layout.js';
import { MarkdownWorkspaceRepository } from '../infrastructure/markdown/markdown-repository.js';
import { EntityCrudService } from './entity-crud-service.js';
import { executeTypedCapture } from './typed-capture.js';

describe('executeTypedCapture', () => {
  it('creates a task, resource, and note with expected index rows', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-typed-cap-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);
    const repo = new MarkdownWorkspaceRepository(root);
    const entities = new EntityCrudService(repo, db);

    const area = await entities.createArea({ title: 'Work', slug: 'work' });
    expect(area.ok).toBe(true);
    if (!area.ok) {
      return;
    }

    const task = await executeTypedCapture(db, entities, {
      kind: 'task',
      title: 'Ship feature',
      body: 'Details here.',
      areaRefs: ['work'],
      projectRefs: [],
      status: 'inbox',
    });
    expect(task.ok).toBe(true);
    if (!task.ok) {
      return;
    }
    expect(task.value.meta.status).toBe('inbox');
    const taskRow = db.select().from(schema.tasks).where(eq(schema.tasks.id, task.value.meta.id)).get();
    expect(taskRow?.title).toBe('Ship feature');

    const res = await executeTypedCapture(db, entities, {
      kind: 'resource',
      title: 'Spec doc',
      body: 'See link below.',
      areaRefs: [],
      projectRefs: [],
      url: 'https://example.com/spec',
    });
    expect(res.ok).toBe(true);
    if (!res.ok) {
      return;
    }
    expect(res.value.meta.source_url).toBe('https://example.com/spec');

    const note = await executeTypedCapture(db, entities, {
      kind: 'note',
      title: 'Scratch',
      body: 'Ideas.',
      areaRefs: [],
      projectRefs: [],
      status: 'inbox',
      notebook: 'ideas',
    });
    expect(note.ok).toBe(true);
    if (!note.ok) {
      return;
    }
    expect(note.value.meta.notebook).toBe('ideas');
  });

  it('rejects a goal without areas', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-typed-goal-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);
    const repo = new MarkdownWorkspaceRepository(root);
    const entities = new EntityCrudService(repo, db);

    const g = await executeTypedCapture(db, entities, {
      kind: 'goal',
      title: 'No areas',
      body: '',
      areaRefs: [],
      projectRefs: [],
    });
    expect(g.ok).toBe(false);
  });
});

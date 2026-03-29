import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { openAndMigrate } from '../infrastructure/db/open-database.js';
import * as schema from '../infrastructure/db/schema.js';
import { ensureCanonicalLayout } from '../infrastructure/workspace/create-layout.js';
import { listBacklinks } from '../infrastructure/relationships/entity-link-queries.js';
import { MarkdownWorkspaceRepository } from '../infrastructure/markdown/markdown-repository.js';
import { EntityCrudService } from './entity-crud-service.js';

describe('EntityCrudService', () => {
  it('creates an area and indexes it in SQLite', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-crud-area-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);
    const repo = new MarkdownWorkspaceRepository(root);
    const svc = new EntityCrudService(repo, db);

    const created = await svc.createArea({ title: 'Health', slug: 'health', body: 'Notes.' });
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const row = db.select().from(schema.areas).where(eq(schema.areas.id, created.value.meta.id)).get();
    expect(row?.slug).toBe('health');
    expect(row?.title).toBe('Health');

    const read = await svc.readEntity(created.value.path);
    expect(read.ok).toBe(true);
    if (!read.ok) {
      return;
    }
    expect(read.value.meta.slug).toBe('health');
  });

  it('rejects a goal with no area_ids', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-crud-goal-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);
    const repo = new MarkdownWorkspaceRepository(root);
    const svc = new EntityCrudService(repo, db);

    const r = await svc.createGoal({ title: 'No areas', slug: 'no-areas', areaIds: [] });
    expect(r.ok).toBe(false);
  });

  it('indexes forward links and resolves backlinks for an area', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-crud-links-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);
    const repo = new MarkdownWorkspaceRepository(root);
    const svc = new EntityCrudService(repo, db);

    const area = await svc.createArea({ title: 'Career', slug: 'career' });
    expect(area.ok).toBe(true);
    if (!area.ok) {
      return;
    }

    const goal = await svc.createGoal({
      title: 'Improve presence',
      slug: 'presence',
      areaIds: [area.value.meta.id],
    });
    expect(goal.ok).toBe(true);
    if (!goal.ok) {
      return;
    }

    const bl = listBacklinks(db, 'area', area.value.meta.id);
    expect(bl).toHaveLength(1);
    expect(bl[0]?.fromEntityId).toBe(goal.value.meta.id);
    expect(bl[0]?.fromEntityType).toBe('goal');
    expect(bl[0]?.toEntityId).toBe(area.value.meta.id);
  });

  it('rejects links to unknown entity ids', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-crud-bad-link-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);
    const repo = new MarkdownWorkspaceRepository(root);
    const svc = new EntityCrudService(repo, db);

    const r = await svc.createGoal({
      title: 'Bad',
      slug: 'bad',
      areaIds: ['aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'],
    });
    expect(r.ok).toBe(false);
    if (r.ok) {
      return;
    }
    expect(r.error).toContain('Unknown');
  });



  it('reclassifies a note to a resource while preserving id', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-crud-reclass-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);
    const repo = new MarkdownWorkspaceRepository(root);
    const svc = new EntityCrudService(repo, db);

    const note = await svc.createNote({ title: 'Link me', slug: 'link-me', body: 'https://example.com/x' });
    expect(note.ok).toBe(true);
    if (!note.ok) {
      return;
    }
    const id = note.value.meta.id;
    const fromPath = note.value.path;

    const rc = await svc.reclassifyEntity(fromPath, 'resource');
    expect(rc.ok).toBe(true);
    if (!rc.ok) {
      return;
    }

    expect(rc.value.meta.kind).toBe('resource');
    expect(rc.value.meta.id).toBe(id);

    const nRow = db.select().from(schema.notes).where(eq(schema.notes.id, id)).get();
    expect(nRow).toBeUndefined();
    const rRow = db.select().from(schema.resources).where(eq(schema.resources.id, id)).get();
    expect(rRow?.slug).toBe('link-me');
  });
});

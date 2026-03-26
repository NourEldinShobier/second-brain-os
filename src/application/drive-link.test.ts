import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { openAndMigrate } from '../infrastructure/db/open-database.js';
import { MarkdownWorkspaceRepository } from '../infrastructure/markdown/markdown-repository.js';
import { ensureCanonicalLayout } from '../infrastructure/workspace/create-layout.js';
import { EntityCrudService } from './entity-crud-service.js';
import {
  applyDriveItemLinks,
  importDrivePayload,
  parseDriveLinkClearKinds,
} from './drive-vault-service.js';

describe('drive link and metadata', () => {
  it('merges links into item.md and rejects unknown entity refs', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-dlink-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);
    const repo = new MarkdownWorkspaceRepository(root);
    const entities = new EntityCrudService(repo, db);
    const area = await entities.createArea({ title: 'A', slug: 'link-area' });
    expect(area.ok).toBe(true);
    if (!area.ok) return;
    const task = await entities.createTask({
      title: 'T',
      slug: 'link-task',
      areaIds: [area.value.meta.id],
    });
    expect(task.ok).toBe(true);
    if (!task.ok) return;

    const src = path.join(root, 'f.txt');
    await writeFile(src, 'x');
    const imp = await importDrivePayload(root, db, src, { title: 'Linked' });
    expect(imp.ok).toBe(true);
    if (!imp.ok) return;

    const bad = await applyDriveItemLinks(
      root,
      db,
      imp.value.slug,
      {
        append: { tasks: ['no-such-task-slug-xyz'] },
        replace: false,
        clearKinds: [],
        dryRun: false,
      },
      false,
    );
    expect(bad.ok).toBe(false);

    const okLink = await applyDriveItemLinks(
      root,
      db,
      imp.value.slug,
      {
        append: { tasks: ['link-task'], areas: ['link-area'] },
        replace: false,
        clearKinds: [],
        dryRun: false,
      },
      false,
    );
    expect(okLink.ok).toBe(true);
    if (!okLink.ok) return;
    expect(okLink.value.task_ids).toEqual([task.value.meta.id]);
    expect(okLink.value.area_ids).toEqual([area.value.meta.id]);

    const raw = await readFile(path.join(root, imp.value.relPath), 'utf8');
    expect(raw).toContain(task.value.meta.id);
    expect(raw).toContain(area.value.meta.id);
  });

  it('replace and clear update item.md', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-dlink2-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);
    const repo = new MarkdownWorkspaceRepository(root);
    const entities = new EntityCrudService(repo, db);
    const area = await entities.createArea({ title: 'A2', slug: 'a2' });
    expect(area.ok).toBe(true);
    if (!area.ok) return;
    const src = path.join(root, 'g.txt');
    await writeFile(src, 'y');
    const imp = await importDrivePayload(root, db, src, { title: 'R' });
    expect(imp.ok).toBe(true);
    if (!imp.ok) return;

    const m1 = await applyDriveItemLinks(
      root,
      db,
      imp.value.slug,
      {
        append: { areas: ['a2'] },
        replace: false,
        clearKinds: [],
        dryRun: false,
      },
      false,
    );
    expect(m1.ok).toBe(true);
    if (!m1.ok) return;
    expect(m1.value.area_ids).toEqual([area.value.meta.id]);

    const cleared = parseDriveLinkClearKinds('area');
    expect(cleared.ok).toBe(true);
    if (!cleared.ok) return;
    const m2 = await applyDriveItemLinks(
      root,
      db,
      imp.value.slug,
      {
        append: {},
        replace: false,
        clearKinds: cleared.value,
        dryRun: false,
      },
      false,
    );
    expect(m2.ok).toBe(true);
    if (!m2.ok) return;
    expect(m2.value.area_ids).toBeUndefined();

    const m3 = await applyDriveItemLinks(
      root,
      db,
      imp.value.slug,
      {
        append: { areas: ['a2'] },
        replace: true,
        clearKinds: [],
        dryRun: false,
      },
      false,
    );
    expect(m3.ok).toBe(true);
    if (!m3.ok) return;
    expect(m3.value.area_ids).toEqual([area.value.meta.id]);
  });

  it('parseDriveLinkClearKinds rejects unknown tokens', () => {
    const r = parseDriveLinkClearKinds('area,bogus');
    expect(r.ok).toBe(false);
  });
});

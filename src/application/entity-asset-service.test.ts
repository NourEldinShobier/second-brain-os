import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { openAndMigrate } from '../infrastructure/db/open-database.js';
import { MarkdownWorkspaceRepository } from '../infrastructure/markdown/markdown-repository.js';
import { ensureCanonicalLayout } from '../infrastructure/workspace/create-layout.js';
import { EntityCrudService } from './entity-crud-service.js';
import { addEntityAsset, listEntityAssets, removeEntityAsset } from './entity-asset-service.js';

describe('entity asset service', () => {
  it('adds, lists, and removes an asset on a task', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-asset-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);
    const repo = new MarkdownWorkspaceRepository(root);
    const entities = new EntityCrudService(repo, db);

    const area = await entities.createArea({ title: 'A', slug: 'a' });
    expect(area.ok).toBe(true);
    if (!area.ok) return;

    const task = await entities.createTask({ title: 'T', slug: 't', areaIds: [area.value.meta.id] });
    expect(task.ok).toBe(true);
    if (!task.ok) return;

    const srcFile = path.join(root, 'source.txt');
    await writeFile(srcFile, 'hello asset', 'utf8');

    const add = await addEntityAsset(db, entities, repo, 't', srcFile, { title: 'Doc' });
    expect(add.ok).toBe(true);
    if (!add.ok) return;
    expect(add.value.asset.path.startsWith('assets/')).toBe(true);

    const listed = listEntityAssets(db, 't');
    expect(listed.ok).toBe(true);
    if (!listed.ok) return;
    expect(listed.value.length).toBe(1);

    const rem = await removeEntityAsset(db, entities, repo, 't', add.value.asset.id);
    expect(rem.ok).toBe(true);
    const listed2 = listEntityAssets(db, 't');
    expect(listed2.ok).toBe(true);
    if (!listed2.ok) return;
    expect(listed2.value.length).toBe(0);
  });
});

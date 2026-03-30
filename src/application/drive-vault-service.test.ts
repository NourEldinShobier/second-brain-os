import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { openAndMigrate } from '../infrastructure/db/open-database.js';
import * as schema from '../infrastructure/db/schema.js';
import { MarkdownWorkspaceRepository } from '../infrastructure/markdown/markdown-repository.js';
import { ensureCanonicalLayout } from '../infrastructure/workspace/create-layout.js';
import { reindexWorkspace } from '../infrastructure/indexing/reindex-workspace.js';
import { EntityCrudService } from './entity-crud-service.js';
import {
  applyDriveItemLinks,
  findDriveItemByRef,
  importDrivePayload,
  listDriveItems,
} from './drive-vault-service.js';

describe('drive vault service', () => {
  it('imports a folder and reindex preserves child_count from item.md', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-drive-fo-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);
    const srcDir = path.join(root, 'src-folder');
    await mkdir(srcDir, { recursive: true });
    await writeFile(path.join(srcDir, 'a.txt'), 'a');
    await writeFile(path.join(srcDir, 'b.txt'), 'b');
    const imp = await importDrivePayload(root, db, srcDir, { title: 'Folder In' });
    expect(imp.ok).toBe(true);
    if (!imp.ok) return;
    expect(imp.value.meta.item_type).toBe('folder');
    expect(imp.value.meta.child_count).toBe(2);

    await reindexWorkspace(root, db);
    const row = db
      .select()
      .from(schema.driveItems)
      .where(eq(schema.driveItems.slug, imp.value.slug))
      .get();
    expect(row?.item_type).toBe('folder');
    expect(row?.child_count).toBe(2);
  });

  it('listDriveItems filters by area, project, tags, and standalone', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-drive-fi-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);
    const repo = new MarkdownWorkspaceRepository(root);
    const entities = new EntityCrudService(repo, db);
    const area = await entities.createArea({ title: 'A', slug: 'f-area' });
    expect(area.ok).toBe(true);
    if (!area.ok) return;

    const f1 = path.join(root, 'f1.txt');
    await writeFile(f1, 'x');
    const imp1 = await importDrivePayload(root, db, f1, { title: 'NoLinks', tags: ['tag1'] });
    expect(imp1.ok).toBe(true);
    if (!imp1.ok) return;

    const f2 = path.join(root, 'f2.txt');
    await writeFile(f2, 'y');
    const imp2 = await importDrivePayload(root, db, f2, { title: 'WithArea' });
    expect(imp2.ok).toBe(true);
    if (!imp2.ok) return;

    await applyDriveItemLinks(root, db, imp2.value.slug, {
      append: { areas: ['f-area'] },
      replace: false,
      clearKinds: [],
      dryRun: false,
    });

    const all = listDriveItems(db, {});
    expect(all.length).toBe(2);

    const byArea = listDriveItems(db, { areaIds: [area.value.meta.id] });
    expect(byArea.length).toBe(1);
    expect(byArea[0]?.slug).toBe(imp2.value.slug);

    const standalone = listDriveItems(db, { standalone: true });
    expect(standalone.length).toBe(1);
    expect(standalone[0]?.slug).toBe(imp1.value.slug);

    const byTag = listDriveItems(db, { tags: ['tag1'] });
    expect(byTag.length).toBe(1);
    expect(byTag[0]?.slug).toBe(imp1.value.slug);
  });

  it('listDriveItems filters by inbox and primaryType', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-drive-primary-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);
    const repo = new MarkdownWorkspaceRepository(root);
    const entities = new EntityCrudService(repo, db);

    const area = await entities.createArea({ title: 'Health', slug: 'health' });
    expect(area.ok).toBe(true);
    if (!area.ok) return;

    const project = await entities.createProject({
      title: 'My App',
      slug: 'my-app',
      areaIds: [area.value.meta.id],
    });
    expect(project.ok).toBe(true);
    if (!project.ok) return;

    const f1 = path.join(root, 'inbox-file.txt');
    await writeFile(f1, 'inbox content');
    const imp1 = await importDrivePayload(root, db, f1, { title: 'Inbox Item' });
    expect(imp1.ok).toBe(true);
    if (!imp1.ok) return;

    const f2 = path.join(root, 'area-file.txt');
    await writeFile(f2, 'area content');
    const imp2 = await importDrivePayload(root, db, f2, {
      title: 'Area Item',
      primary: { type: 'area', ref: 'health' },
    });
    expect(imp2.ok).toBe(true);
    if (!imp2.ok) return;

    const f3 = path.join(root, 'project-file.txt');
    await writeFile(f3, 'project content');
    const imp3 = await importDrivePayload(root, db, f3, {
      title: 'Project Item',
      primary: { type: 'project', ref: 'my-app' },
    });
    expect(imp3.ok).toBe(true);
    if (!imp3.ok) return;

    const all = listDriveItems(db, {});
    expect(all.length).toBe(3);

    const inboxItems = listDriveItems(db, { inbox: true });
    expect(inboxItems.length).toBe(1);
    expect(inboxItems[0]?.slug).toBe(imp1.value.slug);

    const nullItems = listDriveItems(db, { primaryType: 'null' });
    expect(nullItems.length).toBe(1);
    expect(nullItems[0]?.slug).toBe(imp1.value.slug);

    const areaItems = listDriveItems(db, { primaryType: 'area' });
    expect(areaItems.length).toBe(1);
    expect(areaItems[0]?.slug).toBe(imp2.value.slug);

    const projectItems = listDriveItems(db, { primaryType: 'project' });
    expect(projectItems.length).toBe(1);
    expect(projectItems[0]?.slug).toBe(imp3.value.slug);

    const areaHealthItems = listDriveItems(db, {
      primaryType: 'area',
      primaryEntitySlug: 'health',
    });
    expect(areaHealthItems.length).toBe(1);
    expect(areaHealthItems[0]?.slug).toBe(imp2.value.slug);
  });
});

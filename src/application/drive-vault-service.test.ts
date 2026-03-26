import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { openAndMigrate } from '../infrastructure/db/open-database.js';
import * as schema from '../infrastructure/db/schema.js';
import { ensureCanonicalLayout } from '../infrastructure/workspace/create-layout.js';
import { reindexWorkspace } from '../infrastructure/indexing/reindex-workspace.js';
import {
  archiveDriveItem,
  findDriveItemByRef,
  importDrivePayload,
  listDriveItems,
  restoreDriveItem,
} from './drive-vault-service.js';

describe('drive vault service', () => {
  it('imports a file, indexes it, archives, and restores', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-drive-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);

    const src = path.join(root, 'drop', 'note.txt');
    await mkdir(path.dirname(src), { recursive: true });
    await writeFile(src, 'hello drive', 'utf8');

    const imp = await importDrivePayload(root, db, src, { title: 'My Note' });
    expect(imp.ok).toBe(true);
    if (!imp.ok) return;
    expect(imp.value.slug).toMatch(/^my-note/);

    const listed = listDriveItems(db, false);
    expect(listed.length).toBe(1);
    expect(listed[0]?.slug).toBe(imp.value.slug);

    const arch = await archiveDriveItem(root, db, imp.value.slug, 'done');
    expect(arch.ok).toBe(true);

    const listedArchived = listDriveItems(db, false);
    expect(listedArchived.length).toBe(0);
    const listedAll = listDriveItems(db, true);
    expect(listedAll.length).toBe(1);
    expect(listedAll[0]?.archived).toBe(true);

    const rest = await restoreDriveItem(root, db, imp.value.slug);
    expect(rest.ok).toBe(true);
    const active = listDriveItems(db, false);
    expect(active.length).toBe(1);
    expect(active[0]?.archived).toBe(false);

    const idx = await reindexWorkspace(root, db);
    expect(idx.indexedFiles).toBeGreaterThanOrEqual(1);
    const row = db.select().from(schema.driveItems).where(eq(schema.driveItems.slug, imp.value.slug)).get();
    expect(row?.archived).toBe(false);
  });

  it('findDriveItemByRef hides archived items unless includeArchived', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-drive-arch-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);
    const src = path.join(root, 'drop', 'x.txt');
    await mkdir(path.dirname(src), { recursive: true });
    await writeFile(src, 'x');
    const imp = await importDrivePayload(root, db, src, { title: 'Arch Test' });
    expect(imp.ok).toBe(true);
    if (!imp.ok) return;
    await archiveDriveItem(root, db, imp.value.slug);
    const miss = findDriveItemByRef(db, imp.value.slug, false);
    expect(miss.ok).toBe(false);
    const hit = findDriveItemByRef(db, imp.value.slug, true);
    expect(hit.ok).toBe(true);
    if (!hit.ok) return;
    expect(hit.value.archived).toBe(true);
  });

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
    const row = db.select().from(schema.driveItems).where(eq(schema.driveItems.slug, imp.value.slug)).get();
    expect(row?.item_type).toBe('folder');
    expect(row?.child_count).toBe(2);
  });
});

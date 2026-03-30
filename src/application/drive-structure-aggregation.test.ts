import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { openAndMigrate } from '../infrastructure/db/open-database.js';
import { ensureCanonicalLayout } from '../infrastructure/workspace/create-layout.js';
import { importDrivePayload } from './drive-vault-service.js';
import { setDriveItemPrimary } from './drive-organization-service.js';
import { aggregateDriveStructure } from './drive-structure-aggregation.js';
import * as schema from '../infrastructure/db/schema.js';

describe('aggregateDriveStructure', () => {
  it('returns empty structure for vault with no items', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-struct-empty-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);

    const structure = aggregateDriveStructure(db);

    expect(structure.root).toBe('07-drive/items');
    expect(structure.total_drive_items).toBe(0);
    expect(structure.unsorted_count).toBe(0);
    expect(structure.legacy_count).toBe(0);
    expect(structure.folders).toHaveLength(4);

    const areasFolder = structure.folders.find((f) => f.path === '010-areas');
    expect(areasFolder?.total_items).toBe(0);
    expect(areasFolder?.children).toHaveLength(0);

    const projectsFolder = structure.folders.find((f) => f.path === '020-projects');
    expect(projectsFolder?.total_items).toBe(0);

    const resourcesFolder = structure.folders.find((f) => f.path === '030-resources');
    expect(resourcesFolder?.total_items).toBe(0);

    const inboxFolder = structure.folders.find((f) => f.path === '000-inbox');
    expect(inboxFolder?.total_items).toBe(0);
  });

  it('counts items in inbox', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-struct-inbox-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);

    const f1 = path.join(root, 'file1.txt');
    await writeFile(f1, 'content1');
    const imp1 = await importDrivePayload(root, db, f1, { title: 'File 1' });
    expect(imp1.ok).toBe(true);

    const f2 = path.join(root, 'file2.txt');
    await writeFile(f2, 'content2');
    const imp2 = await importDrivePayload(root, db, f2, { title: 'File 2' });
    expect(imp2.ok).toBe(true);

    const structure = aggregateDriveStructure(db);

    expect(structure.total_drive_items).toBe(2);
    expect(structure.unsorted_count).toBe(2);

    const inboxFolder = structure.folders.find((f) => f.path === '000-inbox');
    expect(inboxFolder?.total_items).toBe(2);
  });

  it('counts items organized under areas', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-struct-areas-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);

    const areaMd = `---
id: area-health-123
slug: health
title: Health & Fitness
status: active
created_at: "2025-01-01T00:00:00Z"
updated_at: "2025-01-01T00:00:00Z"
---
Body`;
    const areaDir = path.join(root, '01-areas', 'health');
    await mkdir(areaDir, { recursive: true });
    await writeFile(path.join(areaDir, 'index.md'), areaMd);

    await db
      .insert(schema.areas)
      .values({
        id: 'area-health-123',
        slug: 'health',
        title: 'Health & Fitness',
        file_path: '01-areas/health/index.md',
        status: 'active',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      })
      .run();

    const f1 = path.join(root, 'file1.txt');
    await writeFile(f1, 'content1');
    const imp1 = await importDrivePayload(root, db, f1, { title: 'File 1' });
    expect(imp1.ok).toBe(true);
    if (imp1.ok) {
      const primaryResult = await setDriveItemPrimary(
        root,
        db,
        imp1.value.slug,
        { primaryType: 'area', entityRef: 'health' },
        false,
      );
      expect(primaryResult.ok).toBe(true);
      if (!primaryResult.ok) {
        console.log('setDriveItemPrimary error:', primaryResult.error);
      }
    }

    const structure = aggregateDriveStructure(db);

    expect(structure.total_drive_items).toBe(1);
    expect(structure.unsorted_count).toBe(0);

    const areasFolder = structure.folders.find((f) => f.path === '010-areas');
    expect(areasFolder?.total_items).toBe(1);
    expect(areasFolder?.children).toHaveLength(1);
    expect(areasFolder?.children[0]?.entity_slug).toBe('health');
    expect(areasFolder?.children[0]?.entity_title).toBe('Health & Fitness');
    expect(areasFolder?.children[0]?.drive_item_count).toBe(1);
  });

  it('counts items organized under projects', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-struct-projects-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);

    const projectMd = `---
id: proj-app-456
slug: my-app
title: My App
status: active
created_at: "2025-01-01T00:00:00Z"
updated_at: "2025-01-01T00:00:00Z"
---
Body`;
    const projectDir = path.join(root, '03-projects', 'my-app');
    await mkdir(projectDir, { recursive: true });
    await writeFile(path.join(projectDir, 'index.md'), projectMd);

    await db
      .insert(schema.projects)
      .values({
        id: 'proj-app-456',
        slug: 'my-app',
        title: 'My App',
        file_path: '03-projects/my-app/index.md',
        status: 'active',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      })
      .run();

    const f1 = path.join(root, 'design.txt');
    await writeFile(f1, 'design content');
    const imp1 = await importDrivePayload(root, db, f1, { title: 'Design Doc' });
    expect(imp1.ok).toBe(true);
    if (imp1.ok) {
      await setDriveItemPrimary(
        root,
        db,
        imp1.value.slug,
        { primaryType: 'project', entityRef: 'my-app' },
        false,
      );
    }

    const structure = aggregateDriveStructure(db);

    expect(structure.total_drive_items).toBe(1);

    const projectsFolder = structure.folders.find((f) => f.path === '020-projects');
    expect(projectsFolder?.total_items).toBe(1);
    expect(projectsFolder?.children).toHaveLength(1);
    expect(projectsFolder?.children[0]?.entity_slug).toBe('my-app');
    expect(projectsFolder?.children[0]?.entity_title).toBe('My App');
    expect(projectsFolder?.children[0]?.drive_item_count).toBe(1);
  });

  it('counts items in resources', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-struct-resources-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);

    const f1 = path.join(root, 'reference.txt');
    await writeFile(f1, 'reference content');
    const imp1 = await importDrivePayload(root, db, f1, {
      title: 'Reference',
      primary: { type: 'resource' },
    });
    expect(imp1.ok).toBe(true);

    const structure = aggregateDriveStructure(db);

    expect(structure.total_drive_items).toBe(1);

    const resourcesFolder = structure.folders.find((f) => f.path === '030-resources');
    expect(resourcesFolder?.total_items).toBe(1);
  });

  it('sorts children by slug alphabetically', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-struct-sort-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);

    const zebraMd = `---
id: area-zebra
slug: zebra
title: Zebra Area
status: active
created_at: "2025-01-01T00:00:00Z"
updated_at: "2025-01-01T00:00:00Z"
---
Body`;
    const zebraDir = path.join(root, '01-areas', 'zebra');
    await mkdir(zebraDir, { recursive: true });
    await writeFile(path.join(zebraDir, 'index.md'), zebraMd);

    const appleMd = `---
id: area-apple
slug: apple
title: Apple Area
status: active
created_at: "2025-01-01T00:00:00Z"
updated_at: "2025-01-01T00:00:00Z"
---
Body`;
    const appleDir = path.join(root, '01-areas', 'apple');
    await mkdir(appleDir, { recursive: true });
    await writeFile(path.join(appleDir, 'index.md'), appleMd);

    await db
      .insert(schema.areas)
      .values({
        id: 'area-zebra',
        slug: 'zebra',
        title: 'Zebra Area',
        file_path: '01-areas/zebra/index.md',
        status: 'active',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      })
      .run();
    await db
      .insert(schema.areas)
      .values({
        id: 'area-apple',
        slug: 'apple',
        title: 'Apple Area',
        file_path: '01-areas/apple/index.md',
        status: 'active',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      })
      .run();

    const f1 = path.join(root, 'file1.txt');
    await writeFile(f1, 'content1');
    const imp1 = await importDrivePayload(root, db, f1, { title: 'File 1' });
    expect(imp1.ok).toBe(true);
    if (imp1.ok) {
      await setDriveItemPrimary(
        root,
        db,
        imp1.value.slug,
        { primaryType: 'area', entityRef: 'zebra' },
        false,
      );
    }

    const f2 = path.join(root, 'file2.txt');
    await writeFile(f2, 'content2');
    const imp2 = await importDrivePayload(root, db, f2, { title: 'File 2' });
    expect(imp2.ok).toBe(true);
    if (imp2.ok) {
      await setDriveItemPrimary(
        root,
        db,
        imp2.value.slug,
        { primaryType: 'area', entityRef: 'apple' },
        false,
      );
    }

    const structure = aggregateDriveStructure(db);

    const areasFolder = structure.folders.find((f) => f.path === '010-areas');
    expect(areasFolder?.children).toHaveLength(2);
    expect(areasFolder?.children[0]?.entity_slug).toBe('apple');
    expect(areasFolder?.children[1]?.entity_slug).toBe('zebra');
  });
});

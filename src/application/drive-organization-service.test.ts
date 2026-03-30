import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { openAndMigrate } from '../infrastructure/db/open-database.js';
import { ensureCanonicalLayout } from '../infrastructure/workspace/create-layout.js';
import { validateSlug, moveDriveItem } from './drive-organization-service.js';
import { importDrivePayload } from './drive-vault-service.js';
import { reindexWorkspace } from '../infrastructure/indexing/reindex-workspace.js';
import * as schema from '../infrastructure/db/schema.js';
import { eq } from 'drizzle-orm';

describe('validateSlug', () => {
  it('accepts valid kebab-case slugs', () => {
    expect(validateSlug('my-file').ok).toBe(true);
    expect(validateSlug('annual-report-2024').ok).toBe(true);
    expect(validateSlug('test123').ok).toBe(true);
    expect(validateSlug('a1-b2-c3').ok).toBe(true);
  });

  it('rejects empty slugs', () => {
    const result = validateSlug('');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('empty');
    }
  });

  it('rejects slugs with invalid characters', () => {
    const result = validateSlug('Invalid Slug');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('kebab-case');
    }
  });

  it('rejects slugs with underscores', () => {
    const result = validateSlug('my_file');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('kebab-case');
    }
  });

  it('rejects slugs starting with hyphen', () => {
    const result = validateSlug('-my-file');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('kebab-case');
    }
  });

  it('rejects slugs ending with hyphen', () => {
    const result = validateSlug('my-file-');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('kebab-case');
    }
  });

  it('rejects slugs exceeding max length', () => {
    const longSlug = 'a'.repeat(121);
    const result = validateSlug(longSlug);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('too long');
    }
  });
});

describe('moveDriveItem', () => {
  it('renames a drive item slug', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-move-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);

    const f1 = path.join(root, 'original.txt');
    await writeFile(f1, 'content');
    const imp = await importDrivePayload(root, db, f1, { title: 'Original' });
    expect(imp.ok).toBe(true);
    if (!imp.ok) return;

    const result = await moveDriveItem(root, db, imp.value.slug, 'renamed-file');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.oldSlug).toBe(imp.value.slug);
    expect(result.value.newSlug).toBe('renamed-file');
    expect(result.value.newPath).toContain('renamed-file');

    const row = db
      .select()
      .from(schema.driveItems)
      .where(eq(schema.driveItems.id, result.value.driveItem.id))
      .get();
    expect(row?.slug).toBe('renamed-file');
  });

  it('returns same path when slug unchanged', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-move-same-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);

    const f1 = path.join(root, 'test.txt');
    await writeFile(f1, 'content');
    const imp = await importDrivePayload(root, db, f1, { title: 'Test' });
    expect(imp.ok).toBe(true);
    if (!imp.ok) return;

    const result = await moveDriveItem(root, db, imp.value.slug, imp.value.slug);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.oldSlug).toBe(imp.value.slug);
    expect(result.value.newSlug).toBe(imp.value.slug);
    expect(result.value.oldPath).toBe(result.value.newPath);
  });

  it('rejects duplicate slugs', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-move-dup-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);

    const f1 = path.join(root, 'file1.txt');
    await writeFile(f1, 'content1');
    const imp1 = await importDrivePayload(root, db, f1, { title: 'File 1' });
    expect(imp1.ok).toBe(true);
    if (!imp1.ok) return;

    const f2 = path.join(root, 'file2.txt');
    await writeFile(f2, 'content2');
    const imp2 = await importDrivePayload(root, db, f2, { title: 'File 2' });
    expect(imp2.ok).toBe(true);
    if (!imp2.ok) return;

    const result = await moveDriveItem(root, db, imp2.value.slug, imp1.value.slug);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('already exists');
    }
  });

  it('validates new slug format', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-move-invalid-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);

    const f1 = path.join(root, 'test.txt');
    await writeFile(f1, 'content');
    const imp = await importDrivePayload(root, db, f1, { title: 'Test' });
    expect(imp.ok).toBe(true);
    if (!imp.ok) return;

    const result = await moveDriveItem(root, db, imp.value.slug, 'Invalid Slug');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('kebab-case');
    }
  });

  it('dry-run does not modify anything', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-move-dry-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);

    const f1 = path.join(root, 'test.txt');
    await writeFile(f1, 'content');
    const imp = await importDrivePayload(root, db, f1, { title: 'Test' });
    expect(imp.ok).toBe(true);
    if (!imp.ok) return;

    const originalSlug = imp.value.slug;

    const result = await moveDriveItem(root, db, originalSlug, 'new-name', true);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.dryRun).toBe(true);
    expect(result.value.oldSlug).toBe(originalSlug);
    expect(result.value.newSlug).toBe('new-name');

    const row = db
      .select()
      .from(schema.driveItems)
      .where(eq(schema.driveItems.slug, originalSlug))
      .get();
    expect(row?.slug).toBe(originalSlug);
  });

  it('updates item.md slug field', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-move-md-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);

    const f1 = path.join(root, 'test.txt');
    await writeFile(f1, 'content');
    const imp = await importDrivePayload(root, db, f1, { title: 'Test' });
    expect(imp.ok).toBe(true);
    if (!imp.ok) return;

    const result = await moveDriveItem(root, db, imp.value.slug, 'updated-slug');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    await reindexWorkspace(root, db);

    const row = db
      .select()
      .from(schema.driveItems)
      .where(eq(schema.driveItems.slug, 'updated-slug'))
      .get();
    expect(row?.slug).toBe('updated-slug');
  });
});

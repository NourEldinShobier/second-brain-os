import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { openAndMigrate } from '../infrastructure/db/open-database.js';
import * as schema from '../infrastructure/db/schema.js';
import { ensureCanonicalLayout } from '../infrastructure/workspace/create-layout.js';
import { findOrphanIndexRows, pruneOrphanDriveItemRows } from './doctor-service.js';
import { importDrivePayload } from './drive-vault-service.js';

describe('doctor service (drive)', () => {
  it('finds and prunes orphan drive rows when item.md is missing', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-doc-drive-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);
    const src = path.join(root, 'f.txt');
    await writeFile(src, 'hi');
    const imp = await importDrivePayload(root, db, src, { title: 'Doc' });
    expect(imp.ok).toBe(true);
    if (!imp.ok) return;
    await rm(path.join(root, imp.value.relPath));
    const findings = findOrphanIndexRows(root, db);
    expect(findings.some((f) => f.category === 'drive_index_missing_file')).toBe(true);
    const n = pruneOrphanDriveItemRows(root, db);
    expect(n).toBe(1);
    expect(db.select().from(schema.driveItems).all().length).toBe(0);
  });

  it('finds drive items with missing files/ directory', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-doc-drive-pkg-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);
    const src = path.join(root, 'g.txt');
    await writeFile(src, 'hi');
    const imp = await importDrivePayload(root, db, src, { title: 'Pkg' });
    expect(imp.ok).toBe(true);
    if (!imp.ok) return;

    // Remove the files/ directory
    const pkgDir = path.join(root, '07-drive/items', imp.value.slug, 'files');
    await rm(pkgDir, { recursive: true });

    const findings = findOrphanIndexRows(root, db);
    expect(findings.some((f) => f.category === 'drive_payload_missing_directory')).toBe(true);
  });
});

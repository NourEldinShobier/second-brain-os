import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { importDrivePayload } from '../../application/drive-vault-service.js';
import { openAndMigrate } from '../db/open-database.js';
import { ensureCanonicalLayout } from '../workspace/create-layout.js';
import { searchWorkspaceMarkdown } from './workspace-search.js';

describe('workspace search (drive)', () => {
  it('finds drive items by title', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-search-drv-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);
    const src = path.join(root, 'f.txt');
    await writeFile(src, 'x');
    const imp = await importDrivePayload(root, db, src, { title: 'UniqueDriveTitleXYZ' });
    expect(imp.ok).toBe(true);
    if (!imp.ok) return;
    const hits = await searchWorkspaceMarkdown(root, 'uniquedrivetitlexyz', 20);
    const d = hits.find((h) => h.kind === 'drive_item');
    expect(d).toBeDefined();
    expect(d?.slug).toBe(imp.value.slug);
  });
});

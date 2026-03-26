import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { openAndMigrate } from '../db/open-database.js';
import * as schema from '../db/schema.js';
import { ensureCanonicalLayout } from '../workspace/create-layout.js';
import { reindexWorkspace } from './reindex-workspace.js';

describe('reindexWorkspace', () => {
  it('is idempotent and indexes starter-shaped area', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-reindex-'));
    await ensureCanonicalLayout(root);
    const areaMd = path.join(root, '01-areas', 'personal', 'index.md');
    await mkdir(path.dirname(areaMd), { recursive: true });
    await writeFile(
      areaMd,
      `---
second_brain:
  id: "11111111-1111-4111-8111-111111111111"
  kind: area
  version: 1
  slug: personal
  title: Personal
  status: active
  archived: false
---

Body.`,
      'utf8',
    );

    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);

    const a = await reindexWorkspace(root, db);
    expect(a.indexedFiles).toBe(1);
    expect(a.drift.filter((d) => d.category === 'duplicate_stable_id')).toHaveLength(0);

    const row = db.select().from(schema.areas).where(eq(schema.areas.id, '11111111-1111-4111-8111-111111111111')).get();
    expect(row?.slug).toBe('personal');

    const b = await reindexWorkspace(root, db);
    expect(b.indexedFiles).toBe(1);
    const row2 = db.select().from(schema.areas).where(eq(schema.areas.id, '11111111-1111-4111-8111-111111111111')).get();
    expect(row2?.slug).toBe('personal');
  });
});

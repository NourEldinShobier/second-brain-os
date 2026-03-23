import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { openAndMigrate } from '../infrastructure/db/open-database.js';
import * as schema from '../infrastructure/db/schema.js';
import { ensureCanonicalLayout } from '../infrastructure/workspace/create-layout.js';
import { MarkdownWorkspaceRepository } from '../infrastructure/markdown/markdown-repository.js';
import { MarkdownCaptureService } from './capture-service.js';
import { EntityCrudService } from './entity-crud-service.js';

describe('MarkdownCaptureService', () => {
  it('writes inbox Markdown and indexes raw_input in SQLite', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-capture-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);
    const repo = new MarkdownWorkspaceRepository(root);
    const entities = new EntityCrudService(repo, db);
    const capture = new MarkdownCaptureService(entities);

    const text = 'Buy milk\n\nLow-fat if possible.';
    const r = await capture.captureRaw({ text });
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }

    expect(r.value.title).toBe('Buy milk');
    expect(r.value.relativePath).toContain('00-inbox');
    expect(r.value.relativePath).toMatch(/\.md$/);

    const row = db.select().from(schema.inboxItems).where(eq(schema.inboxItems.id, r.value.inboxItemId)).get();
    expect(row?.raw_input).toBe(text);
    expect(row?.title).toBe('Buy milk');
  });

  it('rejects empty text', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-capture-empty-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);
    const repo = new MarkdownWorkspaceRepository(root);
    const entities = new EntityCrudService(repo, db);
    const capture = new MarkdownCaptureService(entities);

    const r = await capture.captureRaw({ text: '   \n  \t  ' });
    expect(r.ok).toBe(false);
    if (r.ok) {
      return;
    }
    expect(r.error.message).toContain('empty');
  });
});

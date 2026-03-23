import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EntityCrudService } from '../../application/entity-crud-service.js';
import { openAndMigrate } from '../db/open-database.js';
import { MarkdownWorkspaceRepository } from '../markdown/markdown-repository.js';
import { ensureCanonicalLayout } from '../workspace/create-layout.js';
import { findEntityByIdOrSlug } from './find-entity.js';

describe('findEntityByIdOrSlug', () => {
  it('resolves a unique slug', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-find-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);
    const repo = new MarkdownWorkspaceRepository(root);
    const entities = new EntityCrudService(repo, db);

    const area = await entities.createArea({ title: 'Only', slug: 'only-area' });
    expect(area.ok).toBe(true);
    if (!area.ok) {
      return;
    }

    const found = findEntityByIdOrSlug(db, 'only-area');
    expect(found.ok).toBe(true);
    if (!found.ok) {
      return;
    }
    expect(found.value.kind).toBe('area');
    expect(found.value.slug).toBe('only-area');
  });

  it('returns error when the same slug exists in multiple tables', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-find-dup-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);
    const repo = new MarkdownWorkspaceRepository(root);
    const entities = new EntityCrudService(repo, db);

    const a = await entities.createArea({ title: 'A', slug: 'dup' });
    expect(a.ok).toBe(true);
    if (!a.ok) {
      return;
    }
    const t = await entities.createTask({ title: 'T', slug: 'dup', areaIds: [a.value.meta.id] });
    expect(t.ok).toBe(true);

    const found = findEntityByIdOrSlug(db, 'dup');
    expect(found.ok).toBe(false);
    if (found.ok) {
      return;
    }
    expect(found.error).toContain('Ambiguous');
  });
});

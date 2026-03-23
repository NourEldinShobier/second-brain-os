import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MarkdownWorkspaceRepository } from './markdown-repository.js';

describe('MarkdownWorkspaceRepository', () => {
  it('writes, reads, and archives while preserving id', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sb-md-'));
    const repo = new MarkdownWorkspaceRepository(root);
    const meta = {
      id: '11111111-1111-4111-8111-111111111111',
      kind: 'task' as const,
      version: 1 as const,
      slug: 'demo-task',
      title: 'Demo',
      status: 'next',
      archived: false,
    };
    const rel = repo.activeEntityPath('task', 'demo-task');
    const w = await repo.writeEntity(rel, meta, 'Do the thing.');
    expect(w.ok).toBe(true);
    const r = await repo.readEntity(rel);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.meta.id).toBe(meta.id);
    }
    const a = await repo.archiveEntity(rel, 'task');
    expect(a.ok).toBe(true);
    if (a.ok) {
      const ar = await repo.readEntity(a.value.newRelativePath);
      expect(ar.ok).toBe(true);
      if (ar.ok) {
        expect(ar.value.meta.id).toBe(meta.id);
        expect(ar.value.meta.archived).toBe(true);
      }
    }
  });
});

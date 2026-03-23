import { access, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bootstrapWorkspaceDatabase } from './bootstrap.js';

describe('bootstrapWorkspaceDatabase', () => {
  it('creates sqlite file and applies migrations', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sb-db-'));
    const r = await bootstrapWorkspaceDatabase(root, '.second-brain/second-brain.db');
    expect(r.ok).toBe(true);
    await access(join(root, '.second-brain', 'second-brain.db'));
  });
});

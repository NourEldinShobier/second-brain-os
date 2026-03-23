import { access, mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CANONICAL_RELATIVE_DIRS } from './canonical-layout.js';
import { ensureCanonicalLayout } from './create-layout.js';

describe('ensureCanonicalLayout', () => {
  it('creates every canonical directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sb-layout-'));
    const result = await ensureCanonicalLayout(root);
    expect(result.ok).toBe(true);
    for (const rel of CANONICAL_RELATIVE_DIRS) {
      await access(join(root, rel));
    }
    const secondBrain = await readdir(join(root, '.second-brain'));
    expect(secondBrain).toEqual(expect.arrayContaining(['migrations', 'logs', 'cache']));
  });
});

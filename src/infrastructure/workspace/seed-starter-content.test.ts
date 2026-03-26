import { access, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ensureCanonicalLayout } from './create-layout.js';
import { ensureStarterContent } from './seed-starter-content.js';

describe('ensureStarterContent', () => {
  it('writes starter files once and stays idempotent', async () => {
    const root = await mkdtemp(join(tmpdir(), 'sb-seed-'));
    await ensureCanonicalLayout(root);
    const a = await ensureStarterContent(root);
    const b = await ensureStarterContent(root);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    await access(join(root, 'README.md'));
    const readme = await readFile(join(root, 'README.md'), 'utf8');
    expect(readme).toContain('PARA');
    await access(join(root, '01-areas/personal/index.md'));
    await access(join(root, '06-notes/how-your-second-brain-works/index.md'));
    await access(join(root, '00-inbox/2026-01-01-starter-capture/index.md'));
  });
});

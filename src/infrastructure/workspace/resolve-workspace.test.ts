import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveWorkspace } from './resolve-workspace.js';

const envKey = 'SECOND_BRAIN_WORKSPACE';

describe('resolveWorkspace', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function seedWorkspace(): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), 'second-brain-ws-'));
    const cfgPath = join(root, '.second-brain', 'config.yml');
    await mkdir(join(root, '.second-brain'), { recursive: true });
    await writeFile(
      cfgPath,
      ['schema_version: "1"', 'database_path: ".second-brain/second-brain.db"'].join('\n'),
      'utf8',
    );
    return root;
  }

  it('discovers workspace by walking up from cwd', async () => {
    const root = await seedWorkspace();
    const nested = join(root, 'a', 'b', 'c');
    await mkdir(nested, { recursive: true });
    const r = await resolveWorkspace({ cwd: nested });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.workspaceRoot).toBe(root);
    }
  });

  it('prefers --workspace over discovery', async () => {
    const root = await seedWorkspace();
    const other = await seedWorkspace();
    const r = await resolveWorkspace({ cwd: other, workspaceFlag: root });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.workspaceRoot).toBe(root);
    }
  });

  it('uses SECOND_BRAIN_WORKSPACE when set', async () => {
    const root = await seedWorkspace();
    vi.stubEnv(envKey, root);
    const r = await resolveWorkspace({ cwd: tmpdir(), envWorkspace: root });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.workspaceRoot).toBe(root);
    }
  });

  it('fails when no workspace exists', async () => {
    const r = await resolveWorkspace({ cwd: tmpdir() });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe('missing_workspace');
    }
  });
});

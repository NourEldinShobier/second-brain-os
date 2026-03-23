import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadWorkspaceConfigFile } from './load-workspace-config.js';

describe('loadWorkspaceConfigFile', () => {
  it('loads a minimal valid config', async () => {
    const root = await mkdtemp(join(tmpdir(), 'second-brain-ws-'));
    const cfgPath = join(root, '.second-brain', 'config.yml');
    await mkdir(join(root, '.second-brain'), { recursive: true });
    await writeFile(
      cfgPath,
      [
        'schema_version: "1"',
        'database_path: ".second-brain/second-brain.db"',
        'output_style: pretty',
        'ai_provider: null',
      ].join('\n'),
      'utf8',
    );

    const result = await loadWorkspaceConfigFile(cfgPath);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.schema_version).toBe('1');
      expect(result.value.database_path).toBe('.second-brain/second-brain.db');
      expect(result.value.output_style).toBe('pretty');
      expect(result.value.ai_provider).toBeNull();
    }
  });

  it('rejects invalid yaml', async () => {
    const root = await mkdtemp(join(tmpdir(), 'second-brain-ws-'));
    const cfgPath = join(root, '.second-brain', 'config.yml');
    await mkdir(join(root, '.second-brain'), { recursive: true });
    await writeFile(cfgPath, '{ broken', 'utf8');

    const result = await loadWorkspaceConfigFile(cfgPath);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('invalid_yaml');
    }
  });

  it('normalizes ai_provider openai from yaml (case-insensitive)', async () => {
    const root = await mkdtemp(join(tmpdir(), 'second-brain-ws-'));
    const cfgPath = join(root, '.second-brain', 'config.yml');
    await mkdir(join(root, '.second-brain'), { recursive: true });
    await writeFile(
      cfgPath,
      [
        'schema_version: "1"',
        'database_path: ".second-brain/second-brain.db"',
        'output_style: pretty',
        'ai_provider: OpenAI',
      ].join('\n'),
      'utf8',
    );

    const result = await loadWorkspaceConfigFile(cfgPath);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.ai_provider).toBe('openai');
    }
  });

  it('rejects schema validation failures', async () => {
    const root = await mkdtemp(join(tmpdir(), 'second-brain-ws-'));
    const cfgPath = join(root, '.second-brain', 'config.yml');
    await mkdir(join(root, '.second-brain'), { recursive: true });
    await writeFile(cfgPath, 'not_an_object: true\n', 'utf8');

    const result = await loadWorkspaceConfigFile(cfgPath);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('validation');
    }
  });

  it('rejects unsupported ai_provider values in yaml', async () => {
    const root = await mkdtemp(join(tmpdir(), 'second-brain-ws-'));
    const cfgPath = join(root, '.second-brain', 'config.yml');
    await mkdir(join(root, '.second-brain'), { recursive: true });
    await writeFile(
      cfgPath,
      [
        'schema_version: "1"',
        'database_path: ".second-brain/second-brain.db"',
        'output_style: pretty',
        'ai_provider: anthropic',
      ].join('\n'),
      'utf8',
    );

    const result = await loadWorkspaceConfigFile(cfgPath);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe('validation');
    }
  });
});

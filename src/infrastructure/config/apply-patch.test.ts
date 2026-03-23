import { describe, expect, it } from 'vitest';
import { mergeWorkspaceConfig, parseConfigSet } from './apply-patch.js';

const base = {
  schema_version: '1',
  database_path: '.second-brain/second-brain.db',
  output_style: 'pretty' as const,
  ai_provider: null as const,
};

describe('parseConfigSet', () => {
  it('parses output_style', () => {
    const r = parseConfigSet('output_style', 'json');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ output_style: 'json' });
  });

  it('rejects bad keys', () => {
    const r = parseConfigSet('nope', 'x');
    expect(r.ok).toBe(false);
  });
});

describe('mergeWorkspaceConfig', () => {
  it('merges patches and validates', () => {
    const r = mergeWorkspaceConfig(base, { output_style: 'markdown' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.output_style).toBe('markdown');
  });

  it('merges ai_provider openai', () => {
    const r = mergeWorkspaceConfig(base, { ai_provider: 'openai' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.ai_provider).toBe('openai');
  });
});

import { describe, expect, it } from 'vitest';
import { warningsWhenAiDisabled } from './ai-degraded-warnings.js';

describe('warningsWhenAiDisabled', () => {
  it('emits a warning when ai_provider is null', () => {
    const w = warningsWhenAiDisabled({
      schema_version: '1',
      database_path: '.second-brain/second-brain.db',
      output_style: 'pretty',
      ai_provider: null,
    });
    expect(w.length).toBe(1);
    expect(w[0]?.code).toBe('AI_PROVIDER_DISABLED');
  });

  it('is empty when a provider id is set', () => {
    expect(
      warningsWhenAiDisabled({
        schema_version: '1',
        database_path: '.second-brain/second-brain.db',
        output_style: 'pretty',
        ai_provider: 'openai',
      }).length,
    ).toBe(0);
  });
});

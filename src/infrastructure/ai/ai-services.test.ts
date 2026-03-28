import { describe, expect, it } from 'vitest';
import { createAiService } from './create-ai-service.js';

describe('createAiService', () => {
  it('uses DisabledAiService when ai_provider is null', async () => {
    const ai = createAiService(undefined, null);
    expect(ai.mode).toBe('disabled');
    expect(ai.providerId).toBeNull();
    const r = await ai.explain({ text: 'hello' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.text.length).toBeGreaterThan(0);
      expect(r.value.confidence).toBe(0);
    }
  });

  it('uses OpenAiStubAiService when ai_provider is openai', async () => {
    const ai = createAiService(undefined, 'openai');
    expect(ai.mode).toBe('stub');
    expect(ai.providerId).toBe('openai');
    const r = await ai.explain({ text: 'test input' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.text).toContain('not implemented');
      expect(r.value.confidence).toBe(0);
    }
  });
});

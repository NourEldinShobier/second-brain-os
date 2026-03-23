import { describe, expect, it } from 'vitest';
import * as schema from '../db/schema.js';
import { createTestWorkspace } from '../../test-support/workspace-fixture.js';
import { createAiService } from './create-ai-service.js';
import { OpenAiStubAiService } from './openai-stub-ai-service.js';

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

  it('OpenAiStubAiService logs explain operations to ai_operations', async () => {
    const ws = await createTestWorkspace({ ai_provider: 'openai' });
    try {
      const ai = new OpenAiStubAiService(ws.db);
      const r = await ai.explain({ text: 'x'.repeat(12) });
      expect(r.ok).toBe(true);

      const rows = ws.db.select().from(schema.aiOperations).all();
      expect(rows.length).toBe(1);
      expect(rows[0]?.action).toBe('explain');
      expect(rows[0]?.provider).toBe('openai');
      expect(rows[0]?.metadata_json).toContain('12');
    } finally {
      await ws.cleanup();
    }
  });
});

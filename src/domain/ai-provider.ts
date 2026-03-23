/** Only OpenAI is supported for AI-assisted features (see `ai_provider` in workspace config). */
export type AiProviderId = 'openai';

export function normalizeAiProviderCliValue(raw: string): { ok: true; value: AiProviderId | null } | { ok: false; error: string } {
  const t = raw.trim();
  if (t === '' || t.toLowerCase() === 'null') {
    return { ok: true, value: null };
  }
  if (t.toLowerCase() === 'openai') {
    return { ok: true, value: 'openai' };
  }
  return {
    ok: false,
    error: 'ai_provider must be null or openai (only OpenAI is supported).',
  };
}

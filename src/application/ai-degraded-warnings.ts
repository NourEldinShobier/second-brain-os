import type { WorkspaceConfig } from '../domain/config-model.js';
import type { Warning } from '../shared/envelope.js';

/**
 * Surfaces when no AI provider is configured so agents/users know flows use
 * heuristics and local metadata only (T-31 degraded mode).
 */
export function warningsWhenAiDisabled(config: WorkspaceConfig): readonly Warning[] {
  const p = config.ai_provider;
  if (p !== null && p.trim() !== '') {
    return [];
  }
  return [
    {
      code: 'AI_PROVIDER_DISABLED',
      message:
        'OpenAI is not configured (`ai_provider: openai`); using deterministic heuristics and indexed metadata only.',
    },
  ];
}

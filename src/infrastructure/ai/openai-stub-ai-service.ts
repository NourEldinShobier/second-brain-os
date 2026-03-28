import type { AiProviderId } from '../../domain/ai-provider.js';
import type { AiExplainResult, AiService } from '../../domain/services.js';
import type { Result } from '../../domain/result.js';
import { ok } from '../../domain/result.js';

/**
 * Placeholder OpenAI adapter until the official SDK is wired (`OPENAI_API_KEY`, chat completions, etc.).
 */
export class OpenAiStubAiService implements AiService {
  readonly mode = 'stub' as const;
  readonly providerId: AiProviderId = 'openai';

  explain(_input: { readonly text: string }): Promise<Result<AiExplainResult, { message: string }>> {
    return Promise.resolve(
      ok({
        text: 'OpenAI integration is not implemented yet — no API call was made. Set OPENAI_API_KEY when available.',
        confidence: 0,
        rationale: 'openai_stub_adapter',
      }),
    );
  }
}

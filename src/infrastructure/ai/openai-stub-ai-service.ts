import type { AiProviderId } from '../../domain/ai-provider.js';
import type { AiExplainResult, AiService } from '../../domain/services.js';
import type { Result } from '../../domain/result.js';
import { ok } from '../../domain/result.js';
import type { SecondBrainDb } from '../db/open-database.js';
import { logAiOperation } from './log-ai-operation.js';

/**
 * Placeholder OpenAI adapter until the official SDK is wired (`OPENAI_API_KEY`, chat completions, etc.).
 */
export class OpenAiStubAiService implements AiService {
  readonly mode = 'stub' as const;
  readonly providerId: AiProviderId = 'openai';

  constructor(private readonly db: SecondBrainDb | undefined) {}

  explain(input: { readonly text: string }): Promise<Result<AiExplainResult, { message: string }>> {
    logAiOperation(this.db, {
      provider: 'openai',
      action: 'explain',
      confidence: 0,
      rationale: 'openai_stub_adapter',
      metadata: { text_length: input.text.length },
    });
    return Promise.resolve(
      ok({
        text: 'OpenAI integration is not implemented yet — no API call was made. Set OPENAI_API_KEY when available.',
        confidence: 0,
        rationale: 'openai_stub_adapter',
      }),
    );
  }
}

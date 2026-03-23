import type { AiExplainResult, AiService } from '../../domain/services.js';
import type { Result } from '../../domain/result.js';
import { ok } from '../../domain/result.js';
/** No provider configured — deterministic / local metadata only. */
export class DisabledAiService implements AiService {
  readonly mode = 'disabled' as const;
  readonly providerId = null;

  explain(input: { readonly text: string }): Promise<Result<AiExplainResult, { message: string }>> {
    void input;
    return Promise.resolve(
      ok({
        text:
          'OpenAI is not enabled. Set `ai_provider: openai` in `.second-brain/config.yml` and `OPENAI_API_KEY` when the OpenAI integration is available.',
        confidence: 0,
        rationale: 'AI_DISABLED',
      }),
    );
  }
}

import type { AiProviderId } from '../../domain/ai-provider.js';
import type { AiService } from '../../domain/services.js';
import type { SecondBrainDb } from '../db/open-database.js';
import { DisabledAiService } from './disabled-ai-service.js';
import { OpenAiStubAiService } from './openai-stub-ai-service.js';

/** Only `openai` is supported; any other value is treated as disabled. */
export function createAiService(db: SecondBrainDb | undefined, aiProvider: AiProviderId | null | undefined): AiService {
  if (aiProvider !== 'openai') {
    return new DisabledAiService();
  }
  return new OpenAiStubAiService(db);
}

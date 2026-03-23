import type { AiProviderId } from './ai-provider.js';
import type { OutputFormat } from '../shared/output-format.js';

/**
 * Canonical on-disk config (see PRD §9).
 * Persisted at `<workspace>/.second-brain/config.yml`.
 */
export interface WorkspaceConfig {
  readonly schema_version: string;
  /** Optional override; normally inferred from the folder containing `.second-brain/`. */
  readonly workspace_root?: string;
  /** Path to SQLite DB, relative to workspace root unless absolute. */
  readonly database_path: string;
  readonly output_style: OutputFormat;
  /** `openai` enables OpenAI-backed features when wired; `null` keeps deterministic/local behavior only. */
  readonly ai_provider: AiProviderId | null;
}

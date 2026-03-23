import { randomUUID } from 'node:crypto';
import type { SecondBrainDb } from '../db/open-database.js';
import * as schema from '../db/schema.js';

export interface LogAiOperationInput {
  readonly provider: string | null;
  readonly action: string;
  readonly confidence?: number;
  readonly rationale?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Append a row to `ai_operations` (best-effort; never throws). */
export function logAiOperation(db: SecondBrainDb | undefined, input: LogAiOperationInput): void {
  if (db === undefined) {
    return;
  }
  const created = new Date().toISOString();
  try {
    db.insert(schema.aiOperations)
      .values({
        id: randomUUID(),
        provider: input.provider,
        action: input.action,
        confidence: input.confidence ?? null,
        rationale: input.rationale ?? null,
        metadata_json: input.metadata !== undefined ? JSON.stringify(input.metadata) : null,
        created_at: created,
      })
      .run();
  } catch {
    // Logging must not break user flows.
  }
}

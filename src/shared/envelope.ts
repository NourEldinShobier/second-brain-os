import type { ErrorCode } from './error-codes.js';

/**
 * JSON API schema for `second-brain-os --format json` and `--json`.
 *
 * **Version policy**
 * - Patch: documentation-only or non-output fixes.
 * - Minor: additive fields inside `data`, new optional `warnings` entries, new `next_actions` strings.
 * - Major: rename/remove envelope keys, change `ok` semantics, or change `errors`/`warnings` shape.
 *
 * Agent consumers should depend only on `ENVELOPE_STABLE_FIELDS` at the top level; treat `data` as
 * command-specific and version together with `schema_version`.
 */
export const SCHEMA_VERSION = '1.0.0';

export interface RecoverableError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface Warning {
  readonly code: string;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

/**
 * Standard agent-facing response envelope.
 * Stable fields: ok, schema_version, data, warnings, errors, next_actions.
 */
export interface JsonEnvelope<T = unknown> {
  readonly ok: boolean;
  readonly schema_version: typeof SCHEMA_VERSION;
  readonly data: T | null;
  readonly warnings: readonly Warning[];
  readonly errors: readonly RecoverableError[];
  readonly next_actions: readonly string[];
}

export function successEnvelope<T>(
  data: T,
  warnings: readonly Warning[] = [],
  nextActions: readonly string[] = [],
): JsonEnvelope<T> {
  return {
    ok: true,
    schema_version: SCHEMA_VERSION,
    data,
    warnings: [...warnings],
    errors: [],
    next_actions: [...nextActions],
  };
}

export function errorEnvelope(
  errors: readonly RecoverableError[],
  nextActions: readonly string[] = [],
  warnings: readonly Warning[] = [],
): JsonEnvelope<null> {
  return {
    ok: false,
    schema_version: SCHEMA_VERSION,
    data: null,
    warnings: [...warnings],
    errors: [...errors],
    next_actions: [...nextActions],
  };
}

/** Contract-stable field list for agent consumers (additive-only policy). */
export const ENVELOPE_STABLE_FIELDS = [
  'ok',
  'schema_version',
  'data',
  'warnings',
  'errors',
  'next_actions',
] as const;

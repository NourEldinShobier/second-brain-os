/**
 * Stable recoverable error codes for agents and JSON output.
 * Additive: new codes may appear; existing codes stay stable across patch releases.
 */
export const ErrorCodes = {
  MISSING_WORKSPACE: 'MISSING_WORKSPACE',
  MISSING_DB: 'MISSING_DB',
  UNRESOLVED_SLUG: 'UNRESOLVED_SLUG',
  AMBIGUOUS_MATCH: 'AMBIGUOUS_MATCH',
  INVALID_STATUS: 'INVALID_STATUS',
  AI_UNAVAILABLE: 'AI_UNAVAILABLE',
  VALIDATION: 'VALIDATION',
  INTERNAL: 'INTERNAL',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

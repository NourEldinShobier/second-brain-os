import type { ErrorCode } from './error-codes.js';
import type { RecoverableError } from './envelope.js';

export function recoverableError(
  code: ErrorCode,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): RecoverableError {
  return details === undefined
    ? { code, message }
    : { code, message, details };
}

import type { RecoverableError } from '../shared/envelope.js';
import { ErrorCodes } from '../shared/error-codes.js';
import { recoverableError } from '../shared/recoverable.js';
import type { WorkspaceResolveFailure } from '../infrastructure/workspace/resolve-workspace.js';

export function workspaceFailureToErrors(failure: WorkspaceResolveFailure): readonly RecoverableError[] {
  if (failure.kind === 'missing_workspace') {
    return [recoverableError(ErrorCodes.MISSING_WORKSPACE, failure.message)];
  }

  const e = failure.error;
  if (e.kind === 'missing_file') {
    return [recoverableError(ErrorCodes.MISSING_WORKSPACE, e.message, { path: e.path })];
  }
  if (e.kind === 'invalid_yaml') {
    return [recoverableError(ErrorCodes.VALIDATION, e.message, { path: e.path })];
  }
  return [recoverableError(ErrorCodes.VALIDATION, e.message, { path: e.path })];
}

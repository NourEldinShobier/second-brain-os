import type { Command } from 'commander';
import {
  resolveEntityByRef,
  type CoreEntityKind,
} from '../../infrastructure/relationships/resolve-entity-ref.js';
import { closeSecondBrainDatabase, openAndMigrate } from '../../infrastructure/db/open-database.js';
import { errorEnvelope, successEnvelope } from '../../shared/envelope.js';
import { ErrorCodes } from '../../shared/error-codes.js';
import { printJsonEnvelope } from '../../shared/print-envelope.js';
import { recoverableError } from '../../shared/recoverable.js';
import { cliFailed, emitQuietFallback } from '../cli-feedback.js';
import { commandContextFrom } from '../context.js';
import { isJsonOutput, shouldPrintHuman } from '../output-policy.js';
import { workspaceFailureToErrors } from '../map-workspace-failure.js';
import * as presentation from '../presentation/blocks.js';
import { resolveWorkspaceForCli } from '../workspace-resolve.js';

const VALID_ENTITY_TYPES: readonly CoreEntityKind[] = ['area', 'project', 'task', 'note', 'goal'];

function isValidEntityType(type: string): type is CoreEntityKind {
  return VALID_ENTITY_TYPES.includes(type as CoreEntityKind);
}

export async function runExists(command: Command, entityType: string, ref: string): Promise<void> {
  const ctx = commandContextFrom(command);
  const resolved = await resolveWorkspaceForCli(ctx);
  if (!resolved.ok) {
    cliFailed();
    const next = [
      'Create a workspace with `second-brain-os init`.',
      'Or set `--workspace` / `SECOND_BRAIN_WORKSPACE` to an existing workspace.',
    ];
    const errors = workspaceFailureToErrors(resolved.error);
    if (isJsonOutput(ctx)) printJsonEnvelope(errorEnvelope(errors, next));
    else emitQuietFallback(ctx, errors.map((e) => e.message).join('; '));
    return;
  }

  if (!isValidEntityType(entityType)) {
    cliFailed();
    const msg = `Invalid entity type: ${entityType}. Valid types: ${VALID_ENTITY_TYPES.join(', ')}`;
    const env = errorEnvelope([recoverableError(ErrorCodes.VALIDATION, msg)], []);
    if (isJsonOutput(ctx)) printJsonEnvelope(env);
    else if (shouldPrintHuman(ctx)) presentation.errorBlock(ctx, msg);
    else emitQuietFallback(ctx, msg);
    return;
  }

  const db = openAndMigrate(resolved.value.databaseAbsolutePath);
  try {
    const result = resolveEntityByRef(db, entityType, ref);

    if (result.ok) {
      const data = {
        exists: true,
        entity_type: entityType,
        slug: result.value.slug,
        id: result.value.id,
      };
      const env = successEnvelope(data, [], []);
      if (isJsonOutput(ctx)) printJsonEnvelope(env);
      else if (shouldPrintHuman(ctx)) {
        presentation.bodyLine(ctx, 'true');
      }
    } else {
      const data = {
        exists: false,
        entity_type: entityType,
        ref: ref,
      };
      const env = successEnvelope(data, [], []);
      if (isJsonOutput(ctx)) printJsonEnvelope(env);
      else if (shouldPrintHuman(ctx)) {
        presentation.bodyLine(ctx, 'false');
      }
    }
  } finally {
    closeSecondBrainDatabase(db);
  }
}

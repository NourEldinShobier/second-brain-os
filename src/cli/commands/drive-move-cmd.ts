import type { Command } from 'commander';
import { moveDriveItem, listDriveItemFiles } from '../../application/drive-organization-service.js';
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

export async function runDriveMove(
  command: Command,
  driveRef: string,
  opts: {
    slug: string;
    dryRun?: boolean;
  },
): Promise<void> {
  const ctx = commandContextFrom(command);
  const resolved = await resolveWorkspaceForCli(ctx);
  if (!resolved.ok) {
    cliFailed();
    const next = [
      'Create a workspace with `second-brain-os init`.',
      'Or set `--workspace` / `SECOND_BRAIN_WORKSPACE` to an existing workspace.',
    ];
    const errors = workspaceFailureToErrors(resolved.error);
    const env = errorEnvelope(errors, next);
    if (isJsonOutput(ctx)) printJsonEnvelope(env);
    else emitQuietFallback(ctx, errors.map((e) => e.message).join('; '));
    return;
  }

  const db = openAndMigrate(resolved.value.databaseAbsolutePath);
  try {
    const r = await moveDriveItem(
      resolved.value.workspaceRoot,
      db,
      driveRef,
      opts.slug,
      ctx.dryRun ?? false,
    );

    if (!r.ok) {
      cliFailed();
      const env = errorEnvelope([recoverableError(ErrorCodes.VALIDATION, r.error)], []);
      if (isJsonOutput(ctx)) printJsonEnvelope(env);
      else if (shouldPrintHuman(ctx)) presentation.errorBlock(ctx, r.error);
      else emitQuietFallback(ctx, r.error);
      return;
    }

    let filesToMove: string[] = [];
    if (ctx.dryRun) {
      const filesResult = await listDriveItemFiles(resolved.value.workspaceRoot, r.value.oldPath);
      if (filesResult.ok) {
        filesToMove = filesResult.value;
      }
    }

    const data = {
      drive_item: {
        id: r.value.driveItem.id,
        slug: r.value.driveItem.slug,
        title: r.value.driveItem.title,
        primary_link: {
          entity_type: r.value.driveItem.primary_entity_type,
          entity_slug: r.value.driveItem.primary_entity_slug,
        },
        item_path: r.value.driveItem.item_path,
        file_path: r.value.driveItem.file_path,
      },
      old_slug: r.value.oldSlug,
      new_slug: r.value.newSlug,
      old_path: r.value.oldPath,
      new_path: r.value.newPath,
      dry_run: r.value.dryRun,
      ...(filesToMove.length > 0 ? { files_to_move: filesToMove } : {}),
    };

    const env = successEnvelope(data, [], []);

    if (isJsonOutput(ctx)) printJsonEnvelope(env);
    else if (shouldPrintHuman(ctx)) {
      if (r.value.dryRun) {
        presentation.bodyLine(
          ctx,
          `[dry-run] Would rename drive item '${r.value.oldSlug}' to '${r.value.newSlug}'`,
        );
        presentation.bodyLine(ctx, `  From: ${r.value.oldPath}`);
        presentation.bodyLine(ctx, `  To:   ${r.value.newPath}`);
        if (filesToMove.length > 0) {
          presentation.bodyLine(ctx, `  Files: ${filesToMove.join(', ')}`);
        }
      } else if (r.value.oldSlug === r.value.newSlug) {
        presentation.bodyLine(ctx, `Drive item slug is already '${r.value.newSlug}'.`);
      } else {
        presentation.bodyLine(
          ctx,
          `Renamed drive item '${r.value.oldSlug}' to '${r.value.newSlug}'`,
        );
        presentation.bodyLine(ctx, `  From: ${r.value.oldPath}`);
        presentation.bodyLine(ctx, `  To:   ${r.value.newPath}`);
      }
    }
  } finally {
    closeSecondBrainDatabase(db);
  }
}

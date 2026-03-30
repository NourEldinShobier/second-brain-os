import type { Command } from 'commander';
import {
  setDriveItemPrimary,
  listDriveItemFiles,
} from '../../application/drive-organization-service.js';
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

export async function runDriveSetPrimary(
  command: Command,
  driveRef: string,
  opts: {
    area?: string;
    project?: string;
    inbox?: boolean;
    resource?: boolean;
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

  const primaryOptions = [opts.area, opts.project, opts.inbox, opts.resource].filter(Boolean);
  if (primaryOptions.length === 0) {
    cliFailed();
    const msg = 'Pass --area, --project, --inbox, or --resource.';
    const env = errorEnvelope([recoverableError(ErrorCodes.VALIDATION, msg)], []);
    if (isJsonOutput(ctx)) printJsonEnvelope(env);
    else if (shouldPrintHuman(ctx)) presentation.errorBlock(ctx, msg);
    else emitQuietFallback(ctx, msg);
    return;
  }

  if (primaryOptions.length > 1) {
    cliFailed();
    const msg = 'Pass only one of --area, --project, --inbox, or --resource.';
    const env = errorEnvelope([recoverableError(ErrorCodes.VALIDATION, msg)], []);
    if (isJsonOutput(ctx)) printJsonEnvelope(env);
    else if (shouldPrintHuman(ctx)) presentation.errorBlock(ctx, msg);
    else emitQuietFallback(ctx, msg);
    return;
  }

  const primaryType: 'area' | 'project' | 'resource' | 'inbox' = opts.inbox
    ? 'inbox'
    : opts.resource
      ? 'resource'
      : opts.area
        ? 'area'
        : 'project';

  const entityRef = opts.area || opts.project;

  const db = openAndMigrate(resolved.value.databaseAbsolutePath);
  try {
    const r = await setDriveItemPrimary(
      resolved.value.workspaceRoot,
      db,
      driveRef,
      { primaryType, ...(entityRef !== undefined ? { entityRef } : {}) },
      ctx.dryRun,
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
      old_path: r.value.oldPath,
      new_path: r.value.newPath,
      moved: r.value.moved,
      dry_run: r.value.dryRun,
      ...(filesToMove.length > 0 ? { files_to_move: filesToMove } : {}),
    };

    const env = successEnvelope(data, [], []);

    if (isJsonOutput(ctx)) printJsonEnvelope(env);
    else if (shouldPrintHuman(ctx)) {
      if (r.value.dryRun) {
        presentation.bodyLine(ctx, `[dry-run] Would move drive item '${r.value.driveItem.slug}'`);
        presentation.bodyLine(ctx, `  From: ${r.value.oldPath}`);
        presentation.bodyLine(ctx, `  To:   ${r.value.newPath}`);
        if (filesToMove.length > 0) {
          presentation.bodyLine(ctx, `  Files: ${filesToMove.join(', ')}`);
        }
      } else if (!r.value.moved) {
        presentation.bodyLine(
          ctx,
          `Drive item '${r.value.driveItem.slug}' is already in the target location.`,
        );
      } else {
        presentation.bodyLine(ctx, `Moved drive item '${r.value.driveItem.slug}'`);
        presentation.bodyLine(ctx, `  From: ${r.value.oldPath}`);
        presentation.bodyLine(ctx, `  To:   ${r.value.newPath}`);
      }
    }
  } finally {
    closeSecondBrainDatabase(db);
  }
}

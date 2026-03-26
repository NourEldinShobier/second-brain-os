import type { Command } from 'commander';
import path from 'node:path';
import {
  addEntityAsset,
  listEntityAssets,
  removeEntityAsset,
} from '../../application/entity-asset-service.js';
import { EntityCrudService } from '../../application/entity-crud-service.js';
import { closeSecondBrainDatabase, openAndMigrate } from '../../infrastructure/db/open-database.js';
import { MarkdownWorkspaceRepository } from '../../infrastructure/markdown/markdown-repository.js';
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

export async function runAssetAdd(
  command: Command,
  entity: string,
  file: string,
  opts: { title?: string; description?: string },
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
    const repo = new MarkdownWorkspaceRepository(resolved.value.workspaceRoot);
    const entities = new EntityCrudService(repo, db);
    const absFile = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
    const r = await addEntityAsset(db, entities, repo, entity, absFile, {
      ...(opts.title !== undefined ? { title: opts.title } : {}),
      ...(opts.description !== undefined ? { description: opts.description } : {}),
    });
    if (!r.ok) {
      cliFailed();
      const env = errorEnvelope([recoverableError(ErrorCodes.VALIDATION, r.error)], []);
      if (isJsonOutput(ctx)) printJsonEnvelope(env);
      else if (shouldPrintHuman(ctx)) presentation.errorBlock(ctx, r.error);
      else emitQuietFallback(ctx, r.error);
      return;
    }
    const env = successEnvelope(
      {
        asset: r.value.asset,
        entity_path: r.value.entityPath,
        workspace_root: resolved.value.workspaceRoot,
      },
      [],
      [],
    );
    if (isJsonOutput(ctx)) printJsonEnvelope(env);
    else if (shouldPrintHuman(ctx)) {
      presentation.bodyLine(ctx, `Added asset ${r.value.asset.path} (${r.value.asset.id})`);
    }
  } finally {
    closeSecondBrainDatabase(db);
  }
}

export async function runAssetList(command: Command, entity: string): Promise<void> {
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
  const db = openAndMigrate(resolved.value.databaseAbsolutePath);
  try {
    const r = listEntityAssets(db, entity);
    if (!r.ok) {
      cliFailed();
      const env = errorEnvelope([recoverableError(ErrorCodes.VALIDATION, r.error)], []);
      if (isJsonOutput(ctx)) printJsonEnvelope(env);
      else if (shouldPrintHuman(ctx)) presentation.errorBlock(ctx, r.error);
      else emitQuietFallback(ctx, r.error);
      return;
    }
    const env = successEnvelope(
      { assets: r.value, workspace_root: resolved.value.workspaceRoot },
      [],
      [],
    );
    if (isJsonOutput(ctx)) printJsonEnvelope(env);
    else if (shouldPrintHuman(ctx)) {
      if (r.value.length === 0) {
        presentation.bodyLine(ctx, 'No assets.');
      } else {
        for (const a of r.value) {
          presentation.bodyLine(
            ctx,
            `${a.id}  ${a.path_in_package}  ${a.original_filename}  (${a.mime_type})`,
          );
        }
      }
    }
  } finally {
    closeSecondBrainDatabase(db);
  }
}

export async function runAssetRemove(command: Command, entity: string, assetRef: string): Promise<void> {
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
  const db = openAndMigrate(resolved.value.databaseAbsolutePath);
  try {
    const repo = new MarkdownWorkspaceRepository(resolved.value.workspaceRoot);
    const entities = new EntityCrudService(repo, db);
    const r = await removeEntityAsset(db, entities, repo, entity, assetRef);
    if (!r.ok) {
      cliFailed();
      const env = errorEnvelope([recoverableError(ErrorCodes.VALIDATION, r.error)], []);
      if (isJsonOutput(ctx)) printJsonEnvelope(env);
      else if (shouldPrintHuman(ctx)) presentation.errorBlock(ctx, r.error);
      else emitQuietFallback(ctx, r.error);
      return;
    }
    const env = successEnvelope(
      { removed_id: r.value.removed_id, workspace_root: resolved.value.workspaceRoot },
      [],
      [],
    );
    if (isJsonOutput(ctx)) printJsonEnvelope(env);
    else if (shouldPrintHuman(ctx)) {
      presentation.bodyLine(ctx, `Removed asset ${r.value.removed_id}`);
    }
  } finally {
    closeSecondBrainDatabase(db);
  }
}

import type { Command } from 'commander';
import path from 'node:path';
import {
  applyDriveItemLinks,
  findDriveItemByRef,
  importDrivePayload,
  listDriveItems,
  loadDriveItemBody,
  parseDriveLinkClearKinds,
  updateDriveItemMetadata,
  type DriveListFilters,
} from '../../application/drive-vault-service.js';
import { closeSecondBrainDatabase, openAndMigrate } from '../../infrastructure/db/open-database.js';
import { DRIVE_PAYLOAD_DIR } from '../../infrastructure/workspace/canonical-layout.js';
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

export async function runDriveImport(
  command: Command,
  source: string,
  opts: { title?: string; description?: string; move?: boolean },
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
    const abs = path.isAbsolute(source) ? source : path.resolve(process.cwd(), source);
    const r = await importDrivePayload(resolved.value.workspaceRoot, db, abs, {
      ...(opts.title !== undefined ? { title: opts.title } : {}),
      ...(opts.description !== undefined ? { description: opts.description } : {}),
      ...(opts.move === true ? { move: true } : {}),
      ...(ctx.dryRun ? { dryRun: true } : {}),
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
        slug: r.value.slug,
        file_path: r.value.relPath,
        drive_item: r.value.meta,
        workspace_root: resolved.value.workspaceRoot,
        dry_run: ctx.dryRun,
      },
      [],
      [],
    );
    if (isJsonOutput(ctx)) printJsonEnvelope(env);
    else if (shouldPrintHuman(ctx)) {
      if (ctx.dryRun) {
        presentation.bodyLine(ctx, `[dry-run] Would import as ${r.value.slug} (${r.value.relPath})`);
      } else {
        presentation.bodyLine(ctx, `Imported drive item ${r.value.slug} (${r.value.relPath})`);
      }
    }
  } finally {
    closeSecondBrainDatabase(db);
  }
}

export async function runDriveList(
  command: Command,
  opts: {
    includeArchived?: boolean;
    area?: string[];
    project?: string[];
    task?: string[];
    note?: string[];
    goal?: string[];
    tag?: string[];
    standalone?: 'true' | 'false';
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
    if (isJsonOutput(ctx)) printJsonEnvelope(errorEnvelope(errors, next));
    else emitQuietFallback(ctx, errors.map((e) => e.message).join('; '));
    return;
  }
  const db = openAndMigrate(resolved.value.databaseAbsolutePath);
  try {
    const filters: DriveListFilters = {

      areaIds: opts.area !== undefined ? (opts.area.length > 0 ? opts.area : undefined) : undefined,
      projectIds: opts.project !== undefined ? (opts.project.length > 0 ? opts.project : undefined) : undefined,
      taskIds: opts.task !== undefined ? (opts.task.length > 0 ? opts.task : undefined) : undefined,
      noteIds: opts.note !== undefined ? (opts.note.length > 0 ? opts.note : undefined) : undefined,
      goalIds: opts.goal !== undefined ? (opts.goal.length > 0 ? opts.goal : undefined) : undefined,
      tags: opts.tag !== undefined ? (opts.tag.length > 0 ? opts.tag : undefined) : undefined,
      standalone: opts.standalone === 'true' ? true : opts.standalone === 'false' ? false : undefined,
    };
    const rows = listDriveItems(db, filters);
    const env = successEnvelope(
      { items: rows, workspace_root: resolved.value.workspaceRoot },
      [],
      [],
    );
    if (isJsonOutput(ctx)) printJsonEnvelope(env);
    else if (shouldPrintHuman(ctx)) {
      if (rows.length === 0) {
        presentation.bodyLine(ctx, 'No drive items.');
      } else {
        for (const row of rows) {
          presentation.bodyLine(
            ctx,
            `${row.slug}  ${row.title}  ${row.item_type}  ${row.file_path}`,
          );
        }
      }
    }
  } finally {
    closeSecondBrainDatabase(db);
  }
}

export async function runDriveShow(command: Command, ref: string, opts: { includeArchived?: boolean }): Promise<void> {
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
    const r = findDriveItemByRef(db, ref);
    if (!r.ok) {
      cliFailed();
      const env = errorEnvelope([recoverableError(ErrorCodes.VALIDATION, r.error)], []);
      if (isJsonOutput(ctx)) printJsonEnvelope(env);
      else if (shouldPrintHuman(ctx)) presentation.errorBlock(ctx, r.error);
      else emitQuietFallback(ctx, r.error);
      return;
    }
    const body = await loadDriveItemBody(resolved.value.workspaceRoot, r.value.file_path);
    const env = successEnvelope(
      {
        item: r.value,
        body: body.ok ? body.value : '',
        workspace_root: resolved.value.workspaceRoot,
      },
      [],
      [],
    );
    if (isJsonOutput(ctx)) printJsonEnvelope(env);
    else if (shouldPrintHuman(ctx)) {
      presentation.bodyLine(
        ctx,
        `${r.value.title} (${r.value.slug})  ${r.value.item_type}  ${r.value.file_path}`,
      );
      const payloadRel = path.join(path.dirname(r.value.file_path), DRIVE_PAYLOAD_DIR).replace(/\\/g, '/');
      presentation.bodyLine(ctx, `Payload: ${payloadRel}`);
      if (body.ok && body.value.trim().length > 0) {
        presentation.bodyLine(ctx, '');
        presentation.bodyLine(ctx, body.value);
      }
    }
  } finally {
    closeSecondBrainDatabase(db);
  }
}



export async function runDriveLink(
  command: Command,
  driveRef: string,
  opts: {
    readonly area?: string[];
    readonly project?: string[];
    readonly task?: string[];
    readonly note?: string[];
    readonly goal?: string[];
    readonly replace?: boolean;
    readonly clear?: string;
    readonly includeArchived?: boolean;
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
    if (isJsonOutput(ctx)) printJsonEnvelope(errorEnvelope(errors, next));
    else emitQuietFallback(ctx, errors.map((e) => e.message).join('; '));
    return;
  }
  const cleared = parseDriveLinkClearKinds(opts.clear);
  if (!cleared.ok) {
    cliFailed();
    const env = errorEnvelope([recoverableError(ErrorCodes.VALIDATION, cleared.error)], []);
    if (isJsonOutput(ctx)) printJsonEnvelope(env);
    else if (shouldPrintHuman(ctx)) presentation.errorBlock(ctx, cleared.error);
    else emitQuietFallback(ctx, cleared.error);
    return;
  }
  const db = openAndMigrate(resolved.value.databaseAbsolutePath);
  try {
    const r = await applyDriveItemLinks(
      resolved.value.workspaceRoot,
      db,
      driveRef,
      {
        append: {
          areas: opts.area ?? [],
          projects: opts.project ?? [],
          tasks: opts.task ?? [],
          notes: opts.note ?? [],
          goals: opts.goal ?? [],
        },
        replace: opts.replace === true,
        clearKinds: cleared.value,
        dryRun: ctx.dryRun,
      },
    );
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
        drive_item: r.value,
        workspace_root: resolved.value.workspaceRoot,
        dry_run: ctx.dryRun,
      },
      [],
      [],
    );
    if (isJsonOutput(ctx)) printJsonEnvelope(env);
    else if (shouldPrintHuman(ctx)) {
      if (ctx.dryRun) {
        presentation.bodyLine(ctx, '[dry-run] Would update links on drive item.');
      } else {
        presentation.bodyLine(ctx, 'Updated drive item links.');
      }
    }
  } finally {
    closeSecondBrainDatabase(db);
  }
}

export async function runDriveUpdate(
  command: Command,
  driveRef: string,
  opts: {
    readonly description?: string;
    readonly tag?: string[];
    readonly body?: string;
    readonly clearTags?: boolean;
    readonly includeArchived?: boolean;
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
    if (isJsonOutput(ctx)) printJsonEnvelope(errorEnvelope(errors, next));
    else emitQuietFallback(ctx, errors.map((e) => e.message).join('; '));
    return;
  }
  const patch: {
    description?: string | null;
    tags?: readonly string[];
    body?: string;
  } = {};
  if (opts.description !== undefined) {
    patch.description = opts.description;
  }
  if (opts.clearTags === true) {
    patch.tags = [];
  } else {
    const tags = opts.tag ?? [];
    if (tags.length > 0) {
      patch.tags = tags;
    }
  }
  if (opts.body !== undefined) {
    patch.body = opts.body;
  }
  const hasPatch =
    patch.description !== undefined || patch.tags !== undefined || patch.body !== undefined;
  if (!hasPatch) {
    cliFailed();
    const msg = 'Pass --description, --body, --tag, and/or --clear-tags.';
    const env = errorEnvelope([recoverableError(ErrorCodes.VALIDATION, msg)], []);
    if (isJsonOutput(ctx)) printJsonEnvelope(env);
    else if (shouldPrintHuman(ctx)) presentation.errorBlock(ctx, msg);
    else emitQuietFallback(ctx, msg);
    return;
  }
  const db = openAndMigrate(resolved.value.databaseAbsolutePath);
  try {
    const r = await updateDriveItemMetadata(
      resolved.value.workspaceRoot,
      db,
      driveRef,
      patch,
      { dryRun: ctx.dryRun },
    );
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
        drive_item: r.value,
        workspace_root: resolved.value.workspaceRoot,
        dry_run: ctx.dryRun,
      },
      [],
      [],
    );
    if (isJsonOutput(ctx)) printJsonEnvelope(env);
    else if (shouldPrintHuman(ctx)) {
      if (ctx.dryRun) {
        presentation.bodyLine(ctx, '[dry-run] Would update drive item metadata.');
      } else {
        presentation.bodyLine(ctx, 'Updated drive item metadata.');
      }
    }
  } finally {
    closeSecondBrainDatabase(db);
  }
}

import type { Command } from 'commander';
import {
  executeMigration,
  planMigration,
  type MigrationStrategy,
} from '../../application/drive-migration-service.js';
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

const VALID_STRATEGIES: MigrationStrategy[] = ['inbox', 'first-link'];

function isValidStrategy(value: string): value is MigrationStrategy {
  return VALID_STRATEGIES.includes(value as MigrationStrategy);
}

export async function runDriveMigrate(
  command: Command,
  opts: {
    strategy?: string;
    dryRun?: boolean;
    limit?: string;
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

  const strategy: MigrationStrategy = (opts.strategy ?? 'inbox') as MigrationStrategy;
  if (!isValidStrategy(strategy)) {
    cliFailed();
    const msg = `Invalid strategy: ${String(strategy)}. Valid strategies: ${VALID_STRATEGIES.join(', ')}`;
    const env = errorEnvelope([recoverableError(ErrorCodes.VALIDATION, msg)], []);
    if (isJsonOutput(ctx)) printJsonEnvelope(env);
    else if (shouldPrintHuman(ctx)) presentation.errorBlock(ctx, msg);
    else emitQuietFallback(ctx, msg);
    return;
  }

  const parsedLimit = opts.limit !== undefined ? parseInt(opts.limit, 10) : undefined;
  if (
    opts.limit !== undefined &&
    (parsedLimit === undefined || isNaN(parsedLimit) || parsedLimit <= 0)
  ) {
    cliFailed();
    const msg = `Invalid limit: ${String(opts.limit)}. Must be a positive integer.`;
    const env = errorEnvelope([recoverableError(ErrorCodes.VALIDATION, msg)], []);
    if (isJsonOutput(ctx)) printJsonEnvelope(env);
    else if (shouldPrintHuman(ctx)) presentation.errorBlock(ctx, msg);
    else emitQuietFallback(ctx, msg);
    return;
  }

  const limit = parsedLimit;

  const db = openAndMigrate(resolved.value.databaseAbsolutePath);
  try {
    const planResult = planMigration(db, strategy, limit !== undefined ? { limit } : undefined);
    if (!planResult.ok) {
      cliFailed();
      const env = errorEnvelope([recoverableError(ErrorCodes.VALIDATION, planResult.error)], []);
      if (isJsonOutput(ctx)) printJsonEnvelope(env);
      else if (shouldPrintHuman(ctx)) presentation.errorBlock(ctx, planResult.error);
      else emitQuietFallback(ctx, planResult.error);
      return;
    }

    const plans = planResult.value;

    if (opts.dryRun === true || ctx.dryRun) {
      const data = {
        strategy,
        dry_run: true,
        plans: plans.map((p) => ({
          slug: p.slug,
          old_path: p.oldPath,
          new_path: p.newPath,
          primary_type: p.primaryType,
          primary_entity_slug: p.primaryEntitySlug,
        })),
        total_count: plans.length,
      };
      const env = successEnvelope(data, [], []);
      if (isJsonOutput(ctx)) printJsonEnvelope(env);
      else if (shouldPrintHuman(ctx)) {
        presentation.heading(ctx, 'Migration Plan (dry-run)');
        presentation.bodyLine(ctx, `Strategy: ${strategy}`);
        presentation.bodyLine(ctx, `Items to migrate: ${String(plans.length)}`);
        presentation.bodyLine(ctx, '');
        for (const p of plans.slice(0, 20)) {
          presentation.bodyLine(
            ctx,
            `  ${p.slug}: ${p.oldPath} -> ${p.newPath} (${p.primaryType}${p.primaryEntitySlug ? `:${p.primaryEntitySlug}` : ''})`,
          );
        }
        if (plans.length > 20) {
          presentation.bodyLine(ctx, `  ... and ${String(plans.length - 20)} more`);
        }
      }
      return;
    }

    if (plans.length === 0) {
      const data = {
        strategy,
        migrated: [],
        skipped: [],
        total_migrated: 0,
        total_skipped: 0,
        message: 'No items to migrate',
      };
      const env = successEnvelope(data, [], []);
      if (isJsonOutput(ctx)) printJsonEnvelope(env);
      else if (shouldPrintHuman(ctx)) {
        presentation.heading(ctx, 'Migration Complete');
        presentation.bodyLine(ctx, 'No items to migrate.');
      }
      return;
    }

    const result = await executeMigration(resolved.value.workspaceRoot, db, plans);
    if (!result.ok) {
      cliFailed();
      const env = errorEnvelope([recoverableError(ErrorCodes.VALIDATION, result.error)], []);
      if (isJsonOutput(ctx)) printJsonEnvelope(env);
      else if (shouldPrintHuman(ctx)) presentation.errorBlock(ctx, result.error);
      else emitQuietFallback(ctx, result.error);
      return;
    }

    const migrated = result.value.filter((r) => r.status === 'migrated');
    const skipped = result.value.filter((r) => r.status === 'skipped');

    const data = {
      strategy,
      migrated: migrated.map((r) => ({
        slug: r.slug,
        old_path: r.oldPath,
        new_path: r.newPath,
        status: r.status,
      })),
      skipped: skipped.map((r) => ({
        slug: r.slug,
        old_path: r.oldPath,
        new_path: r.newPath,
        reason: r.reason,
      })),
      total_migrated: migrated.length,
      total_skipped: skipped.length,
    };

    const env = successEnvelope(data, [], []);
    if (isJsonOutput(ctx)) printJsonEnvelope(env);
    else if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'Migration Complete');
      presentation.bodyLine(ctx, `Strategy: ${strategy}`);
      presentation.bodyLine(ctx, `Migrated: ${String(migrated.length)}`);
      presentation.bodyLine(ctx, `Skipped: ${String(skipped.length)}`);
      if (skipped.length > 0) {
        presentation.bodyLine(ctx, '');
        presentation.bodyLine(ctx, 'Skipped items:');
        for (const s of skipped.slice(0, 10)) {
          presentation.bodyLine(ctx, `  ${s.slug}: ${s.reason ?? 'unknown'}`);
        }
        if (skipped.length > 10) {
          presentation.bodyLine(ctx, `  ... and ${String(skipped.length - 10)} more`);
        }
      }
    }
  } finally {
    closeSecondBrainDatabase(db);
  }
}

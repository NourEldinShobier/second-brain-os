import type { Command } from 'commander';
import { pruneOrphanIndexRows, runDoctorDiagnostics } from '../../application/doctor-service.js';
import { closeSecondBrainDatabase, openAndMigrate } from '../../infrastructure/db/open-database.js';
import { cliFailed, emitQuietFallback } from '../cli-feedback.js';
import { commandContextFrom } from '../context.js';
import { isJsonOutput, shouldPrintHuman } from '../output-policy.js';
import * as presentation from '../presentation/blocks.js';
import { errorEnvelope, successEnvelope } from '../../shared/envelope.js';
import { printJsonEnvelope } from '../../shared/print-envelope.js';
import { workspaceFailureToErrors } from '../map-workspace-failure.js';
import { resolveWorkspaceForCli } from '../workspace-resolve.js';

export interface DoctorCliOptions {
  readonly repair?: boolean;
}

export async function runDoctor(command: Command): Promise<void> {
  const ctx = commandContextFrom(command);
  const opts = command.opts<DoctorCliOptions>();
  const resolved = await resolveWorkspaceForCli(ctx);

  if (!resolved.ok) {
    cliFailed();
    const errors = workspaceFailureToErrors(resolved.error);
    const next = [
      'Create a workspace with `second-brain-os init`.',
      'Or set `--workspace` / `SECOND_BRAIN_WORKSPACE` to an existing workspace.',
    ];
    const env = errorEnvelope(errors, next);
    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return;
    }
    if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'doctor');
      for (const e of errors) {
        presentation.errorBlock(ctx, `${e.code}: ${e.message}`);
      }
      presentation.suggestions(ctx, next);
      return;
    }
    emitQuietFallback(ctx, errors.map((e) => e.message).join('; '));
    return;
  }

  const db = openAndMigrate(resolved.value.databaseAbsolutePath);
  try {
    const diagnostics = await runDoctorDiagnostics(resolved.value.workspaceRoot, db);

    let pruned = 0;
    if (opts.repair === true && !ctx.dryRun) {
      pruned = pruneOrphanIndexRows(resolved.value.workspaceRoot, db);
    }

    const errors = diagnostics.findings.filter((f) => f.severity === 'error');
    const warnings = diagnostics.findings.filter((f) => f.severity === 'warning');

    const data = {
      workspace_root: resolved.value.workspaceRoot,
      config_path: resolved.value.configPath,
      database_path: resolved.value.databaseAbsolutePath,
      schema_version: resolved.value.config.schema_version,
      indexed_files: diagnostics.indexed_files,
      finding_count: diagnostics.findings.length,
      error_count: errors.length,
      warning_count: warnings.length,
      findings: diagnostics.findings.map((f) => ({
        severity: f.severity,
        category: f.category,
        message: f.message,
        path: f.path ?? null,
        id: f.id ?? null,
        detail: f.detail ?? null,
      })),
      reindex_drift: diagnostics.reindex_drift,
      repair: opts.repair === true ? { pruned_orphan_index_rows: pruned, dry_run: ctx.dryRun } : null,
    };

    const nextActions: string[] = [
      'Run `second-brain-os doctor --repair` to re-sync from disk and prune orphan index rows for missing files.',
      'Broken link warnings may clear after reindex and prune; otherwise edit front matter or links.',
    ];
    const env = successEnvelope(data, [], nextActions);

    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return;
    }

    if (ctx.outputFormat === 'markdown') {
      console.log('## doctor\n');
      console.log(`- workspace: \`${data.workspace_root}\``);
      console.log(`- indexed files (this run): **${String(data.indexed_files)}**`);
      console.log(`- findings: **${String(data.finding_count)}** (${String(data.error_count)} errors, ${String(data.warning_count)} warnings)\n`);
      for (const f of diagnostics.findings) {
        console.log(`- **${f.severity}** [\`${f.category}\`] ${f.message}`);
      }
      if (opts.repair === true) {
        console.log(`\nRepair: pruned **${String(pruned)}** orphan index row(s).`);
      }
      console.log('');
      return;
    }

    if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'doctor');
      presentation.bodyLine(ctx, `Indexed files (scan): ${String(diagnostics.indexed_files)}`);
      presentation.bodyLine(
        ctx,
        `Findings: ${String(diagnostics.findings.length)} (${String(errors.length)} errors, ${String(warnings.length)} warnings)`,
      );
      for (const f of diagnostics.findings.slice(0, 40)) {
        presentation.bodyLine(ctx, `  [${f.severity}] ${f.category}: ${f.message}`);
      }
      if (diagnostics.findings.length > 40) {
        presentation.bodyLine(ctx, `  … and ${String(diagnostics.findings.length - 40)} more (use --format json)`);
      }
      if (opts.repair === true) {
        presentation.bodyLine(ctx, `Repair: pruned ${String(pruned)} orphan index row(s).`);
      }
      presentation.suggestions(ctx, env.next_actions);
    }
  } finally {
    closeSecondBrainDatabase(db);
  }
}

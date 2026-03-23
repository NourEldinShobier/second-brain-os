import type { Command } from 'commander';
import { cliFailed, emitQuietFallback } from '../cli-feedback.js';
import { commandContextFrom } from '../context.js';
import { isJsonOutput, shouldPrintHuman } from '../output-policy.js';
import * as presentation from '../presentation/blocks.js';
import { mergeWorkspaceConfig, parseConfigSet } from '../../infrastructure/config/apply-patch.js';
import { saveWorkspaceConfigFile } from '../../infrastructure/config/save-workspace-config.js';
import { errorEnvelope, successEnvelope } from '../../shared/envelope.js';
import { ErrorCodes } from '../../shared/error-codes.js';
import { printJsonEnvelope } from '../../shared/print-envelope.js';
import { recoverableError } from '../../shared/recoverable.js';
import { workspaceFailureToErrors } from '../map-workspace-failure.js';
import { resolveWorkspaceForCli } from '../workspace-resolve.js';

export async function runConfigShow(command: Command): Promise<void> {
  const ctx = commandContextFrom(command);
  const resolved = await resolveWorkspaceForCli(ctx);
  if (!resolved.ok) {
    cliFailed();
    const env = errorEnvelope(workspaceFailureToErrors(resolved.error), [
      'Run `second-brain-os init` or pass `--workspace`.',
    ]);
    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return;
    }
    if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'config show');
      for (const e of env.errors) {
        presentation.errorBlock(ctx, `${e.code}: ${e.message}`);
      }
      return;
    }
    emitQuietFallback(ctx, env.errors.map((e) => e.message).join('; '));
    return;
  }

  const c = resolved.value.config;
  const data = {
    workspace_root: resolved.value.workspaceRoot,
    config_path: resolved.value.configPath,
    database_path: resolved.value.databaseAbsolutePath,
    schema_version: c.schema_version,
    output_style: c.output_style,
    ai_provider: c.ai_provider,
    workspace_root_override: c.workspace_root ?? null,
  };

  const env = successEnvelope(data);
  if (isJsonOutput(ctx)) {
    printJsonEnvelope(env);
    return;
  }

  if (ctx.outputFormat === 'markdown') {
    console.log('## config\n');
    console.log(`- output_style: \`${c.output_style}\``);
    console.log(`- database_path (resolved): \`${resolved.value.databaseAbsolutePath}\``);
    console.log(`- ai_provider: \`${c.ai_provider ?? 'null'}\`\n`);
    return;
  }

  if (shouldPrintHuman(ctx)) {
    presentation.heading(ctx, 'config show');
    presentation.bodyLine(ctx, `Config file: ${resolved.value.configPath}`);
    presentation.bodyLine(ctx, `output_style: ${c.output_style}`);
    presentation.bodyLine(ctx, `database (resolved): ${resolved.value.databaseAbsolutePath}`);
    presentation.bodyLine(ctx, `ai_provider: ${c.ai_provider ?? 'null'}`);
  }
}

export async function runConfigSet(command: Command, key: string, value: string): Promise<void> {
  const ctx = commandContextFrom(command);
  const resolved = await resolveWorkspaceForCli(ctx);
  if (!resolved.ok) {
    cliFailed();
    const env = errorEnvelope(workspaceFailureToErrors(resolved.error));
    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return;
    }
    if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'config set');
      for (const e of env.errors) {
        presentation.errorBlock(ctx, `${e.code}: ${e.message}`);
      }
      return;
    }
    emitQuietFallback(ctx, env.errors.map((e) => e.message).join('; '));
    return;
  }

  const patch = parseConfigSet(key, value);
  if (!patch.ok) {
    cliFailed();
    const env = errorEnvelope([recoverableError(ErrorCodes.VALIDATION, patch.error)], [
      'Example: second-brain-os config set output_style json',
    ]);
    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return;
    }
    if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'config set');
      presentation.errorBlock(ctx, patch.error);
      presentation.suggestions(ctx, env.next_actions);
      return;
    }
    emitQuietFallback(ctx, patch.error);
    return;
  }

  const merged = mergeWorkspaceConfig(resolved.value.config, patch.value);
  if (!merged.ok) {
    cliFailed();
    const env = errorEnvelope([recoverableError(ErrorCodes.VALIDATION, merged.error)]);
    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return;
    }
    if (shouldPrintHuman(ctx)) {
      presentation.errorBlock(ctx, merged.error);
      return;
    }
    emitQuietFallback(ctx, merged.error);
    return;
  }

  if (ctx.dryRun) {
    const env = successEnvelope(
      {
        dry_run: true,
        key,
        would_write: resolved.value.configPath,
        config_preview: merged.value,
      },
      [],
      ['Run without --dry-run to persist.'],
    );
    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return;
    }
    if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'config set (dry run)');
      presentation.bodyLine(ctx, `Would update ${key} in ${resolved.value.configPath}`);
    }
    return;
  }

  const saved = await saveWorkspaceConfigFile(resolved.value.configPath, merged.value);
  if (!saved.ok) {
    cliFailed();
    const env = errorEnvelope([recoverableError(ErrorCodes.VALIDATION, saved.error.message)]);
    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return;
    }
    if (shouldPrintHuman(ctx)) {
      presentation.errorBlock(ctx, saved.error.message);
      return;
    }
    emitQuietFallback(ctx, saved.error.message);
    return;
  }

  const env = successEnvelope({ key, config: merged.value });
  if (isJsonOutput(ctx)) {
    printJsonEnvelope(env);
    return;
  }
  if (shouldPrintHuman(ctx)) {
    presentation.heading(ctx, 'config set');
    const preview =
      key === 'output_style'
        ? merged.value.output_style
        : key === 'database_path'
          ? merged.value.database_path
          : merged.value.ai_provider ?? 'null';
    presentation.bodyLine(ctx, `Updated ${key} â†’ ${preview}`);
  }
}

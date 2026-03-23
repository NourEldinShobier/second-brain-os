import * as p from '@clack/prompts';
import type { Command } from 'commander';
import { mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import type { WorkspaceConfig } from '../../domain/config-model.js';
import { loadWorkspaceConfigFile } from '../../infrastructure/config/load-workspace-config.js';
import { saveWorkspaceConfigFile } from '../../infrastructure/config/save-workspace-config.js';
import { ensureCanonicalLayout } from '../../infrastructure/workspace/create-layout.js';
import { bootstrapWorkspaceDatabase } from '../../infrastructure/db/bootstrap.js';
import { ensureStarterContent } from '../../infrastructure/workspace/seed-starter-content.js';
import { cliFailed, emitQuietFallback } from '../cli-feedback.js';
import { commandContextFrom } from '../context.js';
import { isJsonOutput, shouldPrintHuman } from '../output-policy.js';
import * as presentation from '../presentation/blocks.js';
import { errorEnvelope, successEnvelope } from '../../shared/envelope.js';
import { ErrorCodes } from '../../shared/error-codes.js';
import { printJsonEnvelope } from '../../shared/print-envelope.js';
import { recoverableError } from '../../shared/recoverable.js';

function emitInitError(
  ctx: ReturnType<typeof commandContextFrom>,
  message: string,
  nextActions: readonly string[],
): void {
  cliFailed();
  const env = errorEnvelope([recoverableError(ErrorCodes.VALIDATION, message)], nextActions);
  if (isJsonOutput(ctx)) {
    printJsonEnvelope(env);
    return;
  }
  if (shouldPrintHuman(ctx)) {
    presentation.heading(ctx, 'init');
    presentation.errorBlock(ctx, message);
    presentation.suggestions(ctx, nextActions);
    return;
  }
  emitQuietFallback(ctx, message);
}

function emitInitSuccess(
  ctx: ReturnType<typeof commandContextFrom>,
  workspaceRoot: string,
  configPath: string,
  alreadyInitialized: boolean,
): void {
  const data = {
    workspace_root: workspaceRoot,
    config_path: configPath,
    already_initialized: alreadyInitialized,
  };
  const env = successEnvelope(
    data,
    [],
    alreadyInitialized
      ? ['Your workspace was already configured; folder layout was repaired if needed.']
      : ['Try `second-brain-os capture "your note"` or `second-brain-os doctor` to verify paths.'],
  );

  if (isJsonOutput(ctx)) {
    printJsonEnvelope(env);
    return;
  }

  if (ctx.outputFormat === 'markdown') {
    console.log(`## init\n\n${alreadyInitialized ? 'Workspace already initialized.' : 'Workspace created.'}\n`);
    console.log(`- root: \`${workspaceRoot}\``);
    console.log(`- config: \`${configPath}\`\n`);
    return;
  }

  if (shouldPrintHuman(ctx)) {
    presentation.heading(ctx, 'init');
    presentation.bodyLine(
      ctx,
      alreadyInitialized
        ? 'Workspace already had a valid config. Folder layout was ensured.'
        : 'Your Second Brain OS workspace is ready.',
    );
    presentation.bodyLine(ctx, `Location: ${workspaceRoot}`);
    presentation.bodyLine(ctx, `Config: ${configPath}`);
    presentation.suggestions(ctx, env.next_actions);
  }
}

export async function runInit(command: Command): Promise<void> {
  const ctx = commandContextFrom(command);
  const cwd = process.cwd();

  let workspaceRoot: string;
  if (ctx.nonInteractive) {
    if (!ctx.workspaceFlag) {
      emitInitError(ctx, 'Non-interactive init requires --workspace <path>.', [
        'Example: second-brain-os init --non-interactive --workspace ./my-vault',
      ]);
      return;
    }
    workspaceRoot = path.resolve(cwd, ctx.workspaceFlag);
  } else {
    const suggested = ctx.workspaceFlag ? path.resolve(cwd, ctx.workspaceFlag) : cwd;
    const answer = await p.text({
      message: 'Where should your Second Brain OS workspace be created?',
      initialValue: suggested,
      placeholder: suggested,
    });
    if (p.isCancel(answer)) {
      emitInitError(ctx, 'Init cancelled.', []);
      return;
    }
    workspaceRoot = path.resolve(answer);
  }

  try {
    const s = await stat(workspaceRoot);
    if (s.isFile()) {
      emitInitError(ctx, `Path is a file, not a directory: ${workspaceRoot}`, [
        'Choose an empty folder or a path that does not exist yet.',
      ]);
      return;
    }
  } catch {
    await mkdir(workspaceRoot, { recursive: true });
  }

  const configPath = path.join(workspaceRoot, '.second-brain', 'config.yml');

  const existing = await loadWorkspaceConfigFile(configPath);
  if (existing.ok) {
    const layout = await ensureCanonicalLayout(workspaceRoot);
    if (!layout.ok) {
      emitInitError(ctx, layout.error.message, []);
      return;
    }
    const seeded = await ensureStarterContent(workspaceRoot);
    if (!seeded.ok) {
      emitInitError(ctx, seeded.error.message, []);
      return;
    }
    const db = await bootstrapWorkspaceDatabase(workspaceRoot, existing.value.database_path);
    if (!db.ok) {
      emitInitError(ctx, db.error, []);
      return;
    }
    emitInitSuccess(ctx, workspaceRoot, configPath, true);
    maybeOnboardingOutro(ctx);
    return;
  }

  if (existing.error.kind !== 'missing_file') {
    emitInitError(ctx, existing.error.message, [
      'Fix or remove the invalid config file, then run `second-brain-os init` again.',
    ]);
    return;
  }

  const layout = await ensureCanonicalLayout(workspaceRoot);
  if (!layout.ok) {
    emitInitError(ctx, layout.error.message, []);
    return;
  }

  const config: WorkspaceConfig = {
    schema_version: '1',
    database_path: '.second-brain/second-brain.db',
    output_style: 'pretty',
    ai_provider: null,
  };

  const saved = await saveWorkspaceConfigFile(configPath, config);
  if (!saved.ok) {
    emitInitError(ctx, saved.error.message, []);
    return;
  }

  const seeded = await ensureStarterContent(workspaceRoot);
  if (!seeded.ok) {
    emitInitError(ctx, seeded.error.message, []);
    return;
  }

  const db = await bootstrapWorkspaceDatabase(workspaceRoot, config.database_path);
  if (!db.ok) {
    emitInitError(ctx, db.error, []);
    return;
  }

  emitInitSuccess(ctx, workspaceRoot, configPath, false);
  maybeOnboardingOutro(ctx);
}

function maybeOnboardingOutro(ctx: ReturnType<typeof commandContextFrom>): void {
  if (ctx.nonInteractive || ctx.quiet || isJsonOutput(ctx) || ctx.outputFormat === 'markdown') {
    return;
  }
  p.outro('Starter README, area, note, and inbox capture are ready. Open README.md next.');
}

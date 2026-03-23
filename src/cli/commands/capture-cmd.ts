import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { Command } from 'commander';
import { warningsWhenAiDisabled } from '../../application/ai-degraded-warnings.js';
import type { TypedCaptureKind } from '../../application/typed-capture.js';
import { executeTypedCapture } from '../../application/typed-capture.js';
import { MarkdownCaptureService } from '../../application/capture-service.js';
import { EntityCrudService } from '../../application/entity-crud-service.js';
import { closeSecondBrainDatabase, openAndMigrate } from '../../infrastructure/db/open-database.js';
import { MarkdownWorkspaceRepository } from '../../infrastructure/markdown/markdown-repository.js';
import { errorEnvelope, successEnvelope, type JsonEnvelope } from '../../shared/envelope.js';
import { ErrorCodes } from '../../shared/error-codes.js';
import { printJsonEnvelope } from '../../shared/print-envelope.js';
import { recoverableError } from '../../shared/recoverable.js';
import { cliFailed, emitQuietFallback } from '../cli-feedback.js';
import { commandContextFrom } from '../context.js';
import { isJsonOutput, shouldPrintHuman } from '../output-policy.js';
import { workspaceFailureToErrors } from '../map-workspace-failure.js';
import * as presentation from '../presentation/blocks.js';
import { resolveWorkspaceForCli } from '../workspace-resolve.js';

export interface CaptureCliOptions {
  readonly type?: string;
  readonly title?: string;
  readonly body?: string;
  readonly bodyFile?: string;
  readonly slug?: string;
  readonly url?: string;
  readonly due?: string;
  readonly priority?: string;
  readonly notebook?: string;
  readonly energy?: string;
  readonly status?: string;
  readonly pinned?: boolean;
  readonly area?: string[];
  readonly project?: string[];
}

function normalizeCaptureKind(raw: string | undefined): 'inbox' | TypedCaptureKind | null {
  if (raw === undefined || raw.trim() === '') {
    return 'inbox';
  }
  const k = raw.trim().toLowerCase();
  if (k === 'inbox') {
    return 'inbox';
  }
  const allowed: readonly TypedCaptureKind[] = ['area', 'goal', 'project', 'task', 'resource', 'note'];
  if ((allowed as readonly string[]).includes(k)) {
    return k as TypedCaptureKind;
  }
  return null;
}

function parseTitleAndBody(
  opts: CaptureCliOptions,
  positional: string,
  bodyFromFile?: string,
): { readonly title: string; readonly body: string } {
  const titleOpt = opts.title?.trim();
  const bodyOpt = bodyFromFile !== undefined ? bodyFromFile : opts.body?.trim();
  if (titleOpt !== undefined && titleOpt.length > 0) {
    return {
      title: titleOpt,
      body: bodyOpt !== undefined && bodyOpt.length > 0 ? bodyOpt : positional,
    };
  }
  return {
    title: positional,
    body: bodyOpt !== undefined && bodyOpt.length > 0 ? bodyOpt : '',
  };
}

async function readCaptureBody(path: string): Promise<string> {
  if (path === '-') {
    return readFileSync(0, 'utf8');
  }
  return readFile(path, 'utf8');
}

function emitValidationError(
  ctx: ReturnType<typeof commandContextFrom>,
  message: string,
  next: readonly string[] = ['See `second-brain-os capture --help`.'],
): void {
  cliFailed();
  const env = errorEnvelope([recoverableError(ErrorCodes.VALIDATION, message)], next);
  if (isJsonOutput(ctx)) {
    printJsonEnvelope(env);
    return;
  }
  if (shouldPrintHuman(ctx)) {
    presentation.heading(ctx, 'capture');
    presentation.errorBlock(ctx, message);
    presentation.suggestions(ctx, next);
    return;
  }
  emitQuietFallback(ctx, message);
}

export async function runCapture(command: Command, textParts: readonly string[]): Promise<void> {
  const ctx = commandContextFrom(command);
  const opts = command.opts<CaptureCliOptions>();
  const positional = textParts.join(' ').trim();
  const kind = normalizeCaptureKind(opts.type);

  if (kind === null) {
    emitValidationError(ctx, `Unknown --type: ${opts.type ?? ''}. Use inbox, area, goal, project, task, resource, or note.`);
    return;
  }

  const hasBodyFlag = opts.body !== undefined && opts.body.trim() !== '';
  const bodyFilePath = opts.bodyFile?.trim();
  if (hasBodyFlag && bodyFilePath !== undefined && bodyFilePath !== '') {
    emitValidationError(ctx, 'Use either --body or --body-file, not both.');
    return;
  }

  let bodyFromFile: string | undefined;
  if (bodyFilePath !== undefined && bodyFilePath !== '') {
    try {
      bodyFromFile = await readCaptureBody(bodyFilePath);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      emitValidationError(ctx, `Could not read --body-file: ${msg}`);
      return;
    }
  }

  if (kind === 'inbox') {
    await runRawInboxCapture(ctx, opts, positional, bodyFromFile);
    return;
  }

  await runTypedCapture(ctx, kind, opts, positional, bodyFromFile);
}

async function runRawInboxCapture(
  ctx: ReturnType<typeof commandContextFrom>,
  _opts: CaptureCliOptions,
  joined: string,
  bodyFromFile?: string,
): Promise<void> {
  if (joined.length > 0 && bodyFromFile !== undefined) {
    emitValidationError(ctx, 'Pass either capture text or --body-file for inbox capture, not both.');
    return;
  }
  const joinedText = joined.length > 0 ? joined : (bodyFromFile ?? '');
  if (joinedText.length === 0) {
    emitValidationError(
      ctx,
      'Pass text to capture, e.g. `second-brain-os capture "Your note"`, `--body-file <path>`, or use `--type` for typed entities.',
    );
    return;
  }

  if (ctx.dryRun) {
    const env = successEnvelope(
      {
        dry_run: true,
        kind: 'inbox_item',
        preview_text: joinedText.length > 500 ? `${joinedText.slice(0, 500)}…` : joinedText,
      },
      [],
      ['Run without --dry-run to write the inbox item.'],
    );
    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return;
    }
    if (ctx.outputFormat === 'markdown') {
      console.log('## capture (dry run)\n');
      console.log(`Would capture ${String(joinedText.length)} characters.\n`);
      return;
    }
    if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'capture (dry run)');
      presentation.bodyLine(ctx, `Would save a new inbox item (${String(joinedText.length)} characters).`);
      presentation.suggestions(ctx, env.next_actions);
    }
    return;
  }

  const resolved = await resolveWorkspaceForCli(ctx);
  if (!resolved.ok) {
    cliFailed();
    const errors = workspaceFailureToErrors(resolved.error);
    const next = [
      'Run `second-brain-os init` to create a workspace.',
      'Or set `--workspace` / `SECOND_BRAIN_WORKSPACE` to an existing workspace.',
    ];
    const env = errorEnvelope(errors, next);
    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return;
    }
    if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'capture');
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
    const repo = new MarkdownWorkspaceRepository(resolved.value.workspaceRoot);
    const entities = new EntityCrudService(repo, db);
    const capture = new MarkdownCaptureService(entities);

    const result = await capture.captureRaw({ text: joinedText });
    if (!result.ok) {
      emitValidationError(ctx, result.error.message, ['Fix the input and retry.']);
      return;
    }

    const r = result.value;
    const data = {
      entity_id: r.inboxItemId,
      kind: 'inbox_item' as const,
      inbox_item_id: r.inboxItemId,
      slug: r.slug,
      relative_path: r.relativePath,
      title: r.title,
      workspace_root: resolved.value.workspaceRoot,
    };
    const env = successEnvelope(data, warningsWhenAiDisabled(resolved.value.config), [
      'Run `second-brain-os organize` when you are ready to classify this item.',
      'Run `second-brain-os doctor` to verify the workspace.',
    ]);

    emitCaptureSuccess(ctx, env, r.title, r.relativePath);
  } finally {
    closeSecondBrainDatabase(db);
  }
}

async function runTypedCapture(
  ctx: ReturnType<typeof commandContextFrom>,
  kind: TypedCaptureKind,
  opts: CaptureCliOptions,
  positional: string,
  bodyFromFile?: string,
): Promise<void> {
  const { title, body } = parseTitleAndBody(opts, positional, bodyFromFile);
  if (title.length === 0) {
    emitValidationError(
      ctx,
      `Provide a title (--title) or pass it as text, e.g. \`second-brain-os capture --type ${kind} "My title"\`.`,
    );
    return;
  }

  let priority: number | undefined;
  if (opts.priority !== undefined && opts.priority.trim() !== '') {
    const n = Number.parseInt(opts.priority, 10);
    if (Number.isNaN(n)) {
      emitValidationError(ctx, `Invalid --priority: ${opts.priority}`);
      return;
    }
    priority = n;
  }

  const areaRefs = opts.area ?? [];
  const projectRefs = opts.project ?? [];

  if (ctx.dryRun) {
    const env = successEnvelope(
      {
        dry_run: true,
        kind,
        title,
        body: body.length > 0 ? body : undefined,
        slug: opts.slug,
        area_refs: areaRefs,
        project_refs: projectRefs,
        url: opts.url,
        due: opts.due,
        priority,
        notebook: opts.notebook,
        energy: opts.energy,
        status: opts.status,
        pinned: opts.pinned,
      },
      [],
      ['Run without --dry-run to create the entity.'],
    );
    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return;
    }
    if (ctx.outputFormat === 'markdown') {
      console.log('## capture (dry run)\n');
      console.log(`- **type**: ${kind}`);
      console.log(`- **title**: ${title}\n`);
      return;
    }
    if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'capture (dry run)');
      presentation.bodyLine(ctx, `Would create ${kind}: ${title}`);
      presentation.suggestions(ctx, env.next_actions);
    }
    return;
  }

  const resolved = await resolveWorkspaceForCli(ctx);
  if (!resolved.ok) {
    cliFailed();
    const errors = workspaceFailureToErrors(resolved.error);
    const next = [
      'Run `second-brain-os init` to create a workspace.',
      'Or set `--workspace` / `SECOND_BRAIN_WORKSPACE` to an existing workspace.',
    ];
    const env = errorEnvelope(errors, next);
    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return;
    }
    if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'capture');
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
    const repo = new MarkdownWorkspaceRepository(resolved.value.workspaceRoot);
    const entities = new EntityCrudService(repo, db);

    const result = await executeTypedCapture(db, entities, {
      kind,
      title,
      body,
      slug: opts.slug?.trim() || undefined,
      areaRefs,
      projectRefs,
      url: opts.url?.trim() || undefined,
      due: opts.due?.trim() || undefined,
      priority,
      notebook: opts.notebook?.trim() || undefined,
      energy: opts.energy?.trim() || undefined,
      status: opts.status?.trim() || undefined,
      pinned: opts.pinned,
    });

    if (!result.ok) {
      emitValidationError(ctx, result.error, [
        'Check --area / --project references (slug or id).',
        'Goals and projects require at least one area.',
      ]);
      return;
    }

    const { path: relPath, meta } = result.value;
    const data = {
      entity_id: meta.id,
      kind: meta.kind,
      slug: meta.slug,
      relative_path: relPath,
      title: meta.title,
      workspace_root: resolved.value.workspaceRoot,
    };
    const env = successEnvelope(data, warningsWhenAiDisabled(resolved.value.config), [
      'Link or refine this item later with `second-brain-os organize` when available.',
      'Run `second-brain-os doctor` to verify indexing.',
    ]);

    emitCaptureSuccess(ctx, env, meta.title, relPath);
  } finally {
    closeSecondBrainDatabase(db);
  }
}

function emitCaptureSuccess(
  ctx: ReturnType<typeof commandContextFrom>,
  env: JsonEnvelope<Record<string, unknown>>,
  title: string,
  relativePath: string,
): void {
  if (isJsonOutput(ctx)) {
    printJsonEnvelope(env);
    return;
  }

  if (ctx.outputFormat === 'markdown') {
    const id =
      env.data !== null && typeof env.data === 'object' && 'entity_id' in env.data
        ? ((env.data as { entity_id?: string }).entity_id ?? '')
        : '';
    console.log('## capture\n');
    console.log(`- **title**: ${title}`);
    console.log(`- **path**: \`${relativePath}\``);
    console.log(`- **id**: \`${id}\`\n`);
    if (env.warnings.length > 0) {
      console.log('### Warnings\n');
      for (const w of env.warnings) {
        console.log(`- **${w.code}**: ${w.message}`);
      }
      console.log('');
    }
    return;
  }

  if (shouldPrintHuman(ctx)) {
    presentation.heading(ctx, 'capture');
    for (const w of env.warnings) {
      presentation.warningBlock(ctx, `${w.code}: ${w.message}`);
    }
    presentation.bodyLine(ctx, `Saved: ${relativePath}`);
    presentation.bodyLine(ctx, `Title: ${title}`);
    presentation.suggestions(ctx, env.next_actions);
  }
}

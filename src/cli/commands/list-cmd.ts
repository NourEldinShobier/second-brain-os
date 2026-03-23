import type { Command } from 'commander';
import { parseListEntityArg } from '../../domain/list-entity-arg.js';
import { openAndMigrate } from '../../infrastructure/db/open-database.js';
import { listEntitiesInIndex, type ListedEntityRow } from '../../infrastructure/query/list-entities.js';
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

export interface ListCliOptions {
  readonly status?: string;
  readonly includeArchived?: boolean;
  readonly limit?: string;
  readonly due?: string;
}

function parseLimit(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) {
    return fallback;
  }
  return n;
}

function emitListError(
  ctx: ReturnType<typeof commandContextFrom>,
  message: string,
  next: readonly string[],
): void {
  cliFailed();
  const env = errorEnvelope([recoverableError(ErrorCodes.VALIDATION, message)], next);
  if (isJsonOutput(ctx)) {
    printJsonEnvelope(env);
    return;
  }
  if (shouldPrintHuman(ctx)) {
    presentation.heading(ctx, 'list');
    presentation.errorBlock(ctx, message);
    presentation.suggestions(ctx, next);
    return;
  }
  emitQuietFallback(ctx, message);
}

function printMarkdownTable(kind: string, items: readonly ListedEntityRow[]): void {
  console.log(`## list: ${kind}\n`);
  if (items.length === 0) {
    console.log('_No matching entities._\n');
    return;
  }
  console.log('| slug | title | status | updated | path |');
  console.log('| --- | --- | --- | --- | --- |');
  for (const r of items) {
    const extra =
      r.kind === 'task' && (r.do_date !== null || r.priority !== null)
        ? ` (${[r.do_date ? `due ${r.do_date}` : '', r.priority !== null ? `p${String(r.priority)}` : '']
            .filter(Boolean)
            .join(', ')})`
        : '';
    console.log(
      `| \`${r.slug}\` | ${r.title.replace(/\|/gu, '\\|')}${extra} | ${r.status} | ${r.updated_at} | \`${r.file_path}\` |`,
    );
  }
  console.log('');
}

export async function runList(command: Command, entityArg: string | undefined): Promise<void> {
  const ctx = commandContextFrom(command);
  const opts = command.opts<ListCliOptions>();
  const kind = parseListEntityArg(entityArg);

  if (kind === null) {
    emitListError(
      ctx,
      'Specify what to list, e.g. `second-brain-os list tasks`, `second-brain-os list areas`, or `second-brain-os list inbox`.',
      [
        'Examples: `list tasks --status todo`, `list projects`, `list inbox`.',
        'Add `--include-archived` to show archived rows.',
      ],
    );
    return;
  }

  const includeArchived = opts.includeArchived === true;
  const limit = parseLimit(opts.limit, 100);
  const status = opts.status?.trim() || undefined;
  const dueDate = opts.due?.trim() || undefined;

  if (dueDate !== undefined && kind !== 'task') {
    emitListError(ctx, '`--due` applies only when listing tasks (`second-brain-os list tasks`).', [
      'Omit `--due` or use `second-brain-os list tasks --due YYYY-MM-DD`.',
    ]);
    return;
  }

  const resolved = await resolveWorkspaceForCli(ctx);
  if (!resolved.ok) {
    cliFailed();
    const errors = workspaceFailureToErrors(resolved.error);
    const next = [
      'Run `second-brain-os init` to create a workspace.',
      'Or set `--workspace` / `SECOND_BRAIN_WORKSPACE`.',
    ];
    const env = errorEnvelope(errors, next);
    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return;
    }
    if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'list');
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
  const items = listEntitiesInIndex(db, kind, {
    status,
    includeArchived,
    limit,
    dueDate,
  });

  const filters = {
    status: status ?? null,
    include_archived: includeArchived,
    limit,
    due: dueDate ?? null,
  };

  const data = {
    kind,
    filters,
    workspace_root: resolved.value.workspaceRoot,
    count: items.length,
    items: items.map((r) => ({
      id: r.id,
      kind: r.kind,
      slug: r.slug,
      title: r.title,
      status: r.status,
      file_path: r.file_path,
      archived: r.archived,
      updated_at: r.updated_at,
      priority: r.priority,
      do_date: r.do_date,
      energy: r.energy,
    })),
  };

  const env = successEnvelope(data, [], [
    'Use `second-brain-os show <slug or id>` when that command is available.',
    'Narrow with `--status` or `list tasks --due YYYY-MM-DD`.',
  ]);

  emitListOutput(ctx, env, kind, items);
}

function emitListOutput(
  ctx: ReturnType<typeof commandContextFrom>,
  env: JsonEnvelope<Record<string, unknown>>,
  kind: string,
  items: readonly ListedEntityRow[],
): void {
  if (isJsonOutput(ctx)) {
    printJsonEnvelope(env);
    return;
  }

  if (ctx.outputFormat === 'markdown') {
    printMarkdownTable(kind, items);
    return;
  }

  if (shouldPrintHuman(ctx)) {
    presentation.heading(ctx, `list ${kind}`);
    if (items.length === 0) {
      presentation.bodyLine(ctx, 'No matching entities.');
    } else {
      for (const r of items) {
        const taskBits =
          r.kind === 'task'
            ? [r.do_date ? `due ${r.do_date}` : '', r.priority !== null ? `pri ${String(r.priority)}` : '']
                .filter(Boolean)
                .join(' · ')
            : '';
        const suffix = taskBits.length > 0 ? `  (${taskBits})` : '';
        presentation.bodyLine(ctx, `${r.slug} — ${r.title}  [${r.status}]${suffix}`);
        presentation.bodyLine(ctx, `    ${r.file_path}`);
      }
    }
    presentation.suggestions(ctx, env.next_actions);
  }
}

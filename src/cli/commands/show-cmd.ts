import type { Command } from 'commander';
import { loadShowDetail } from '../../application/show-detail.js';
import { openAndMigrate } from '../../infrastructure/db/open-database.js';
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

export interface ShowCliOptions {
  readonly includeArchived?: boolean;
}

export async function runShow(command: Command, target: string): Promise<void> {
  const ctx = commandContextFrom(command);
  const opts = command.opts<ShowCliOptions>();
  const ref = target.trim();
  if (ref.length === 0) {
    cliFailed();
    const env = errorEnvelope(
      [recoverableError(ErrorCodes.VALIDATION, 'Pass a slug or stable id (from `second-brain-os list`).')],
      [],
    );
    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return;
    }
    if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'show');
      presentation.errorBlock(ctx, 'Missing target.');
      return;
    }
    emitQuietFallback(ctx, 'Missing target.');
    return;
  }

  const resolved = await resolveWorkspaceForCli(ctx);
  if (!resolved.ok) {
    cliFailed();
    const errors = workspaceFailureToErrors(resolved.error);
    const env = errorEnvelope(errors, ['Run `second-brain-os init` or set `--workspace`.']);
    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return;
    }
    if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'show');
      for (const e of errors) {
        presentation.errorBlock(ctx, `${e.code}: ${e.message}`);
      }
      return;
    }
    emitQuietFallback(ctx, errors.map((e) => e.message).join('; '));
    return;
  }

  const db = openAndMigrate(resolved.value.databaseAbsolutePath);
  const repo = new MarkdownWorkspaceRepository(resolved.value.workspaceRoot);
  const detail = await loadShowDetail(db, repo, ref, opts.includeArchived === true);
  if (!detail.ok) {
    cliFailed();
    const env = errorEnvelope([recoverableError(ErrorCodes.VALIDATION, detail.error)], []);
    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return;
    }
    if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'show');
      presentation.errorBlock(ctx, detail.error);
      return;
    }
    emitQuietFallback(ctx, detail.error);
    return;
  }

  const d = detail.value;
  const data = {
    entity: {
      id: d.row.id,
      kind: d.row.kind,
      slug: d.row.slug,
      title: d.row.title,
      status: d.row.status,
      archived: d.row.archived,
      file_path: d.row.file_path,
      updated_at: d.row.updated_at,
    },
    body: d.body,
    forward_links: d.forward.map((e) => ({
      to_kind: e.toEntityType,
      to_id: e.toEntityId,
      link_kind: e.linkKind,
    })),
    backlinks: d.backlinks.map((e) => ({
      from_kind: e.fromEntityType,
      from_id: e.fromEntityId,
      link_kind: e.linkKind,
    })),
    assets: d.assets.map((a) => ({
      id: a.id,
      path: a.path,
      original_filename: a.original_filename,
      mime_type: a.mime_type,
      imported_at: a.imported_at,
      title: a.title ?? null,
      description: a.description ?? null,
      sha256: a.sha256 ?? null,
    })),
    workspace_root: resolved.value.workspaceRoot,
  };
  const env = successEnvelope(data, [], ['Use `second-brain-os list inbox` when exploring.']);

  if (isJsonOutput(ctx)) {
    printJsonEnvelope(env);
    return;
  }
  if (ctx.outputFormat === 'markdown') {
    console.log('## show\n');
    console.log(`- **kind**: ${d.row.kind}`);
    console.log(`- **title**: ${d.row.title}`);
    console.log(`- **status**: ${d.row.status}`);
    console.log(`- **path**: \`${d.row.file_path}\``);
    console.log(`- **id**: \`${d.row.id}\``);
    if (d.assets.length > 0) {
      console.log(`\n### Assets\n`);
      for (const a of d.assets) {
        console.log(`- \`${a.path}\` — ${a.title ?? a.original_filename}`);
      }
    }
    console.log(`\n### Body\n\n${d.body}\n`);
    return;
  }
  if (shouldPrintHuman(ctx)) {
    presentation.heading(ctx, 'show');
    presentation.bodyLine(ctx, `${d.row.kind} ${d.row.slug} — ${d.row.title}`);
    presentation.bodyLine(ctx, `Status: ${d.row.status}  ${d.row.archived ? '(archived)' : ''}`);
    presentation.bodyLine(ctx, `Path: ${d.row.file_path}`);
    presentation.bodyLine(ctx, `Links out: ${String(d.forward.length)} · Backlinks: ${String(d.backlinks.length)}`);
    if (d.assets.length > 0) {
      presentation.bodyLine(ctx, `Assets (${String(d.assets.length)}):`);
      for (const a of d.assets) {
        const label = a.title ?? a.original_filename;
        presentation.bodyLine(ctx, `  • ${a.path} — ${label}`);
      }
    }
    presentation.bodyLine(ctx, '');
    presentation.bodyLine(ctx, d.body.slice(0, 2000) + (d.body.length > 2000 ? '…' : ''));
    presentation.suggestions(ctx, env.next_actions);
  }
}

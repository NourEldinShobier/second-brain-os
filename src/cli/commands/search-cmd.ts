import type { Command } from 'commander';
import { expandSearchHitsWithLinks, searchWorkspaceMarkdown } from '../../infrastructure/search/workspace-search.js';
import { openAndMigrate } from '../../infrastructure/db/open-database.js';
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

export interface SearchCliOptions {
  readonly limit?: string;
  readonly expand?: boolean;
}

export async function runSearch(command: Command, queryParts: readonly string[]): Promise<void> {
  const ctx = commandContextFrom(command);
  const opts = command.opts<SearchCliOptions>();
  const q = queryParts.join(' ').trim();
  if (q.length === 0) {
    cliFailed();
    const env = errorEnvelope(
      [recoverableError(ErrorCodes.VALIDATION, 'Pass a search query, e.g. `second-brain-os search health`.')],
      [],
    );
    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return;
    }
    if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'search');
      presentation.errorBlock(ctx, 'Empty query.');
      return;
    }
    emitQuietFallback(ctx, 'Empty query.');
    return;
  }

  const limit = Number.parseInt(opts.limit ?? '50', 10);
  const lim = Number.isNaN(limit) ? 50 : limit;

  const resolved = await resolveWorkspaceForCli(ctx);
  if (!resolved.ok) {
    cliFailed();
    const errors = workspaceFailureToErrors(resolved.error);
    const env = errorEnvelope(errors, []);
    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return;
    }
    if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'search');
      for (const e of errors) {
        presentation.errorBlock(ctx, `${e.code}: ${e.message}`);
      }
      return;
    }
    emitQuietFallback(ctx, errors.map((e) => e.message).join('; '));
    return;
  }

  const hits = await searchWorkspaceMarkdown(resolved.value.workspaceRoot, q, lim);
  const db = openAndMigrate(resolved.value.databaseAbsolutePath);
  const expanded = opts.expand === true ? expandSearchHitsWithLinks(db, hits) : [];

  const data = {
    query: q,
    count: hits.length,
    workspace_root: resolved.value.workspaceRoot,
    hits: hits.map((h) => ({
      kind: h.kind,
      id: h.id,
      slug: h.slug,
      title: h.title,
      file_path: h.file_path,
      match: h.match,
    })),
    ...(opts.expand === true ? { expanded_links: expanded } : {}),
  };
  const env = successEnvelope(data, [], ['Try `second-brain-os show <slug>` for full detail.']);

  if (isJsonOutput(ctx)) {
    printJsonEnvelope(env);
    return;
  }
  if (ctx.outputFormat === 'markdown') {
    console.log('## search\n');
    console.log(`Query: **${q}**\n`);
    for (const h of hits) {
      console.log(`- \`${h.kind}\` **${h.slug}** — ${h.title} (${h.match})`);
    }
    console.log('');
    return;
  }
  if (shouldPrintHuman(ctx)) {
    presentation.heading(ctx, 'search');
    if (hits.length === 0) {
      presentation.bodyLine(ctx, 'No matches.');
    }
    for (const h of hits) {
      presentation.bodyLine(ctx, `${h.kind} ${h.slug} — ${h.title} (${h.match})`);
    }
    if (opts.expand === true && expanded.length > 0) {
      presentation.bodyLine(ctx, `Expanded links: ${String(expanded.length)}`);
    }
    presentation.suggestions(ctx, env.next_actions);
  }
}

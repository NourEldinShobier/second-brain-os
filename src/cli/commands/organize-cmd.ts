import type { Command } from 'commander';
import { warningsWhenAiDisabled } from '../../application/ai-degraded-warnings.js';
import type { ReclassifyTargetKind } from '../../domain/organize/reclassify-meta.js';
import type { SecondBrainMeta } from '../../domain/markdown/second-brain-meta.js';
import { ok } from '../../domain/result.js';
import { promoteInboxItem, analyzeInboxItems, type PromoteTargetKind } from '../../application/organize-service.js';
import { EntityCrudService } from '../../application/entity-crud-service.js';
import { openAndMigrate } from '../../infrastructure/db/open-database.js';
import { MarkdownWorkspaceRepository } from '../../infrastructure/markdown/markdown-repository.js';
import { resolveAreaIds, resolveProjectIds } from '../../infrastructure/relationships/resolve-entity-ref.js';
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

const PROMOTE_KINDS: readonly PromoteTargetKind[] = ['area', 'task', 'note', 'resource', 'goal', 'project'];

function parsePromoteKind(raw: string | undefined): PromoteTargetKind | null {
  if (raw === undefined || raw.trim() === '') {
    return null;
  }
  const k = raw.trim().toLowerCase();
  return (PROMOTE_KINDS as readonly string[]).includes(k) ? (k as PromoteTargetKind) : null;
}

function emitValidation(
  ctx: ReturnType<typeof commandContextFrom>,
  message: string,
  next: readonly string[] = [],
): void {
  cliFailed();
  const env = errorEnvelope([recoverableError(ErrorCodes.VALIDATION, message)], next);
  if (isJsonOutput(ctx)) {
    printJsonEnvelope(env);
    return;
  }
  if (shouldPrintHuman(ctx)) {
    presentation.heading(ctx, 'organize');
    presentation.errorBlock(ctx, message);
    if (next.length > 0) {
      presentation.suggestions(ctx, next);
    }
    return;
  }
  emitQuietFallback(ctx, message);
}

async function openWorkspace(ctx: ReturnType<typeof commandContextFrom>) {
  const resolved = await resolveWorkspaceForCli(ctx);
  if (!resolved.ok) {
    cliFailed();
    const errors = workspaceFailureToErrors(resolved.error);
    const next = ['Run `second-brain-os init` or set `--workspace`.'];
    const env = errorEnvelope(errors, next);
    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return null;
    }
    if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'organize');
      for (const e of errors) {
        presentation.errorBlock(ctx, `${e.code}: ${e.message}`);
      }
      presentation.suggestions(ctx, next);
      return null;
    }
    emitQuietFallback(ctx, errors.map((e) => e.message).join('; '));
    return null;
  }
  const db = openAndMigrate(resolved.value.databaseAbsolutePath);
  const repo = new MarkdownWorkspaceRepository(resolved.value.workspaceRoot);
  const entities = new EntityCrudService(repo, db);
  return { ...resolved.value, db, repo, entities };
}

export async function runOrganizeAnalyze(
  opts: { readonly limit?: string },
  command: Command,
): Promise<void> {
  const ctx = commandContextFrom(command);
  const limit = Number.parseInt(opts.limit ?? '20', 10);
  const lim = Number.isNaN(limit) ? 20 : limit;

  const ws = await openWorkspace(ctx);
  if (!ws) {
    return;
  }

  const rows = await analyzeInboxItems(ws.db, ws.repo, lim);
  const data = {
    inbox_items: rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      file_path: r.file_path,
      title: r.title,
      likely_kind: r.heuristic.likelyKind,
      confidence: r.heuristic.confidence,
      reasons: r.heuristic.reasons,
    })),
    count: rows.length,
    workspace_root: ws.workspaceRoot,
  };
  const env = successEnvelope(data, warningsWhenAiDisabled(ws.config), [
    'Use `second-brain-os organize promote --from <slug|id> --to <kind>` to materialize a typed entity.',
    'Low-confidence items stay in inbox until you decide.',
  ]);

  if (isJsonOutput(ctx)) {
    printJsonEnvelope(env);
    return;
  }
  if (ctx.outputFormat === 'markdown') {
    console.log('## organize analyze\n');
    if (env.warnings.length > 0) {
      console.log('### Warnings\n');
      for (const w of env.warnings) {
        console.log(`- **${w.code}**: ${w.message}`);
      }
      console.log('');
    }
    for (const r of rows) {
      console.log(`- **${r.slug}**: likely \`${r.heuristic.likelyKind}\` (${r.heuristic.confidence})`);
      console.log(`  - ${r.heuristic.reasons.join(' ')}`);
    }
    console.log('');
    return;
  }
  if (shouldPrintHuman(ctx)) {
    presentation.heading(ctx, 'organize analyze');
    for (const w of env.warnings) {
      presentation.warningBlock(ctx, `${w.code}: ${w.message}`);
    }
    if (rows.length === 0) {
      presentation.bodyLine(ctx, 'No inbox items in the index.');
    }
    for (const r of rows) {
      presentation.bodyLine(
        ctx,
        `${r.slug}: ${r.heuristic.likelyKind} (${r.heuristic.confidence}) — ${r.heuristic.reasons.join(' ')}`,
      );
    }
    presentation.suggestions(ctx, env.next_actions);
  }
}

export async function runOrganizePromote(
  opts: {
    readonly from?: string;
    readonly to?: string;
    readonly area?: string[];
    readonly project?: string[];
  },
  command: Command,
): Promise<void> {
  const ctx = commandContextFrom(command);
  const from = opts.from?.trim();
  const to = parsePromoteKind(opts.to);
  if (from === undefined || from.length === 0) {
    emitValidation(ctx, 'Pass --from <inbox slug or id>.');
    return;
  }
  if (to === null) {
    emitValidation(ctx, `Pass --to one of: ${PROMOTE_KINDS.join(', ')}.`);
    return;
  }

  if (ctx.dryRun) {
    const env = successEnvelope(
      { dry_run: true, from, to, area_refs: opts.area ?? [], project_refs: opts.project ?? [] },
      [],
      ['Run without --dry-run to promote.'],
    );
    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return;
    }
    if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'organize promote (dry run)');
      presentation.bodyLine(ctx, `Would promote ${from} → ${to}`);
      presentation.suggestions(ctx, env.next_actions);
    }
    return;
  }

  const ws = await openWorkspace(ctx);
  if (!ws) {
    return;
  }

  const result = await promoteInboxItem(ws.db, ws.repo, ws.entities, {
    fromRef: from,
    toKind: to,
    areaRefs: opts.area ?? [],
    projectRefs: opts.project ?? [],
  });
  if (!result.ok) {
    emitValidation(ctx, result.error, [
      'Goals/projects need `--area`. Tasks can use `--area` / `--project`.',
    ]);
    return;
  }

  const data = {
    entity_id: result.value.id,
    kind: result.value.kind,
    relative_path: result.value.path,
    workspace_root: ws.workspaceRoot,
  };
  const env = successEnvelope(data, [], ['The inbox file was removed after successful promotion.']);
  if (isJsonOutput(ctx)) {
    printJsonEnvelope(env);
    return;
  }
  if (shouldPrintHuman(ctx)) {
    presentation.heading(ctx, 'organize promote');
    presentation.bodyLine(ctx, `Created ${result.value.kind}: ${result.value.path}`);
    presentation.suggestions(ctx, env.next_actions);
  }
}

export async function runOrganizeRename(
  opts: { readonly path?: string; readonly title?: string; readonly slug?: string },
  command: Command,
): Promise<void> {
  const ctx = commandContextFrom(command);
  const rel = opts.path?.trim();
  if (rel === undefined || rel.length === 0) {
    emitValidation(ctx, 'Pass --path <workspace-relative path to .md>.');
    return;
  }
  if (opts.title === undefined && opts.slug === undefined) {
    emitValidation(ctx, 'Pass at least one of --title or --slug.');
    return;
  }
  if (ctx.dryRun) {
    const env = successEnvelope({ dry_run: true, path: rel, title: opts.title, slug: opts.slug }, [], []);
    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return;
    }
    if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'organize rename (dry run)');
      presentation.bodyLine(ctx, `Would update ${rel}`);
    }
    return;
  }

  const ws = await openWorkspace(ctx);
  if (!ws) {
    return;
  }

  const r = await ws.entities.renameEntity(rel, {
    ...(opts.title !== undefined ? { title: opts.title } : {}),
    ...(opts.slug !== undefined ? { slug: opts.slug } : {}),
  });
  if (!r.ok) {
    emitValidation(ctx, r.error);
    return;
  }
  const env = successEnvelope(
    { path: r.value.path, title: r.value.meta.title, slug: r.value.meta.slug },
    [],
    ['Run `second-brain-os doctor` if the index looks stale.'],
  );
  if (isJsonOutput(ctx)) {
    printJsonEnvelope(env);
    return;
  }
  if (shouldPrintHuman(ctx)) {
    presentation.heading(ctx, 'organize rename');
    presentation.bodyLine(ctx, `Updated: ${r.value.path}`);
    presentation.suggestions(ctx, env.next_actions);
  }
}

export async function runOrganizeLink(
  opts: { readonly path?: string; readonly area?: string[]; readonly project?: string[] },
  command: Command,
): Promise<void> {
  const ctx = commandContextFrom(command);
  const rel = opts.path?.trim();
  if (rel === undefined || rel.length === 0) {
    emitValidation(ctx, 'Pass --path <workspace-relative path>.');
    return;
  }
  const areas = opts.area ?? [];
  const projects = opts.project ?? [];
  if (areas.length === 0 && projects.length === 0) {
    emitValidation(ctx, 'Pass at least one --area or --project reference.');
    return;
  }

  const ws = await openWorkspace(ctx);
  if (!ws) {
    return;
  }

  const read = await ws.entities.readEntity(rel);
  if (!read.ok) {
    emitValidation(ctx, read.error);
    return;
  }

  const areaIds = areas.length > 0 ? resolveAreaIds(ws.db, areas) : ok([] as readonly string[]);
  if (!areaIds.ok) {
    emitValidation(ctx, areaIds.error);
    return;
  }
  const projectIds = projects.length > 0 ? resolveProjectIds(ws.db, projects) : ok([] as readonly string[]);
  if (!projectIds.ok) {
    emitValidation(ctx, projectIds.error);
    return;
  }

  const m = read.value.meta;
  const nextArea = [...new Set([...(m.area_ids ?? []), ...areaIds.value])];
  const nextProj = [...new Set([...(m.project_ids ?? []), ...projectIds.value])];

  const patch: Partial<Omit<SecondBrainMeta, 'id' | 'kind' | 'version'>> = {};
  if (nextArea.length > 0) {
    patch.area_ids = nextArea;
  }
  if (nextProj.length > 0) {
    patch.project_ids = nextProj;
  }

  if (ctx.dryRun) {
    const env = successEnvelope({ dry_run: true, path: rel, area_ids: nextArea, project_ids: nextProj }, [], []);
    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return;
    }
    if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'organize link (dry run)');
      presentation.bodyLine(ctx, `Would set area_ids and project_ids on ${rel}`);
    }
    return;
  }

  const up = await ws.entities.updateEntity(rel, patch);
  if (!up.ok) {
    emitValidation(ctx, up.error);
    return;
  }
  const env = successEnvelope({ path: rel, entity_id: up.value.id, kind: up.value.kind }, [], []);
  if (isJsonOutput(ctx)) {
    printJsonEnvelope(env);
    return;
  }
  if (shouldPrintHuman(ctx)) {
    presentation.heading(ctx, 'organize link');
    presentation.bodyLine(ctx, `Updated links for ${rel}`);
    presentation.suggestions(ctx, env.next_actions);
  }
}

function parseReclassifyKind(raw: string | undefined): ReclassifyTargetKind | null {
  if (raw === undefined || raw.trim() === '') {
    return null;
  }
  const k = raw.trim().toLowerCase();
  if (k === 'note' || k === 'resource' || k === 'task') {
    return k;
  }
  return null;
}

export async function runOrganizeReclassify(
  opts: { readonly path?: string; readonly to?: string },
  command: Command,
): Promise<void> {
  const ctx = commandContextFrom(command);
  const rel = opts.path?.trim();
  const to = parseReclassifyKind(opts.to);
  if (rel === undefined || rel.length === 0) {
    emitValidation(ctx, 'Pass --path <workspace-relative path>.');
    return;
  }
  if (to === null) {
    emitValidation(ctx, 'Pass --to one of: note, resource, task.');
    return;
  }

  if (ctx.dryRun) {
    const env = successEnvelope({ dry_run: true, path: rel, to }, [], ['Run without --dry-run to reclassify.']);
    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return;
    }
    if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'organize reclassify (dry run)');
      presentation.bodyLine(ctx, `Would reclassify ${rel} → ${to}`);
      presentation.suggestions(ctx, env.next_actions);
    }
    return;
  }

  const ws = await openWorkspace(ctx);
  if (!ws) {
    return;
  }

  const result = await ws.entities.reclassifyEntity(rel, to);
  if (!result.ok) {
    emitValidation(ctx, result.error, [
      'Only note, resource, and task can be reclassified with this command.',
      'Use `organize promote` for inbox items.',
    ]);
    return;
  }

  const data = {
    entity_id: result.value.meta.id,
    kind: result.value.meta.kind,
    relative_path: result.value.path,
    workspace_root: ws.workspaceRoot,
  };
  const env = successEnvelope(data, [], ['Run `second-brain-os doctor` if links or index look wrong.']);
  if (isJsonOutput(ctx)) {
    printJsonEnvelope(env);
    return;
  }
  if (shouldPrintHuman(ctx)) {
    presentation.heading(ctx, 'organize reclassify');
    presentation.bodyLine(ctx, `Now ${result.value.meta.kind}: ${result.value.path}`);
    presentation.suggestions(ctx, env.next_actions);
  }
}

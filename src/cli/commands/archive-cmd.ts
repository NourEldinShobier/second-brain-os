import type { Command } from 'commander';
import type { ListableEntityKind } from '../../domain/listable-kind.js';
import { EntityCrudService } from '../../application/entity-crud-service.js';
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

function parseListableKind(raw: string | undefined): ListableEntityKind | null {
  if (raw === undefined || raw.trim() === '') {
    return null;
  }
  const k = raw.trim().toLowerCase();
  const map: Record<string, ListableEntityKind> = {
    area: 'area',
    goal: 'goal',
    project: 'project',
    task: 'task',
    resource: 'resource',
    note: 'note',
    inbox: 'inbox_item',
    inbox_item: 'inbox_item',
  };
  return map[k] ?? null;
}

export interface ArchiveCliOptions {
  readonly restore?: boolean;
  readonly reason?: string;
}

export async function runArchive(
  command: Command,
  kindArg: string | undefined,
  slugArg: string | undefined,
): Promise<void> {
  const ctx = commandContextFrom(command);
  const opts = command.opts<ArchiveCliOptions>();
  const kind = parseListableKind(kindArg);
  const slug = slugArg?.trim() ?? '';

  if (kind === null) {
    cliFailed();
    const env = errorEnvelope(
      [
        recoverableError(
          ErrorCodes.VALIDATION,
          'Specify kind: area | goal | project | task | resource | note | inbox',
        ),
      ],
      ['Example: `second-brain-os archive task my-task-slug`'],
    );
    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return;
    }
    if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'archive');
      presentation.errorBlock(ctx, 'Missing or invalid kind.');
      return;
    }
    emitQuietFallback(ctx, 'Missing or invalid kind.');
    return;
  }

  if (slug.length === 0) {
    cliFailed();
    const env = errorEnvelope(
      [recoverableError(ErrorCodes.VALIDATION, 'Specify entity slug.')],
      ['Example: `second-brain-os archive task book-dentist`'],
    );
    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return;
    }
    if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'archive');
      presentation.errorBlock(ctx, 'Missing slug.');
      return;
    }
    emitQuietFallback(ctx, 'Specify entity slug.');
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
      presentation.heading(ctx, 'archive');
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
  const entities = new EntityCrudService(repo, db);

  const restoring = opts.restore === true;
  const reason = opts.reason?.trim();

  if (ctx.dryRun) {
    const env = successEnvelope(
      {
        dry_run: true,
        restore: restoring,
        kind,
        slug,
        reason: reason ?? null,
      },
      [],
      ['Run without --dry-run to apply.'],
    );
    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return;
    }
    if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'archive (dry run)');
      presentation.bodyLine(ctx, `${restoring ? 'Would restore' : 'Would archive'} ${kind} \`${slug}\``);
    }
    return;
  }

  const result = restoring
    ? await entities.restoreEntityBySlug(kind, slug)
    : await entities.archiveEntityBySlug(kind, slug, reason !== undefined ? { reason } : undefined);

  if (!result.ok) {
    cliFailed();
    const env = errorEnvelope([recoverableError(ErrorCodes.VALIDATION, result.error)], []);
    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return;
    }
    if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'archive');
      presentation.errorBlock(ctx, result.error);
      return;
    }
    emitQuietFallback(ctx, result.error);
    return;
  }

  const data = {
    restore: restoring,
    kind,
    slug: result.value.meta.slug,
    entity_id: result.value.meta.id,
    path: result.value.path,
    workspace_root: resolved.value.workspaceRoot,
  };
  const env = successEnvelope(data, [], ['Run `second-brain-os doctor` if the index looks inconsistent.']);

  if (isJsonOutput(ctx)) {
    printJsonEnvelope(env);
    return;
  }
  if (ctx.outputFormat === 'markdown') {
    console.log(`## archive\n\n- **${restoring ? 'Restored' : 'Archived'}** \`${kind}\` **${result.value.meta.slug}**\n- Path: \`${result.value.path}\`\n`);
    return;
  }
  if (shouldPrintHuman(ctx)) {
    presentation.heading(ctx, 'archive');
    presentation.bodyLine(
      ctx,
      `${restoring ? 'Restored' : 'Archived'} ${kind} ${result.value.meta.slug} â†’ ${result.value.path}`,
    );
    presentation.suggestions(ctx, env.next_actions);
  }
}

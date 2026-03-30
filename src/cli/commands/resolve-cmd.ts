import type { Command } from 'commander';
import { eq, and } from 'drizzle-orm';
import {
  resolveEntityParent,
  type ParentResolution,
} from '../../application/entity-parent-resolution.js';
import {
  resolveEntityByRef,
  countEntityChildren,
  type CoreEntityKind,
} from '../../infrastructure/relationships/resolve-entity-ref.js';
import { closeSecondBrainDatabase, openAndMigrate } from '../../infrastructure/db/open-database.js';
import * as schema from '../../infrastructure/db/schema.js';
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
import type { SecondBrainDb } from '../../infrastructure/db/open-database.js';

function formatEntityType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function getAncestors(
  db: SecondBrainDb,
  resolution: ParentResolution,
): Array<{ type: string; slug: string; title: string }> {
  if (!resolution.parent) return [];

  if (resolution.parent.type === 'project') {
    const rows = db
      .select()
      .from(schema.entityLinks)
      .where(
        and(
          eq(schema.entityLinks.from_entity_type, 'project'),
          eq(schema.entityLinks.from_entity_id, resolution.parent.id),
          eq(schema.entityLinks.to_entity_type, 'area'),
        ),
      )
      .all();

    if (rows.length > 0) {
      const firstRow = rows[0];
      if (firstRow) {
        const area = db
          .select()
          .from(schema.areas)
          .where(eq(schema.areas.id, firstRow.to_entity_id))
          .get();
        if (area) {
          return [{ type: 'area', slug: area.slug, title: area.title }];
        }
      }
    }
  }

  return [];
}

export async function runResolveParent(
  command: Command,
  opts: {
    task?: string;
    note?: string;
    goal?: string;
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
    const env = errorEnvelope(errors, next);
    if (isJsonOutput(ctx)) printJsonEnvelope(env);
    else emitQuietFallback(ctx, errors.map((e) => e.message).join('; '));
    return;
  }

  const entityOptions = [opts.task, opts.note, opts.goal].filter(Boolean);
  if (entityOptions.length !== 1) {
    cliFailed();
    const msg = 'Exactly one of --task, --note, --goal is required.';
    const env = errorEnvelope([recoverableError(ErrorCodes.VALIDATION, msg)], []);
    if (isJsonOutput(ctx)) printJsonEnvelope(env);
    else if (shouldPrintHuman(ctx)) presentation.errorBlock(ctx, msg);
    else emitQuietFallback(ctx, msg);
    return;
  }

  const entityType: 'task' | 'note' | 'goal' = opts.task ? 'task' : opts.note ? 'note' : 'goal';
  const entityRef = (opts.task ?? opts.note ?? opts.goal) as string;

  const db = openAndMigrate(resolved.value.databaseAbsolutePath);
  try {
    const result = resolveEntityParent(db, entityType, entityRef);

    if (!result.ok) {
      cliFailed();
      const env = errorEnvelope([recoverableError(ErrorCodes.VALIDATION, result.error)], []);
      if (isJsonOutput(ctx)) printJsonEnvelope(env);
      else if (shouldPrintHuman(ctx)) presentation.errorBlock(ctx, result.error);
      else emitQuietFallback(ctx, result.error);
      return;
    }

    const resolution = result.value;
    const ancestors = getAncestors(db, resolution);

    const suggestedPrimary = resolution.parent
      ? { type: resolution.parent.type, slug: resolution.parent.slug }
      : { type: 'inbox' as const };

    const data = {
      entity: {
        type: resolution.entity.type,
        id: resolution.entity.id,
        slug: resolution.entity.slug,
        title: resolution.entity.title,
      },
      parent: resolution.parent
        ? {
            type: resolution.parent.type,
            id: resolution.parent.id,
            slug: resolution.parent.slug,
            title: resolution.parent.title,
          }
        : null,
      suggested_path: resolution.suggestedPath,
      suggested_primary: suggestedPrimary,
      ancestors,
      reason: resolution.suggestionReason,
    };

    const env = successEnvelope(data, [], []);

    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
    } else if (shouldPrintHuman(ctx)) {
      presentation.heading(
        ctx,
        `${formatEntityType(resolution.entity.type)}: ${resolution.entity.slug}`,
      );
      presentation.bodyLine(ctx, `Title: ${resolution.entity.title}`);
      presentation.bodyLine(ctx, '');

      if (resolution.parent) {
        presentation.bodyLine(
          ctx,
          `Parent: ${resolution.parent.type} '${resolution.parent.slug}' (${resolution.parent.title})`,
        );
      } else {
        presentation.bodyLine(ctx, 'Parent: (none)');
      }

      presentation.bodyLine(ctx, '');
      presentation.bodyLine(ctx, `Suggested path: ${resolution.suggestedPath}`);
      presentation.bodyLine(ctx, '');

      if (ancestors.length > 0) {
        presentation.bodyLine(ctx, 'Ancestors:');
        for (const anc of ancestors) {
          presentation.bodyLine(ctx, `  - ${anc.type} '${anc.slug}' (${anc.title})`);
        }
        presentation.bodyLine(ctx, '');
      }

      presentation.bodyLine(ctx, `Reason: ${resolution.suggestionReason}`);
      presentation.bodyLine(ctx, '');

      if (resolution.parent) {
        const primaryFlag = `--${resolution.parent.type}`;
        presentation.bodyLine(
          ctx,
          `Next step: second-brain-os drive set-primary <drive-ref> ${primaryFlag} ${resolution.parent.slug}`,
        );
      } else {
        presentation.bodyLine(
          ctx,
          'Next step: second-brain-os drive set-primary <drive-ref> --inbox',
        );
      }
    }
  } finally {
    closeSecondBrainDatabase(db);
  }
}

const VALID_RESOLVE_ENTITY_TYPES: readonly CoreEntityKind[] = [
  'area',
  'project',
  'task',
  'note',
  'goal',
];

function isValidResolveEntityType(type: string): type is CoreEntityKind {
  return VALID_RESOLVE_ENTITY_TYPES.includes(type as CoreEntityKind);
}

export async function runResolve(command: Command, entityType: string, ref: string): Promise<void> {
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

  if (!isValidResolveEntityType(entityType)) {
    cliFailed();
    const msg = `Invalid entity type: ${entityType}. Valid types: ${VALID_RESOLVE_ENTITY_TYPES.join(', ')}`;
    const env = errorEnvelope([recoverableError(ErrorCodes.VALIDATION, msg)], []);
    if (isJsonOutput(ctx)) printJsonEnvelope(env);
    else if (shouldPrintHuman(ctx)) presentation.errorBlock(ctx, msg);
    else emitQuietFallback(ctx, msg);
    return;
  }

  const db = openAndMigrate(resolved.value.databaseAbsolutePath);
  try {
    const result = resolveEntityByRef(db, entityType, ref);

    if (!result.ok) {
      cliFailed();
      const env = errorEnvelope([recoverableError(ErrorCodes.VALIDATION, result.error)], []);
      if (isJsonOutput(ctx)) printJsonEnvelope(env);
      else if (shouldPrintHuman(ctx)) presentation.errorBlock(ctx, result.error);
      else emitQuietFallback(ctx, result.error);
      return;
    }

    const entity = result.value;
    const children = countEntityChildren(db, entityType, entity.id);

    const data = {
      entity_type: entity.type,
      id: entity.id,
      slug: entity.slug,
      title: entity.title,
      status: entity.status,
      file_path: entity.filePath,
      child_entities: children,
    };

    const env = successEnvelope(data, [], []);

    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
    } else if (shouldPrintHuman(ctx)) {
      const typeName = entity.type.charAt(0).toUpperCase() + entity.type.slice(1);
      presentation.heading(ctx, `${typeName}: ${entity.slug}`);
      presentation.bodyLine(ctx, `Title: ${entity.title}`);
      if (entity.status) {
        presentation.bodyLine(ctx, `Status: ${entity.status}`);
      }
      presentation.bodyLine(ctx, `Path: ${entity.filePath}`);
      presentation.bodyLine(ctx, '');

      if (children.goals > 0 || children.projects > 0 || children.tasks > 0) {
        presentation.bodyLine(ctx, 'Contains:');
        if (children.goals > 0) {
          presentation.bodyLine(ctx, `  ${children.goals} goal${children.goals !== 1 ? 's' : ''}`);
        }
        if (children.projects > 0) {
          presentation.bodyLine(
            ctx,
            `  ${children.projects} project${children.projects !== 1 ? 's' : ''}`,
          );
        }
        if (children.tasks > 0) {
          presentation.bodyLine(ctx, `  ${children.tasks} task${children.tasks !== 1 ? 's' : ''}`);
        }
      }
    }
  } finally {
    closeSecondBrainDatabase(db);
  }
}

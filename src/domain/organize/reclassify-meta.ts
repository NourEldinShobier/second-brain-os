import type { SecondBrainMeta } from '../markdown/second-brain-meta.js';
import type { Result } from '../result.js';
import { err, ok } from '../result.js';

export type ReclassifyTargetKind = 'note' | 'resource' | 'task';

const ALLOWED = new Set<ReclassifyTargetKind>(['note', 'resource', 'task']);

export function isReclassifySupported(
  fromKind: SecondBrainMeta['kind'],
  toKind: ReclassifyTargetKind,
): boolean {
  if (fromKind === toKind) {
    return false;
  }
  if (!ALLOWED.has(fromKind as ReclassifyTargetKind)) {
    return false;
  }
  return ALLOWED.has(toKind);
}

function defaultStatus(kind: ReclassifyTargetKind): string {
  switch (kind) {
    case 'note':
      return 'active';
    case 'resource':
      return 'saved';
    case 'task':
      return 'todo';
  }
}

/**
 * Convert metadata to a new kind while preserving stable id, slug, title, archive state, and relationship ids.
 * Strips incompatible fields; adds sensible defaults for the target kind.
 */
export function buildMetaForReclassify(
  meta: SecondBrainMeta,
  toKind: ReclassifyTargetKind,
  body: string,
): Result<SecondBrainMeta, string> {
  if (!isReclassifySupported(meta.kind, toKind)) {
    return err(
      `Reclassify from ${meta.kind} to ${toKind} is not supported. Supported kinds: note, resource, task (excluding inbox, areas, goals, projects).`,
    );
  }

  const urlMatch = body.match(/https?:\/\/\S+/u);

  const base: SecondBrainMeta = {
    id: meta.id,
    kind: toKind,
    version: 1,
    slug: meta.slug,
    title: meta.title,
    status: defaultStatus(toKind),

    ...(meta.area_ids !== undefined && meta.area_ids.length > 0 ? { area_ids: [...meta.area_ids] } : {}),
    ...(meta.goal_ids !== undefined && meta.goal_ids.length > 0 ? { goal_ids: [...meta.goal_ids] } : {}),
    ...(meta.project_ids !== undefined && meta.project_ids.length > 0 ? { project_ids: [...meta.project_ids] } : {}),
    ...(meta.task_ids !== undefined && meta.task_ids.length > 0 ? { task_ids: [...meta.task_ids] } : {}),
    ...(meta.resource_ids !== undefined && meta.resource_ids.length > 0
      ? { resource_ids: [...meta.resource_ids] }
      : {}),
    ...(meta.note_ids !== undefined && meta.note_ids.length > 0 ? { note_ids: [...meta.note_ids] } : {}),
  };

  if (toKind === 'task') {
    return ok({
      ...base,
      status: meta.kind === 'task' ? meta.status : defaultStatus('task'),
      ...(meta.kind === 'task' && meta.due_date !== undefined ? { due_date: meta.due_date } : {}),
      ...(meta.kind === 'task' && meta.priority !== undefined ? { priority: meta.priority } : {}),
      ...(meta.kind === 'task' && meta.energy !== undefined ? { energy: meta.energy } : {}),
    });
  }

  if (toKind === 'resource') {
    const sourceUrl =
      meta.kind === 'resource' && meta.source_url !== undefined
        ? meta.source_url
        : urlMatch
          ? urlMatch[0]
          : null;
    return ok({
      ...base,
      status: meta.kind === 'resource' ? meta.status : 'saved',
      source_url: sourceUrl,
    });
  }

  return ok({
    ...base,
    status: meta.kind === 'note' ? meta.status : 'active',
    ...(meta.kind === 'note' && meta.notebook !== undefined ? { notebook: meta.notebook } : {}),
    ...(meta.kind === 'note' && meta.pinned !== undefined ? { pinned: meta.pinned } : {}),
  });
}

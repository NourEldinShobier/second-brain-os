import type { CoreEntityKind } from '../domain/entity-kind.js';
import type { SecondBrainMeta } from '../domain/markdown/second-brain-meta.js';
import type { Result } from '../domain/result.js';
import { err, ok } from '../domain/result.js';
import type { SecondBrainDb } from '../infrastructure/db/open-database.js';
import { resolveAreaIds, resolveProjectIds } from '../infrastructure/relationships/resolve-entity-ref.js';
import type { EntityCrudService } from './entity-crud-service.js';

export type TypedCaptureKind = Exclude<CoreEntityKind, 'inbox_item' | 'archive_record'>;

export interface TypedCaptureInput {
  readonly kind: TypedCaptureKind;
  readonly title: string;
  readonly body: string;
  readonly slug?: string | undefined;
  readonly areaRefs: readonly string[];
  readonly projectRefs: readonly string[];
  readonly url?: string | undefined;
  readonly due?: string | undefined;
  readonly priority?: number | undefined;
  readonly notebook?: string | undefined;
  readonly energy?: string | undefined;
  readonly status?: string | undefined;
  readonly pinned?: boolean | undefined;
}

export async function executeTypedCapture(
  db: SecondBrainDb,
  entities: EntityCrudService,
  input: TypedCaptureInput,
): Promise<Result<{ readonly path: string; readonly meta: SecondBrainMeta }, string>> {
  const slug = input.slug;
  const body = input.body;
  switch (input.kind) {
    case 'area':
      return entities.createArea({
        title: input.title,
        body,
        ...(slug !== undefined ? { slug } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      });
    case 'goal': {
      const areas = resolveAreaIds(db, input.areaRefs);
      if (!areas.ok) {
        return err(areas.error);
      }
      if (areas.value.length < 1) {
        return err('goal requires at least one --area (id or slug)');
      }
      return entities.createGoal({
        title: input.title,
        body,
        areaIds: areas.value,
        ...(slug !== undefined ? { slug } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      });
    }
    case 'project': {
      const areas = resolveAreaIds(db, input.areaRefs);
      if (!areas.ok) {
        return err(areas.error);
      }
      if (areas.value.length < 1) {
        return err('project requires at least one --area (id or slug)');
      }
      return entities.createProject({
        title: input.title,
        body,
        areaIds: areas.value,
        ...(slug !== undefined ? { slug } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      });
    }
    case 'task': {
      const areaIds =
        input.areaRefs.length > 0 ? resolveAreaIds(db, input.areaRefs) : ok([] as readonly string[]);
      if (!areaIds.ok) {
        return err(areaIds.error);
      }
      const projectIds =
        input.projectRefs.length > 0 ? resolveProjectIds(db, input.projectRefs) : ok([] as readonly string[]);
      if (!projectIds.ok) {
        return err(projectIds.error);
      }
      return entities.createTask({
        title: input.title,
        body,
        ...(slug !== undefined ? { slug } : {}),
        ...(areaIds.value.length > 0 ? { areaIds: areaIds.value } : {}),
        ...(projectIds.value.length > 0 ? { projectIds: projectIds.value } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.due !== undefined ? { dueDate: input.due } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.energy !== undefined ? { energy: input.energy } : {}),
      });
    }
    case 'resource':
      return entities.createResource({
        title: input.title,
        body,
        ...(slug !== undefined ? { slug } : {}),
        ...(input.url !== undefined ? { sourceUrl: input.url } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      });
    case 'note':
      return entities.createNote({
        title: input.title,
        body,
        ...(slug !== undefined ? { slug } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.notebook !== undefined ? { notebook: input.notebook } : {}),
        ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
      });
  }
}

import type { CoreEntityKind } from './entity-kind.js';
import type { KeyResult } from './key-result.js';
import type { EntityId, EntitySlug } from './ids.js';
import type {
  AreaStatus,
  GoalStatus,
  NoteStatus,
  ProjectStatus,
  ResourceStatus,
  TaskStatus,
} from './statuses.js';

export interface InboxItem {
  readonly id: EntityId;
  readonly slug: EntitySlug;
  readonly title: string;
  readonly rawBody: string;
  readonly capturedAt: string;
  readonly source?: string;
  readonly suggestedEntityType?: string;
  readonly processedAt?: string | null;
}

export interface Area {
  readonly id: EntityId;
  readonly slug: EntitySlug;
  readonly title: string;
  readonly body: string;
  readonly status: AreaStatus;
}

export interface Goal {
  readonly id: EntityId;
  readonly slug: EntitySlug;
  readonly title: string;
  readonly body: string;
  readonly status: GoalStatus;
  readonly areaIds: readonly EntityId[];
  readonly keyResults: readonly KeyResult[];
  readonly targetDate?: string | null;
}

export interface Project {
  readonly id: EntityId;
  readonly slug: EntitySlug;
  readonly title: string;
  readonly body: string;
  readonly status: ProjectStatus;
  readonly areaIds: readonly EntityId[];
  readonly goalIds: readonly EntityId[];
}

export interface Task {
  readonly id: EntityId;
  readonly slug: EntitySlug;
  readonly title: string;
  readonly body: string;
  readonly status: TaskStatus;
  readonly areaIds: readonly EntityId[];
  readonly goalIds: readonly EntityId[];
  readonly projectIds: readonly EntityId[];
  readonly resourceIds: readonly EntityId[];
  readonly noteIds: readonly EntityId[];
  readonly dueDate?: string | null;
  readonly priority?: number | null;
}

export interface Resource {
  readonly id: EntityId;
  readonly slug: EntitySlug;
  readonly title: string;
  readonly body: string;
  readonly status: ResourceStatus;
  readonly areaIds: readonly EntityId[];
  readonly goalIds: readonly EntityId[];
  readonly projectIds: readonly EntityId[];
  readonly sourceUrl?: string | null;
}

export interface Note {
  readonly id: EntityId;
  readonly slug: EntitySlug;
  readonly title: string;
  readonly body: string;
  readonly status: NoteStatus;
  readonly areaIds: readonly EntityId[];
  readonly goalIds: readonly EntityId[];
  readonly projectIds: readonly EntityId[];
  readonly notebook?: string | null;
}

export interface ArchiveRecord {
  readonly id: EntityId;
  readonly entityKind: CoreEntityKind;
  readonly entityId: EntityId;
  readonly archivedAt: string;
  readonly reason?: string | null;
  readonly originalRelativePath?: string | null;
}

export type CoreEntity =
  | InboxItem
  | Area
  | Goal
  | Project
  | Task
  | Resource
  | Note
  | ArchiveRecord;

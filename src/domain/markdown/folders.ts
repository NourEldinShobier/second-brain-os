import type { CoreEntityKind } from '../entity-kind.js';

/** Active (non-archived) folder relative to workspace root. */
export const ACTIVE_FOLDER_BY_KIND: Record<CoreEntityKind, string> = {
  inbox_item: '00-inbox',
  area: '01-areas',
  goal: '02-goals',
  project: '03-projects',
  task: '04-tasks',
  resource: '05-resources',
  note: '06-notes',
  archive_record: '99-archive',
};

/** Archive destination folder (under workspace root) when moving from active storage. */
export const ARCHIVE_FOLDER_BY_KIND: Record<
  Exclude<CoreEntityKind, 'archive_record'>,
  string
> = {
  inbox_item: '99-archive/inbox',
  area: '99-archive/areas',
  goal: '99-archive/goals',
  project: '99-archive/projects',
  task: '99-archive/tasks',
  resource: '99-archive/resources',
  note: '99-archive/notes',
};

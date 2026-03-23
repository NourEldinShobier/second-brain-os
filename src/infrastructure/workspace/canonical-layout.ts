/**
 * Folder layout from PRD §9 (relative to workspace root).
 * Keep in sync with `second-brain-cli-prd.md`.
 */
export const CANONICAL_RELATIVE_DIRS: readonly string[] = [
  '.second-brain/migrations',
  '.second-brain/logs',
  '.second-brain/cache',
  '00-inbox',
  '01-areas',
  '02-goals',
  '03-projects',
  '04-tasks',
  '05-resources',
  '06-notes',
  '07-reviews/daily',
  '07-reviews/weekly',
  '99-archive/inbox',
  '99-archive/areas',
  '99-archive/goals',
  '99-archive/projects',
  '99-archive/tasks',
  '99-archive/resources',
  '99-archive/notes',
];

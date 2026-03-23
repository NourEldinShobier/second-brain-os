import type { ListableEntityKind } from './listable-kind.js';

const ALIAS: Readonly<Record<string, ListableEntityKind>> = {
  area: 'area',
  areas: 'area',
  goal: 'goal',
  goals: 'goal',
  project: 'project',
  projects: 'project',
  task: 'task',
  tasks: 'task',
  resource: 'resource',
  resources: 'resource',
  note: 'note',
  notes: 'note',
  inbox: 'inbox_item',
  inbox_item: 'inbox_item',
  inbox_items: 'inbox_item',
};

/** Parse CLI entity argument (e.g. `tasks`, `inbox`) into an index kind. */
export function parseListEntityArg(raw: string | undefined): ListableEntityKind | null {
  if (raw === undefined || raw.trim() === '') {
    return null;
  }
  const k = raw.trim().toLowerCase();
  return ALIAS[k] ?? null;
}

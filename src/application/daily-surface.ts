import type { SecondBrainDb } from '../infrastructure/db/open-database.js';
import { listEntitiesInIndex, type ListedEntityRow } from '../infrastructure/query/list-entities.js';

/** Local calendar date `YYYY-MM-DD` (not UTC). */
export function localIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${String(y)}-${m}-${day}`;
}

export function addCalendarDays(isoDate: string, days: number): string {
  const parts = isoDate.split('-').map(Number);
  const yy = parts[0];
  const mm = parts[1];
  const dd = parts[2];
  if (yy === undefined || mm === undefined || dd === undefined) {
    return localIsoDate(new Date());
  }
  const dt = new Date(yy, mm - 1, dd);
  dt.setDate(dt.getDate() + days);
  return localIsoDate(dt);
}

export function isCompletedTaskStatus(status: string): boolean {
  const x = status.trim().toLowerCase();
  return x === 'done' || x === 'completed' || x === 'delegated';
}

/** Statuses that represent "do this soon" / active work (normalized). */
export function isFocusTaskStatus(status: string): boolean {
  const x = status.trim().toLowerCase().replace(/[\s_-]+/g, '');
  return x === 'donext' || x === 'inprogress';
}

export function isActiveProjectStatus(status: string): boolean {
  const x = status.trim().toLowerCase();
  return x !== 'completed' && x !== 'done' && x !== 'cancelled';
}

export interface DailySurfaceInput {
  readonly db: SecondBrainDb;
  /** Defaults to `new Date()` */
  readonly asOf?: Date;
  /** Due-date window after today (default 7). */
  readonly upcomingDays?: number;
  readonly maxPerSection?: number;
  readonly taskFetchLimit?: number;
  readonly inboxSampleSize?: number;
}

export interface DailySurface {
  readonly date: string;
  readonly overdue: readonly ListedEntityRow[];
  readonly dueToday: readonly ListedEntityRow[];
  readonly upcoming: readonly ListedEntityRow[];
  /** Active tasks with focus status, excluding tasks already placed in date buckets. */
  readonly focus: readonly ListedEntityRow[];
  /**
   * Active tasks with no `do_date` and non-focus status (e.g. undated `todo`).
   * `backlog_total` is the full count; `backlog` is capped by `maxPerSection`.
   */
  readonly backlog_total: number;
  readonly backlog: readonly ListedEntityRow[];
  readonly inboxCount: number;
  readonly inboxSample: readonly ListedEntityRow[];
  readonly activeProjects: readonly ListedEntityRow[];
}

function sortTasksByDateThenPriority(a: ListedEntityRow, b: ListedEntityRow): number {
  const da = a.do_date ?? '';
  const db = b.do_date ?? '';
  if (da !== db) {
    return da.localeCompare(db);
  }
  const pa = a.priority ?? 999;
  const pb = b.priority ?? 999;
  return pa - pb;
}

/**
 * Daily Action Zone: overdue tasks, due today, upcoming by date window, focus queue,
 * inbox snapshot, and active projects — shared by `today` and `dashboard show`.
 */
export function buildDailySurface(input: DailySurfaceInput): DailySurface {
  const asOf = input.asOf ?? new Date();
  const today = localIsoDate(asOf);
  const upcomingDays = input.upcomingDays ?? 7;
  const maxPer = input.maxPerSection ?? 50;
  const taskLimit = input.taskFetchLimit ?? 500;
  const inboxSampleSize = input.inboxSampleSize ?? 5;

  const allTasks = listEntitiesInIndex(input.db, 'task', {
    limit: taskLimit,
  });
  const active = allTasks.filter((t) => !isCompletedTaskStatus(t.status));

  const windowEnd = addCalendarDays(today, upcomingDays);

  const overdue: ListedEntityRow[] = [];
  const dueToday: ListedEntityRow[] = [];
  const upcoming: ListedEntityRow[] = [];
  const placed = new Set<string>();

  for (const t of active) {
    const d = t.do_date;
    if (d !== null && d.length > 0) {
      if (d < today) {
        overdue.push(t);
        placed.add(t.id);
      } else if (d === today) {
        dueToday.push(t);
        placed.add(t.id);
      } else if (d > today && d <= windowEnd) {
        upcoming.push(t);
        placed.add(t.id);
      }
    }
  }

  overdue.sort(sortTasksByDateThenPriority);
  dueToday.sort(sortTasksByDateThenPriority);
  upcoming.sort(sortTasksByDateThenPriority);

  const focus: ListedEntityRow[] = [];
  for (const t of active) {
    if (placed.has(t.id)) {
      continue;
    }
    if (isFocusTaskStatus(t.status)) {
      focus.push(t);
    }
  }
  focus.sort((a, b) => a.title.localeCompare(b.title));

  const backlogAll: ListedEntityRow[] = [];
  for (const t of active) {
    const d = t.do_date;
    const hasDate = d !== null && d.length > 0;
    if (hasDate) {
      continue;
    }
    if (isFocusTaskStatus(t.status)) {
      continue;
    }
    backlogAll.push(t);
  }
  backlogAll.sort((a, b) => a.title.localeCompare(b.title));
  const backlogTotal = backlogAll.length;

  const inboxRows = listEntitiesInIndex(input.db, 'inbox_item', {
    limit: 10_000,
  });
  const inboxCount = inboxRows.length;
  const inboxSample = inboxRows.slice(0, inboxSampleSize);

  const projects = listEntitiesInIndex(input.db, 'project', {
    limit: 100,
  });
  const activeProjects = projects.filter((p) => isActiveProjectStatus(p.status)).slice(0, 15);

  return {
    date: today,
    overdue: overdue.slice(0, maxPer),
    dueToday: dueToday.slice(0, maxPer),
    upcoming: upcoming.slice(0, maxPer),
    focus: focus.slice(0, maxPer),
    backlog_total: backlogTotal,
    backlog: backlogAll.slice(0, maxPer),
    inboxCount,
    inboxSample,
    activeProjects,
  };
}

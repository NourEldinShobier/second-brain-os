import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Result } from '../domain/result.js';
import { err, ok } from '../domain/result.js';
import type { SecondBrainDb } from '../infrastructure/db/open-database.js';
import * as schema from '../infrastructure/db/schema.js';
import { listEntitiesInIndex, type ListedEntityRow } from '../infrastructure/query/list-entities.js';
import { addCalendarDays, isCompletedTaskStatus, localIsoDate } from './daily-surface.js';
import { buildDashboardData } from './dashboard-data.js';

export interface WeeklyReviewReportModel {
  readonly date: string;
  readonly inboxCount: number;

  readonly staleTasks: readonly ListedEntityRow[];
  readonly recentlyCompletedTasks: readonly ListedEntityRow[];
  readonly focusTasks: readonly ListedEntityRow[];
  readonly upcomingTasks: readonly ListedEntityRow[];
  readonly overdueTasks: readonly ListedEntityRow[];
}

function compareIso(a: string, b: string): number {
  return a.localeCompare(b);
}

export function buildWeeklyReviewReport(db: SecondBrainDb, asOf: Date = new Date()): WeeklyReviewReportModel {
  const date = localIsoDate(asOf);
  const dash = buildDashboardData(db, { daily: { asOf } });
  const daily = dash.daily;

  const tasks = listEntitiesInIndex(db, 'task', { limit: 500 });
  const staleCut = addCalendarDays(date, -14);
  const staleTasks = tasks
    .filter((t) => !isCompletedTaskStatus(t.status) && t.updated_at.slice(0, 10) < staleCut)
    .sort((a, b) => compareIso(a.updated_at, b.updated_at));

  const weekStart = addCalendarDays(date, -7);
  const recentlyCompletedTasks = tasks
    .filter((t) => isCompletedTaskStatus(t.status) && t.updated_at.slice(0, 10) >= weekStart)
    .sort((a, b) => compareIso(b.updated_at, a.updated_at));

  return {
    date,
    inboxCount: daily.inboxCount,

    staleTasks,
    recentlyCompletedTasks,
    focusTasks: daily.focus,
    upcomingTasks: daily.upcoming,
    overdueTasks: daily.overdue,
  };
}

export function renderWeeklyReviewMarkdown(model: WeeklyReviewReportModel): string {
  const lines: string[] = [];
  lines.push(`# Weekly review (${model.date})`);
  lines.push('');
  lines.push('## Snapshot');
  lines.push('');
  lines.push(`- Inbox: **${String(model.inboxCount)}** unprocessed`);

  lines.push('');
  lines.push('## Overdue tasks');
  lines.push('');
  if (model.overdueTasks.length === 0) {
    lines.push('_None._');
  } else {
    for (const t of model.overdueTasks) {
      lines.push(`- [ ] ${t.title} (\`${t.slug}\`) — ${t.status}${t.do_date ? ` — due ${t.do_date}` : ''}`);
    }
  }
  lines.push('');
  lines.push('## Focus & upcoming');
  lines.push('');
  lines.push('### Next actions (focus)');
  lines.push('');
  if (model.focusTasks.length === 0) {
    lines.push('_None._');
  } else {
    for (const t of model.focusTasks) {
      lines.push(`- [ ] ${t.title} (\`${t.slug}\`)`);
    }
  }
  lines.push('');
  lines.push('### Due in the next week');
  lines.push('');
  if (model.upcomingTasks.length === 0) {
    lines.push('_None._');
  } else {
    for (const t of model.upcomingTasks) {
      lines.push(`- [ ] ${t.title} (\`${t.slug}\`)${t.do_date ? ` — ${t.do_date}` : ''}`);
    }
  }
  lines.push('');
  lines.push('## Completed since last week (approx.)');
  lines.push('');
  if (model.recentlyCompletedTasks.length === 0) {
    lines.push('_None detected (by status + update date)._');
  } else {
    for (const t of model.recentlyCompletedTasks) {
      lines.push(`- [x] ${t.title} (\`${t.slug}\`)`);
    }
  }
  lines.push('');
  lines.push('## Stale open tasks (no completion, quiet 14d+, not future-dated)');
  lines.push('');
  if (model.staleTasks.length === 0) {
    lines.push('_None._');
  } else {
    for (const t of model.staleTasks) {
      lines.push(`- [ ] ${t.title} (\`${t.slug}\`) — updated ${t.updated_at.slice(0, 10)}`);
    }
  }
  lines.push('');
  lines.push('## Next pass');
  lines.push('');
  lines.push('- [ ] Triage inbox');
  lines.push('- [ ] Archive or reschedule stale tasks');
  lines.push('- [ ] Pick 1–3 priorities for the coming week');
  lines.push('');
  return lines.join('\n');
}

export async function persistWeeklyReview(
  workspaceRoot: string,
  db: SecondBrainDb,
  options?: { readonly asOf?: Date; readonly dryRun?: boolean },
): Promise<Result<{ readonly artifactRelativePath: string; readonly reviewId: string }, string>> {
  const asOf = options?.asOf ?? new Date();
  const model = buildWeeklyReviewReport(db, asOf);
  const md = renderWeeklyReviewMarkdown(model);
  const relPath = `07-reviews/weekly/${model.date}-weekly-review.md`;
  const reviewId = randomUUID();
  const now = new Date().toISOString();

  if (options?.dryRun === true) {
    return ok({ artifactRelativePath: relPath, reviewId });
  }

  const abs = path.join(workspaceRoot, relPath);
  try {
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, md, 'utf8');
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return err(`Could not write review artifact: ${detail}`);
  }

  db.insert(schema.reviews)
    .values({
      id: reviewId,
      review_kind: 'weekly',
      started_at: now,
      completed_at: now,
      artifact_path: relPath,
      summary: `Weekly review ${model.date}`,
      created_at: now,
    })
    .run();

  return ok({ artifactRelativePath: relPath, reviewId });
}

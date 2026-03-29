import { desc, eq } from 'drizzle-orm';
import type { SecondBrainDb } from '../infrastructure/db/open-database.js';
import * as schema from '../infrastructure/db/schema.js';
import { listEntitiesInIndex, type ListedEntityRow } from '../infrastructure/query/list-entities.js';
import { buildDailySurface, type DailySurface, type DailySurfaceInput } from './daily-surface.js';

export interface GoalProgressRow {
  readonly goal: ListedEntityRow;
  readonly percent: number;
  /** Human-readable basis (key results vs status). */
  readonly basis: string;
}

function isCompletedGoalStatus(status: string): boolean {
  const s = status.trim().toLowerCase();
  return s === 'completed' || s === 'done' || s === 'cancelled';
}

function buildGoalProgress(db: SecondBrainDb, goal: ListedEntityRow): GoalProgressRow {
  const krs = db
    .select()
    .from(schema.goalKeyResults)
    .where(eq(schema.goalKeyResults.goal_id, goal.id))
    .all();
  if (krs.length > 0) {
    const done = krs.filter((k) => k.completed).length;
    const percent = Math.round((done / krs.length) * 100);
    return {
      goal,
      percent,
      basis: `${String(done)} of ${String(krs.length)} key results complete`,
    };
  }
  if (isCompletedGoalStatus(goal.status)) {
    return {
      goal,
      percent: 100,
      basis: 'No key results; goal marked complete',
    };
  }
  return {
    goal,
    percent: 0,
    basis: 'No key results; progress not inferred beyond status',
  };
}

export interface DashboardDataOptions {
  readonly daily?: Omit<DailySurfaceInput, 'db'>;
}

export interface DashboardData {
  readonly daily: DailySurface;
  readonly goals: readonly GoalProgressRow[];
  readonly recentNotes: readonly ListedEntityRow[];
  readonly recentResources: readonly ListedEntityRow[];

  readonly lastWeeklyReview: { readonly startedAt: string; readonly completedAt: string | null } | null;
}

/** Aggregated home view: daily surface plus goals, recents, archive summary, review hint. */
export function buildDashboardData(db: SecondBrainDb, options: DashboardDataOptions = {}): DashboardData {
  const daily = buildDailySurface({ db, ...options.daily });

  const goalRows = listEntitiesInIndex(db, 'goal', { limit: 50 });
  const goalsInFlight = goalRows.filter((g) => !isCompletedGoalStatus(g.status)).slice(0, 12);
  const goals = goalsInFlight.map((g) => buildGoalProgress(db, g));

  const recentNotes = listEntitiesInIndex(db, 'note', { limit: 6 });
  const recentResources = listEntitiesInIndex(db, 'resource', { limit: 6 });


  const last = db
    .select()
    .from(schema.reviews)
    .where(eq(schema.reviews.review_kind, 'weekly'))
    .orderBy(desc(schema.reviews.started_at))
    .limit(1)
    .get();

  const lastWeeklyReview = last
    ? { startedAt: last.started_at, completedAt: last.completed_at ?? null }
    : null;

  return {
    daily,
    goals,
    recentNotes,
    recentResources,

    lastWeeklyReview,
  };
}

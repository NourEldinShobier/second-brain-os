import type { Command } from 'commander';
import { warningsWhenAiDisabled } from '../../application/ai-degraded-warnings.js';
import { buildDashboardData } from '../../application/dashboard-data.js';
import type { ListedEntityRow } from '../../infrastructure/query/list-entities.js';
import { openAndMigrate } from '../../infrastructure/db/open-database.js';
import { errorEnvelope, successEnvelope } from '../../shared/envelope.js';
import { printJsonEnvelope } from '../../shared/print-envelope.js';
import { cliFailed, emitQuietFallback } from '../cli-feedback.js';
import { commandContextFrom } from '../context.js';
import { isJsonOutput, shouldPrintHuman } from '../output-policy.js';
import { workspaceFailureToErrors } from '../map-workspace-failure.js';
import * as presentation from '../presentation/blocks.js';
import { resolveWorkspaceForCli } from '../workspace-resolve.js';

export interface DashboardShowCliOptions {
  readonly days?: string;
}

function listedRowJson(r: ListedEntityRow) {
  return {
    id: r.id,
    kind: r.kind,
    slug: r.slug,
    title: r.title,
    status: r.status,
    file_path: r.file_path,
    do_date: r.do_date,
    priority: r.priority,
    energy: r.energy,
  };
}

export async function runDashboardShow(command: Command): Promise<void> {
  const ctx = commandContextFrom(command);
  const opts = command.opts<DashboardShowCliOptions>();
  const rawDays = opts.days ?? '7';
  const parsed = Number.parseInt(rawDays, 10);
  const upcomingDays = Number.isNaN(parsed) ? 7 : Math.min(Math.max(parsed, 1), 30);

  const resolved = await resolveWorkspaceForCli(ctx);
  if (!resolved.ok) {
    cliFailed();
    const errors = workspaceFailureToErrors(resolved.error);
    const env = errorEnvelope(errors, ['Run `second-brain-os init` or set `--workspace`.']);
    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return;
    }
    if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'dashboard');
      for (const e of errors) {
        presentation.errorBlock(ctx, `${e.code}: ${e.message}`);
      }
      return;
    }
    emitQuietFallback(ctx, errors.map((e) => e.message).join('; '));
    return;
  }

  const db = openAndMigrate(resolved.value.databaseAbsolutePath);
  const dash = buildDashboardData(db, { daily: { upcomingDays } });

  const data = {
    workspace_root: resolved.value.workspaceRoot,
    date: dash.daily.date,
    daily: {
      inbox: { count: dash.daily.inboxCount, sample: dash.daily.inboxSample.map(listedRowJson) },
      overdue: dash.daily.overdue.map(listedRowJson),
      due_today: dash.daily.dueToday.map(listedRowJson),
      upcoming: dash.daily.upcoming.map(listedRowJson),
      focus: dash.daily.focus.map(listedRowJson),
      backlog: {
        total: dash.daily.backlog_total,
        preview: dash.daily.backlog.map(listedRowJson),
      },
      active_projects: dash.daily.activeProjects.map(listedRowJson),
    },
    goals: dash.goals.map((g) => ({
      slug: g.goal.slug,
      title: g.goal.title,
      status: g.goal.status,
      percent: g.percent,
      basis: g.basis,
    })),
    recent_notes: dash.recentNotes.map(listedRowJson),
    recent_resources: dash.recentResources.map(listedRowJson),
    archived_entity_count: dash.archivedEntityCount,
    last_weekly_review: dash.lastWeeklyReview,
  };

  const env = successEnvelope(data, warningsWhenAiDisabled(resolved.value.config), [
    'This view is derived from SQLite + Markdown — nothing here is stored as a static dashboard file.',
    'Run `second-brain-os today` for the narrower daily-action surface.',
  ]);

  if (isJsonOutput(ctx)) {
    printJsonEnvelope(env);
    return;
  }

  if (ctx.outputFormat === 'markdown') {
    console.log('# Dashboard\n');
    if (env.warnings.length > 0) {
      console.log('## Warnings\n');
      for (const w of env.warnings) {
        console.log(`- **${w.code}**: ${w.message}`);
      }
      console.log('');
    }
    console.log(`_Generated for **${dash.daily.date}** · upcoming task window ${String(upcomingDays)} day(s)._\n`);
    console.log('## Inbox\n');
    console.log(`- **${String(dash.daily.inboxCount)}** item(s) in inbox\n`);
    console.log('## Today surface\n');
    console.log('### Overdue tasks\n');
    for (const r of dash.daily.overdue) {
      console.log(`- \`${r.slug}\` — ${r.title}`);
    }
    if (dash.daily.overdue.length === 0) {
      console.log('- _None._');
    }
    console.log('\n### Due today\n');
    for (const r of dash.daily.dueToday) {
      console.log(`- \`${r.slug}\` — ${r.title}`);
    }
    if (dash.daily.dueToday.length === 0) {
      console.log('- _None._');
    }
    console.log('\n### Backlog (undated, non-focus)\n');
    console.log(`- **${String(dash.daily.backlog_total)}** task(s) total\n`);
    if (dash.daily.backlog.length === 0) {
      console.log('- _None._');
    } else {
      for (const r of dash.daily.backlog) {
        console.log(`- \`${r.slug}\` — ${r.title}`);
      }
    }
    console.log('\n### Goals\n');
    for (const g of dash.goals) {
      console.log(`- **${g.goal.title}** — ${String(g.percent)}% (${g.basis})`);
    }
    if (dash.goals.length === 0) {
      console.log('- _None in flight._');
    }
    console.log('\n### Recent notes\n');
    for (const r of dash.recentNotes) {
      console.log(`- \`${r.slug}\` — ${r.title}`);
    }
    console.log('\n### Recent resources\n');
    for (const r of dash.recentResources) {
      console.log(`- \`${r.slug}\` — ${r.title}`);
    }
    console.log(`\n### Archive\n\n- **${String(dash.archivedEntityCount)}** archived entities (all kinds)\n`);
    console.log('### Weekly review\n');
    if (dash.lastWeeklyReview === null) {
      console.log('- _No weekly review logged yet._\n');
    } else {
      console.log(`- Last started: \`${dash.lastWeeklyReview.startedAt}\``);
      console.log(`- Completed: ${dash.lastWeeklyReview.completedAt ?? '_open_'}\n`);
    }
    return;
  }

  if (shouldPrintHuman(ctx)) {
    presentation.heading(ctx, `dashboard · ${dash.daily.date}`);
    for (const w of env.warnings) {
      presentation.warningBlock(ctx, `${w.code}: ${w.message}`);
    }
    presentation.bodyLine(ctx, `Inbox: ${String(dash.daily.inboxCount)} · Archived (all kinds): ${String(dash.archivedEntityCount)}`);
    presentation.bodyLine(ctx, '');
    presentation.bodyLine(
      ctx,
      `Overdue: ${String(dash.daily.overdue.length)} · Today: ${String(dash.daily.dueToday.length)} · Upcoming (${String(upcomingDays)}d): ${String(dash.daily.upcoming.length)} · Focus: ${String(dash.daily.focus.length)} · Backlog (undated): ${String(dash.daily.backlog_total)}`,
    );
    presentation.bodyLine(ctx, '');
    presentation.bodyLine(ctx, `Goals in flight: ${String(dash.goals.length)}`);
    for (const g of dash.goals.slice(0, 8)) {
      presentation.bodyLine(ctx, `  ${g.goal.slug} — ${String(g.percent)}% (${g.basis})`);
    }
    presentation.bodyLine(ctx, '');
    presentation.bodyLine(ctx, `Recent notes: ${String(dash.recentNotes.length)} · Recent resources: ${String(dash.recentResources.length)}`);
    presentation.bodyLine(ctx, '');
    if (dash.lastWeeklyReview === null) {
      presentation.bodyLine(ctx, 'Weekly review: none logged yet');
    } else {
      presentation.bodyLine(
        ctx,
        `Weekly review: last ${dash.lastWeeklyReview.startedAt}${dash.lastWeeklyReview.completedAt ? ' (completed)' : ' (in progress)'}`,
      );
    }
    presentation.suggestions(ctx, env.next_actions);
  }
}

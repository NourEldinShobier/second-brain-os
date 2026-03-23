import type { Command } from 'commander';
import { warningsWhenAiDisabled } from '../../application/ai-degraded-warnings.js';
import { buildDailySurface } from '../../application/daily-surface.js';
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

export interface TodayCliOptions {
  readonly days?: string;
}

function taskLine(r: ListedEntityRow): string {
  const bits = [r.do_date ? `due ${r.do_date}` : '', r.priority !== null ? `p${String(r.priority)}` : '']
    .filter(Boolean)
    .join(' · ');
  const extra = bits.length > 0 ? `  (${bits})` : '';
  return `${r.slug} — ${r.title}  [${r.status}]${extra}`;
}

function printMarkdownToday(
  surface: ReturnType<typeof buildDailySurface>,
  upcomingDays: number,
): void {
  console.log(`## today (${surface.date})\n`);
  console.log(`_Upcoming window: ${String(upcomingDays)} day(s) after today._\n`);
  console.log(`### Inbox\n`);
  console.log(`- **${String(surface.inboxCount)}** unprocessed item(s)\n`);
  if (surface.inboxSample.length > 0) {
    for (const r of surface.inboxSample) {
      console.log(`- \`${r.slug}\` — ${r.title}`);
    }
    console.log('');
  }
  console.log(`### Overdue\n`);
  if (surface.overdue.length === 0) {
    console.log('_None._\n');
  } else {
    for (const r of surface.overdue) {
      console.log(`- ${taskLine(r)}`);
    }
    console.log('');
  }
  console.log(`### Due today\n`);
  if (surface.dueToday.length === 0) {
    console.log('_None._\n');
  } else {
    for (const r of surface.dueToday) {
      console.log(`- ${taskLine(r)}`);
    }
    console.log('');
  }
  console.log(`### Next ${String(upcomingDays)} days\n`);
  if (surface.upcoming.length === 0) {
    console.log('_None._\n');
  } else {
    for (const r of surface.upcoming) {
      console.log(`- ${taskLine(r)}`);
    }
    console.log('');
  }
  console.log(`### Focus (next actions)\n`);
  if (surface.focus.length === 0) {
    console.log('_None._\n');
  } else {
    for (const r of surface.focus) {
      console.log(`- ${taskLine(r)}`);
    }
    console.log('');
  }
  console.log(`### Backlog (undated, non-focus)\n`);
  if (surface.backlog_total > surface.backlog.length) {
    console.log(
      `_Showing **${String(surface.backlog.length)}** of **${String(surface.backlog_total)}** (cap: max per section)._\n`,
    );
  } else {
    console.log(`_**${String(surface.backlog_total)}** task(s)._\n`);
  }
  if (surface.backlog.length === 0) {
    console.log('_None._\n');
  } else {
    for (const r of surface.backlog) {
      console.log(`- ${taskLine(r)}`);
    }
    console.log('');
  }
  console.log(`### Active projects\n`);
  if (surface.activeProjects.length === 0) {
    console.log('_None._\n');
  } else {
    for (const r of surface.activeProjects) {
      console.log(`- \`${r.slug}\` — ${r.title}  [${r.status}]`);
    }
    console.log('');
  }
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

export async function runToday(command: Command): Promise<void> {
  const ctx = commandContextFrom(command);
  const opts = command.opts<TodayCliOptions>();
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
      presentation.heading(ctx, 'today');
      for (const e of errors) {
        presentation.errorBlock(ctx, `${e.code}: ${e.message}`);
      }
      return;
    }
    emitQuietFallback(ctx, errors.map((e) => e.message).join('; '));
    return;
  }

  const db = openAndMigrate(resolved.value.databaseAbsolutePath);
  const surface = buildDailySurface({
    db,
    upcomingDays,
  });

  const data = {
    date: surface.date,
    upcoming_days: upcomingDays,
    workspace_root: resolved.value.workspaceRoot,
    inbox: { count: surface.inboxCount, sample: surface.inboxSample.map(listedRowJson) },
    overdue: surface.overdue.map(listedRowJson),
    due_today: surface.dueToday.map(listedRowJson),
    upcoming: surface.upcoming.map(listedRowJson),
    focus: surface.focus.map(listedRowJson),
    backlog: {
      total: surface.backlog_total,
      preview: surface.backlog.map(listedRowJson),
    },
    active_projects: surface.activeProjects.map(listedRowJson),
  };

  const env = successEnvelope(data, warningsWhenAiDisabled(resolved.value.config), [
    'Run `second-brain-os dashboard show` for the full home view.',
    'Use `second-brain-os list tasks --due YYYY-MM-DD` to filter by date.',
  ]);

  if (isJsonOutput(ctx)) {
    printJsonEnvelope(env);
    return;
  }

  if (ctx.outputFormat === 'markdown') {
    if (env.warnings.length > 0) {
      console.log('## Warnings\n');
      for (const w of env.warnings) {
        console.log(`- **${w.code}**: ${w.message}`);
      }
      console.log('');
    }
    printMarkdownToday(surface, upcomingDays);
    return;
  }

  if (shouldPrintHuman(ctx)) {
    presentation.heading(ctx, `today · ${surface.date}`);
    for (const w of env.warnings) {
      presentation.warningBlock(ctx, `${w.code}: ${w.message}`);
    }
    presentation.bodyLine(ctx, `Inbox: ${String(surface.inboxCount)} · Upcoming window: ${String(upcomingDays)}d`);
    presentation.bodyLine(ctx, '');

    const section = (label: string, rows: readonly ListedEntityRow[]) => {
      presentation.bodyLine(ctx, `${label} (${String(rows.length)})`);
      if (rows.length === 0) {
        presentation.bodyLine(ctx, '  (none)');
        return;
      }
      for (const r of rows) {
        presentation.bodyLine(ctx, `  ${taskLine(r)}`);
      }
    };

    section('Overdue', surface.overdue);
    presentation.bodyLine(ctx, '');
    section('Due today', surface.dueToday);
    presentation.bodyLine(ctx, '');
    section(`Next ${String(upcomingDays)} days`, surface.upcoming);
    presentation.bodyLine(ctx, '');
    section('Focus', surface.focus);
    presentation.bodyLine(ctx, '');
    presentation.bodyLine(ctx, `Backlog — undated, non-focus (${String(surface.backlog_total)})`);
    if (surface.backlog_total > surface.backlog.length) {
      presentation.bodyLine(
        ctx,
        `  (showing ${String(surface.backlog.length)} of ${String(surface.backlog_total)})`,
      );
    }
    if (surface.backlog.length === 0) {
      presentation.bodyLine(ctx, '  (none)');
    } else {
      for (const r of surface.backlog) {
        presentation.bodyLine(ctx, `  ${taskLine(r)}`);
      }
    }
    presentation.bodyLine(ctx, '');
    presentation.bodyLine(ctx, `Active projects (${String(surface.activeProjects.length)})`);
    if (surface.activeProjects.length === 0) {
      presentation.bodyLine(ctx, '  (none)');
    } else {
      for (const r of surface.activeProjects) {
        presentation.bodyLine(ctx, `  ${r.slug} — ${r.title}  [${r.status}]`);
      }
    }
    presentation.suggestions(ctx, env.next_actions);
  }
}

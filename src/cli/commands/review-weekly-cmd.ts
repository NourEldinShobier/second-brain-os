import type { Command } from 'commander';
import { warningsWhenAiDisabled } from '../../application/ai-degraded-warnings.js';
import { buildWeeklyReviewReport, persistWeeklyReview, renderWeeklyReviewMarkdown } from '../../application/weekly-review.js';
import { openAndMigrate } from '../../infrastructure/db/open-database.js';
import { errorEnvelope, successEnvelope } from '../../shared/envelope.js';
import { ErrorCodes } from '../../shared/error-codes.js';
import { printJsonEnvelope } from '../../shared/print-envelope.js';
import { recoverableError } from '../../shared/recoverable.js';
import { cliFailed, emitQuietFallback } from '../cli-feedback.js';
import { commandContextFrom } from '../context.js';
import { isJsonOutput, shouldPrintHuman } from '../output-policy.js';
import { workspaceFailureToErrors } from '../map-workspace-failure.js';
import * as presentation from '../presentation/blocks.js';
import { resolveWorkspaceForCli } from '../workspace-resolve.js';

export async function runReviewWeekly(command: Command): Promise<void> {
  const ctx = commandContextFrom(command);

  const resolved = await resolveWorkspaceForCli(ctx);
  if (!resolved.ok) {
    const errors = workspaceFailureToErrors(resolved.error);
    const env = errorEnvelope(errors, ['Run `second-brain-os init` or set `--workspace`.']);
    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return;
    }
    if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'review weekly');
      for (const e of errors) {
        presentation.errorBlock(ctx, `${e.code}: ${e.message}`);
      }
    }
    return;
  }

  const db = openAndMigrate(resolved.value.databaseAbsolutePath);
  const model = buildWeeklyReviewReport(db, new Date());

  if (ctx.dryRun) {
    const env = successEnvelope(
      {
        dry_run: true,
        date: model.date,
        would_write: `07-reviews/weekly/${model.date}-weekly-review.md`,
        sections: {
          inbox_count: model.inboxCount,

          overdue: model.overdueTasks.length,
          focus: model.focusTasks.length,
          upcoming: model.upcomingTasks.length,
          stale: model.staleTasks.length,
          recently_completed: model.recentlyCompletedTasks.length,
        },
      },
      [],
      ['Run without --dry-run to write the markdown file and log the review.'],
    );
    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return;
    }
    if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'review weekly (dry run)');
      presentation.bodyLine(ctx, `Would write 07-reviews/weekly/${model.date}-weekly-review.md`);
    }
    return;
  }

  const saved = await persistWeeklyReview(resolved.value.workspaceRoot, db, {});
  if (!saved.ok) {
    cliFailed();
    const env = errorEnvelope([recoverableError(ErrorCodes.INTERNAL, saved.error)], []);
    if (isJsonOutput(ctx)) {
      printJsonEnvelope(env);
      return;
    }
    if (shouldPrintHuman(ctx)) {
      presentation.heading(ctx, 'review weekly');
      presentation.errorBlock(ctx, saved.error);
      return;
    }
    emitQuietFallback(ctx, saved.error);
    return;
  }

  const data = {
    review_id: saved.value.reviewId,
    artifact_path: saved.value.artifactRelativePath,
    workspace_root: resolved.value.workspaceRoot,
    date: model.date,
    report: {
      inbox_count: model.inboxCount,

      overdue_tasks: model.overdueTasks.map((t) => ({ slug: t.slug, title: t.title })),
      focus_tasks: model.focusTasks.map((t) => ({ slug: t.slug, title: t.title })),
      upcoming_tasks: model.upcomingTasks.map((t) => ({ slug: t.slug, title: t.title, do_date: t.do_date })),
      stale_tasks: model.staleTasks.map((t) => ({ slug: t.slug, title: t.title, updated_at: t.updated_at })),
      recently_completed: model.recentlyCompletedTasks.map((t) => ({ slug: t.slug, title: t.title })),
    },
  };

  const env = successEnvelope(data, warningsWhenAiDisabled(resolved.value.config), [
    'Open the saved markdown under `07-reviews/weekly/` to complete the checklist.',
    'Re-run `second-brain-os dashboard show` for a fresh snapshot.',
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
    console.log(renderWeeklyReviewMarkdown(model));
    console.log(`\n_Saved to \`${saved.value.artifactRelativePath}\` (id \`${saved.value.reviewId}\`)._\n`);
    return;
  }

  if (shouldPrintHuman(ctx)) {
    presentation.heading(ctx, 'review weekly');
    for (const w of env.warnings) {
      presentation.warningBlock(ctx, `${w.code}: ${w.message}`);
    }
    presentation.bodyLine(ctx, `Saved ${saved.value.artifactRelativePath}`);
    presentation.bodyLine(
      ctx,
      `Inbox ${String(model.inboxCount)} · Overdue ${String(model.overdueTasks.length)} · Stale ${String(model.staleTasks.length)}`,
    );
    presentation.suggestions(ctx, env.next_actions);
  }
}

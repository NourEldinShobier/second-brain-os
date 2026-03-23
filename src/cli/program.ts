import { Command } from 'commander';
import { runCapture } from './commands/capture-cmd.js';
import { runConfigSet, runConfigShow } from './commands/config-cmd.js';
import { runDoctor } from './commands/doctor.js';
import { runInit } from './commands/init.js';
import { runList } from './commands/list-cmd.js';
import {
  runOrganizeAnalyze,
  runOrganizeLink,
  runOrganizePromote,
  runOrganizeRename,
  runOrganizeReclassify,
} from './commands/organize-cmd.js';
import { runArchive } from './commands/archive-cmd.js';
import { runDashboardShow } from './commands/dashboard-show-cmd.js';
import { runReviewWeekly } from './commands/review-weekly-cmd.js';
import { runSearch } from './commands/search-cmd.js';
import { runShow } from './commands/show-cmd.js';
import { runToday } from './commands/today-cmd.js';
import { VERSION } from '../shared/version.js';

export function createProgram(): Command {
  const program = new Command();
  program
    .name('second-brain-os')
    .description(
      'Second Brain OS — local-first capture, organize, and review (Markdown + SQLite).',
    )
    .version(VERSION, '-v, --version')
    .option('--format <mode>', 'output format: pretty, markdown, or json', 'pretty')
    .option('--json', 'shorthand for --format json', false)
    .option('-n, --non-interactive', 'disable interactive prompts', false)
    .option('-q, --quiet', 'minimal output', false)
    .option('--dry-run', 'show actions without persisting changes', false)
    .option(
      '--workspace <path>',
      'workspace root (overrides SECOND_BRAIN_WORKSPACE and directory walk)',
    );

  program
    .command('init')
    .description('Create and configure a workspace')
    .action(async (_options: unknown, command: Command) => {
      await runInit(command);
    });

  program
    .command('capture')
    .description('Fast entry into inbox or direct typed creation')
    .argument('[text...]', 'raw inbox text, or title when using --type')
    .option('--type <kind>', 'inbox | area | goal | project | task | resource | note')
    .option('--title <text>', 'title for typed capture')
    .option('--body <text>', 'body for typed capture')
    .option('--slug <slug>', 'override generated slug')
    .option('--url <url>', 'resource source URL')
    .option('--due <date>', 'task due date (ISO date)')
    .option('--priority <n>', 'integer priority (tasks)')
    .option('--notebook <name>', 'notebook label (notes)')
    .option('--energy <level>', 'energy label (tasks)')
    .option('--status <s>', 'workflow status override')
    .option('--pinned', 'pin a note')
    .option(
      '--area <ref>',
      'area id or slug (repeatable; required for goal/project)',
      (value: string, previous: string[]) => [...previous, value],
      [] as string[],
    )
    .option(
      '--project <ref>',
      'project id or slug (repeatable; optional for tasks)',
      (value: string, previous: string[]) => [...previous, value],
      [] as string[],
    )
    .action(async (textParts: string[] | undefined, _options: unknown, command: Command) => {
      await runCapture(command, textParts ?? []);
    });

  const organize = program
    .command('organize')
    .description('Classify, reclassify, link, rename, or clean up items');

  organize
    .command('analyze')
    .description('Suggest inbox classifications using heuristics')
    .option('--limit <n>', 'max inbox items to analyze', '20')
    .action(async (opts: { limit?: string }, command: Command) => {
      await runOrganizeAnalyze(opts, command);
    });

  organize
    .command('promote')
    .description('Promote an inbox item to a typed entity')
    .requiredOption('--from <ref>', 'inbox slug or id')
    .requiredOption('--to <kind>', 'area | task | note | resource | goal | project')
    .option(
      '--area <ref>',
      'area id or slug (repeatable; required for goal/project)',
      (value: string, previous: string[]) => [...previous, value],
      [] as string[],
    )
    .option(
      '--project <ref>',
      'project id or slug (repeatable)',
      (value: string, previous: string[]) => [...previous, value],
      [] as string[],
    )
    .action(
      async (
        opts: { from?: string; to?: string; area?: string[]; project?: string[] },
        command: Command,
      ) => {
        await runOrganizePromote(opts, command);
      },
    );

  organize
    .command('rename')
    .description('Rename an entity file (title/slug) and sync the index')
    .requiredOption('--path <rel>', 'workspace-relative path to .md')
    .option('--title <text>', 'new title')
    .option('--slug <slug>', 'new slug')
    .action(async (opts: { path?: string; title?: string; slug?: string }, command: Command) => {
      await runOrganizeRename(opts, command);
    });

  organize
    .command('link')
    .description('Attach areas and/or projects to an entity')
    .requiredOption('--path <rel>', 'workspace-relative path')
    .option(
      '--area <ref>',
      'area id or slug (repeatable)',
      (value: string, previous: string[]) => [...previous, value],
      [] as string[],
    )
    .option(
      '--project <ref>',
      'project id or slug (repeatable)',
      (value: string, previous: string[]) => [...previous, value],
      [] as string[],
    )
    .action(
      async (opts: { path?: string; area?: string[]; project?: string[] }, command: Command) => {
        await runOrganizeLink(opts, command);
      },
    );

  organize
    .command('reclassify')
    .description('Change kind among note, resource, or task (stable id preserved)')
    .requiredOption('--path <rel>', 'workspace-relative path to .md')
    .requiredOption('--to <kind>', 'note | resource | task')
    .action(async (opts: { path?: string; to?: string }, command: Command) => {
      await runOrganizeReclassify(opts, command);
    });

  program
    .command('today')
    .description('Render the daily action zone')
    .option('--days <n>', 'days ahead for upcoming tasks (1–30)', '7')
    .action(async (_options: unknown, command: Command) => {
      await runToday(command);
    });

  const dashboard = program
    .command('dashboard')
    .description('Render the generated home view');

  dashboard
    .command('show')
    .description('Print the dashboard')
    .option('--days <n>', 'days ahead for upcoming tasks in the daily section (1–30)', '7')
    .action(async (_options: unknown, command: Command) => {
      await runDashboardShow(command);
    });

  program
    .command('list')
    .description('Filter and list entities from the index')
    .argument('[entity]', 'tasks, areas, goals, projects, notes, resources, inbox')
    .option('--status <s>', 'filter by workflow status')
    .option('--include-archived', 'include archived entities')
    .option('--limit <n>', 'max items (default 100, max 500)', '100')
    .option('--due <date>', 'tasks only: filter by do_date (YYYY-MM-DD)')
    .action(async (entity: string | undefined, _options: unknown, command: Command) => {
      await runList(command, entity);
    });

  program
    .command('show')
    .description('Inspect a single entity with related context')
    .argument('<target>', 'entity slug or id')
    .option('--include-archived', 'include archived entities')
    .action(async (target: string, _options: unknown, command: Command) => {
      await runShow(command, target);
    });

  program
    .command('search')
    .description('Search titles, content, and metadata')
    .argument('[query...]', 'search query')
    .option('--limit <n>', 'max results (1–200)', '50')
    .option('--expand', 'include relationship rows for each hit', false)
    .action(async (parts: string[] | undefined, _options: unknown, command: Command) => {
      await runSearch(command, parts ?? []);
    });

  const review = program.command('review').description('Run weekly review and declutter flows');

  review
    .command('weekly')
    .description('Run the weekly review flow')
    .action(async (_options: unknown, command: Command) => {
      await runReviewWeekly(command);
    });

  program
    .command('archive')
    .description('Archive or restore entities')
    .argument('<kind>', 'area | goal | project | task | resource | note | inbox')
    .argument('<slug>', 'entity slug')
    .option('--restore', 'restore from archive to active', false)
    .option('--reason <text>', 'optional reason when archiving')
    .action(async (kind: string, slug: string, _options: unknown, command: Command) => {
      await runArchive(command, kind, slug);
    });

  program
    .command('doctor')
    .description('Validate configuration, indexing, and data health')
    .option('--repair', 'reindex from disk and prune orphan index rows for missing files', false)
    .action(async (_options: unknown, command: Command) => {
      await runDoctor(command);
    });

  const configCmd = program
    .command('config')
    .description('Inspect and update local configuration');

  configCmd
    .command('show')
    .description('Print resolved configuration')
    .action(async (_options: unknown, command: Command) => {
      await runConfigShow(command);
    });

  configCmd
    .command('set')
    .description('Update a config field')
    .argument('<key>', 'output_style | database_path | ai_provider')
    .argument('<value>', 'new value (use null for ai_provider; only openai is supported)')
    .action(async (key: string, value: string, _options: unknown, command: Command) => {
      await runConfigSet(command, key, value);
    });

  return program;
}

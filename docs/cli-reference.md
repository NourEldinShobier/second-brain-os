# ⌨️ CLI Command Reference

> **Reading order:** This is document **3 of 4**.
> Previous → [vault-structure.md](./vault-structure.md) | Next → [schema.md](./schema.md)

Complete reference for every `second-brain-os` command, flag, and option.

**Aliases:** `second-brain-os` and `second-brain` are identical. Examples use `sb` as a shorthand — substitute your actual command.

---

## Table of Contents

1. [Global Flags](#global-flags)
2. [Environment Variables](#environment-variables)
3. [Command Tree Overview](#command-tree-overview)
4. [Setup Commands](#setup-commands)
   - [init](#init)
   - [config show](#config-show)
   - [config set](#config-set)
5. [Capture](#capture)
6. [Organize Commands](#organize-commands)
   - [organize analyze](#organize-analyze)
   - [organize promote](#organize-promote)
   - [organize rename](#organize-rename)
   - [organize link](#organize-link)
   - [organize reclassify](#organize-reclassify)
7. [Query Commands](#query-commands)
   - [list](#list)
   - [show](#show)
   - [search](#search)
8. [Surface Commands](#surface-commands)
   - [today](#today)
   - [dashboard show](#dashboard-show)
9. [Archive](#archive)
10. [Asset Commands](#asset-commands)
    - [asset add](#asset-add)
    - [asset list](#asset-list)
    - [asset remove](#asset-remove)

11. [Drive Commands](#drive-commands)
    - [drive import](#drive-import)
    - [drive list](#drive-list)
    - [drive show](#drive-show)
    - [drive link](#drive-link)
    - [drive update](#drive-update)
    - [drive archive](#drive-archive)
    - [drive restore](#drive-restore)
12. [Health Commands](#health-commands)
    - [doctor](#doctor)
13. [Exit Codes & JSON Envelope](#exit-codes--json-envelope)

---

## Global Flags

These flags apply to **every command** and must be placed **before** the subcommand name:

```
second-brain-os [GLOBAL FLAGS] <command> [command flags]
```

```
┌──────────────────────────────┬────────────────────────────────────────────────────┐
│ Flag                         │ Description                                        │
├──────────────────────────────┼────────────────────────────────────────────────────┤
│ --format <mode>              │ Output style: pretty (default) | markdown | json   │
│ --json                       │ Shorthand for --format json                        │
│ -n, --non-interactive        │ Disable all interactive prompts (for scripts/CI)   │
│ -q, --quiet                  │ Minimal output; suppress progress messages         │
│ --dry-run                    │ Preview actions — nothing is persisted to disk/DB  │
│ --workspace <path>           │ Vault root directory (overrides env var + walk)    │
│ -v, --version                │ Print CLI version and exit                         │
│ -h, --help                   │ Print help for current command                     │
└──────────────────────────────┴────────────────────────────────────────────────────┘
```

**Usage example:**

```bash
# JSON output, no prompts, explicit workspace
sb --format json --non-interactive --workspace ~/MyVault list tasks
```

---

## Environment Variables

```
┌──────────────────────────────┬────────────────────────────────────────────────────┐
│ Variable                     │ Description                                        │
├──────────────────────────────┼────────────────────────────────────────────────────┤
│ SECOND_BRAIN_WORKSPACE       │ Default vault path when --workspace is not passed  │
└──────────────────────────────┴────────────────────────────────────────────────────┘
```

```bash
# PowerShell
$env:SECOND_BRAIN_WORKSPACE = "D:\MyVault"

# bash / zsh
export SECOND_BRAIN_WORKSPACE="$HOME/MyVault"
```

---

## Command Tree Overview

```
second-brain-os
│
├── init                            Set up a new vault
├── capture [text...]               Fast capture to inbox or typed entity
│
├── organize
│   ├── analyze                     Heuristic inbox suggestions
│   ├── promote --from --to         Promote inbox → typed entity
│   ├── rename  --path              Rename entity (title + slug)
│   ├── link    --path              Attach areas/projects to entity
│   └── reclassify --path --to      Change kind (note/resource/task)
│
├── list [entity]                   Filter and list entities
├── show <target>                   Inspect single entity with context
├── search [query...]               Full-text + metadata search
│
├── today                           Daily action surface
├── dashboard
│   └── show                        Home-style aggregated view
│
├── archive <kind> <slug>           Archive or restore an entity
│
├── asset
│   ├── add <entity> <file>         Attach a file to an entity
│   ├── list <entity>               List entity's assets
│   └── remove <entity> <asset_ref> Remove an asset
│
├── drive
│   ├── import <path>               Import file/folder into drive
│   ├── import <path> --primary <link>  Import with primary link
│   ├── list                        List drive items
│   ├── list --inbox                List unsorted items (no primary link)
│   ├── list --primary <entity>     List items by primary entity
│   ├── show <ref>                  Show a drive item
│   ├── set-primary <ref> --area <slug>  Set primary location (moves dir)
│   ├── move <ref> --slug <new-slug> Rename/move drive item
│   ├── structure                   Show drive folder structure
│   ├── migrate                     Migrate flat items to PARA folders
│   ├── link <drive_ref>            Link drive item to entities
│   ├── update <drive_ref>          Update drive item metadata
│   ├── archive <slug>              Archive drive item
│   └── restore <slug>              Restore archived drive item
│
├── resolve
│   ├── parent --task <ref>         Resolve task's parent for drive path
│   ├── parent --note <ref>         Resolve note's parent for drive path
│   ├── parent --goal <ref>         Resolve goal's parent for drive path
│   └── entity <type> <ref>         Resolve entity details
│
├── exists <type> <ref>             Check if entity exists (returns bool)
│
├── doctor                          Validate + optionally repair vault
│
└── config
    ├── show                        Print resolved config
    └── set <key> <value>           Update a config field
```

---

## Setup Commands

### `init`

Create and configure a new vault workspace.

```bash
sb init
sb init --non-interactive --workspace ~/MyVault
```

**Flags:**

| Flag                 | Description                          |
| -------------------- | ------------------------------------ |
| `--non-interactive`  | Skip prompts; requires `--workspace` |
| `--workspace <path>` | Where to create the vault            |

**What it does:**

- Creates the numbered folder structure (`00-inbox/` through `99-archive/`)
- Writes `.second-brain/config.yml`
- Initializes and migrates the SQLite database
- Optionally creates starter content

---

### `config show`

Print the resolved workspace configuration.

```bash
sb config show
sb config show --format json
```

**Output includes:** `schema_version`, `database_path`, `output_style`, `ai_provider`.

---

### `config set`

Update a single configuration field.

```bash
sb config set output_style json
sb config set database_path /data/mybrain.db
sb config set ai_provider openai
sb config set ai_provider null        # disable AI
```

**Valid keys:**

| Key             | Valid values                                  |
| --------------- | --------------------------------------------- |
| `output_style`  | `pretty` \| `markdown` \| `json`              |
| `database_path` | Any file path (relative to vault or absolute) |
| `ai_provider`   | `openai` \| `null`                            |

---

## Capture

### `capture`

Fast entry point — creates an inbox item by default, or a typed entity with `--type`.

```bash
# Raw inbox capture (most common)
sb capture "remember to book dentist"
sb capture "idea: refactor the capture flow"

# Typed capture — creates entity directly
sb capture --type task --title "Write Q1 Report" --due 2026-03-31 --priority 1
sb capture --type note --title "Meeting notes" --notebook "Work"
sb capture --type goal --title "Get fit by summer" --area health
sb capture --type resource --title "Atomic Habits" --url https://jamesclear.com/atomic-habits
sb capture --type area --title "Health"
sb capture --type project --title "Website Redesign" --area work
```

**Arguments:**

| Argument    | Description                                  |
| ----------- | -------------------------------------------- |
| `[text...]` | Raw inbox text, or title when using `--type` |

**Flags:**

| Flag                 | Description                                                                |
| -------------------- | -------------------------------------------------------------------------- |
| `--type <kind>`      | `inbox` \| `area` \| `goal` \| `project` \| `task` \| `resource` \| `note` |
| `--title <text>`     | Title for typed capture                                                    |
| `--body <text>`      | Body markdown content                                                      |
| `--body-file <path>` | Body from file, or `-` for stdin                                           |
| `--slug <slug>`      | Override auto-generated slug                                               |
| `--url <url>`        | Resource source URL                                                        |
| `--due <date>`       | Task `do_date` (ISO: `YYYY-MM-DD`)                                         |
| `--priority <n>`     | Integer priority (tasks)                                                   |
| `--notebook <name>`  | Notebook label (notes)                                                     |
| `--energy <level>`   | Energy label: `low` \| `medium` \| `high` (tasks)                          |
| `--status <s>`       | Workflow status override                                                   |
| `--pinned`           | Pin a note                                                                 |
| `--area <ref>`       | Area id or slug (repeatable; required for goal/project)                    |
| `--project <ref>`    | Project id or slug (repeatable; optional for tasks)                        |

**Task status and the daily surface:**

Tasks appear in `today` / `dashboard show` only if:

- They have a `do_date` set (appear in Overdue / Due Today / Upcoming), OR
- They are in a focus status (`next`, `in-progress`, `do-next`)

Tasks without a `do_date` and not in a focus status are counted as **Backlog**.

---

## Organize Commands

### `organize analyze`

Analyze unprocessed inbox items and suggest what kind of entity each should become. Uses heuristics (and optionally AI if configured).

```bash
sb organize analyze
sb organize analyze --limit 10
sb organize analyze --format json
```

**Flags:**

| Flag          | Default | Description                |
| ------------- | ------- | -------------------------- |
| `--limit <n>` | `20`    | Max inbox items to analyze |

---

### `organize promote`

Promote an inbox item into a typed entity (area, goal, project, task, resource, or note).

```bash
sb organize promote --from my-inbox-slug --to task
sb organize promote --from my-inbox-slug --to project --area work
sb organize promote --from my-inbox-slug --to goal --area health
```

**Required flags:**

| Flag           | Description                                                     |
| -------------- | --------------------------------------------------------------- |
| `--from <ref>` | Inbox item slug or id                                           |
| `--to <kind>`  | `area` \| `task` \| `note` \| `resource` \| `goal` \| `project` |

**Optional flags:**

| Flag              | Description                                             |
| ----------------- | ------------------------------------------------------- |
| `--area <ref>`    | Area id or slug (repeatable; required for goal/project) |
| `--project <ref>` | Project id or slug (repeatable)                         |

**What it does:**

- Reads the inbox `index.md`
- Creates a new entity package in the correct folder
- Updates the frontmatter `kind` and `status`
- Inserts into the appropriate DB table
- Removes the original inbox package

---

### `organize rename`

Rename an entity — updates both the `title` and optionally the `slug`, syncing the file path and index.

```bash
sb organize rename --path 04-tasks/write-report/index.md --title "Write Annual Report"
sb organize rename --path 06-notes/old-idea/index.md --title "New Idea" --slug new-idea
```

**Required flags:**

| Flag           | Description                               |
| -------------- | ----------------------------------------- |
| `--path <rel>` | Workspace-relative path to the `.md` file |

**Optional flags:**

| Flag             | Description                                   |
| ---------------- | --------------------------------------------- |
| `--title <text>` | New display title                             |
| `--slug <slug>`  | New slug (also renames the package directory) |

---

### `organize link`

Attach one or more areas and/or projects to an existing entity. Updates frontmatter and `entity_links`.

```bash
sb organize link --path 04-tasks/write-report/index.md --area work --project q1-report
sb organize link --path 06-notes/my-note/index.md --area health --area personal
```

**Required flags:**

| Flag           | Description                       |
| -------------- | --------------------------------- |
| `--path <rel>` | Workspace-relative path to entity |

**Optional flags (at least one required):**

| Flag              | Description                     |
| ----------------- | ------------------------------- |
| `--area <ref>`    | Area id or slug (repeatable)    |
| `--project <ref>` | Project id or slug (repeatable) |

---

### `organize reclassify`

Change an entity's kind between `note`, `resource`, and `task` — preserving its stable UUID and moving the file to the correct folder.

```bash
sb organize reclassify --path 06-notes/meeting-summary/index.md --to task
sb organize reclassify --path 05-resources/article-draft/index.md --to note
```

**Required flags:**

| Flag           | Description                      |
| -------------- | -------------------------------- |
| `--path <rel>` | Workspace-relative path to `.md` |
| `--to <kind>`  | `note` \| `resource` \| `task`   |

**Constraint:** Only `note ↔ resource ↔ task` reclassification is supported (not area/goal/project/inbox).

---

## Query Commands

### `list`

Filter and list entities from the index.

```bash
sb list tasks
sb list tasks --status next
sb list tasks --due 2026-03-28
sb list projects --status active
sb list goals
sb list areas
sb list notes --status inbox
sb list resources
sb list inbox
sb list tasks --include-archived --limit 200
sb list tasks --format json
```

**Arguments:**

| Argument   | Description                                                                      |
| ---------- | -------------------------------------------------------------------------------- |
| `[entity]` | `tasks` \| `areas` \| `goals` \| `projects` \| `notes` \| `resources` \| `inbox` |

**Flags:**

| Flag                 | Default | Description                                  |
| -------------------- | ------- | -------------------------------------------- |
| `--status <s>`       | —       | Filter by workflow status                    |
| `--include-archived` | false   | Include archived entities                    |
| `--limit <n>`        | `100`   | Max results (max 500)                        |
| `--due <date>`       | —       | Tasks only: filter by `do_date` (YYYY-MM-DD) |

---

### `show`

Inspect a single entity with related context — linked entities, assets, relationships.

```bash
sb show write-q1-report
sb show 550e8400-e29b-41d4-a716-446655440000   # by UUID
sb show my-health-area --include-archived
sb show my-note --format json
```

**Arguments:**

| Argument   | Description         |
| ---------- | ------------------- |
| `<target>` | Entity slug or UUID |

**Flags:**

| Flag                 | Description               |
| -------------------- | ------------------------- |
| `--include-archived` | Resolve archived entities |

---

### `search`

Search titles, body content, and metadata across all entity kinds.

```bash
sb search dentist
sb search "Q1 report" --limit 20
sb search typescript --expand
sb search "meeting notes" --format json
```

**Arguments:**

| Argument     | Description                           |
| ------------ | ------------------------------------- |
| `[query...]` | Search terms (joined as single query) |

**Flags:**

| Flag          | Default | Description                            |
| ------------- | ------- | -------------------------------------- |
| `--limit <n>` | `50`    | Max results (1–200)                    |
| `--expand`    | false   | Include relationship rows for each hit |

---

## Surface Commands

### `today`

Render the daily action zone — shows what needs attention today: overdue tasks, due today, upcoming, focus queue, and backlog count.

```bash
sb today
sb today --days 14
sb today --format json
```

**Flags:**

| Flag         | Default | Description                          |
| ------------ | ------- | ------------------------------------ |
| `--days <n>` | `7`     | Days ahead for Upcoming tasks (1–30) |

**Sections shown:**

```
  ⚡ OVERDUE        Tasks with do_date < today
  📅 DUE TODAY      Tasks with do_date = today
  🔜 UPCOMING       Tasks with do_date within --days
  🎯 FOCUS          Tasks in "next" / "in-progress" status (no date)
  📦 BACKLOG        Count of undated, non-focus tasks
```

---

### `dashboard show`

Home-style aggregated view combining Today surface, active goals summary, project health, and recent captures.

```bash
sb dashboard show
sb dashboard show --days 14
sb dashboard show --format markdown
```

**Flags:**

| Flag         | Default | Description                           |
| ------------ | ------- | ------------------------------------- |
| `--days <n>` | `7`     | Days ahead for upcoming tasks section |

---

## Archive

### `archive`

Archive an entity (move to `99-archive/<kind>/`) or restore it (move back to active folder).

```bash
# Archive
sb archive task write-q1-report
sb archive task write-q1-report --reason "Completed in sprint"
sb archive note old-meeting-notes

# Restore
sb archive task write-q1-report --restore
sb archive note old-meeting-notes --restore
```

**Arguments:**

| Argument | Description                                                                |
| -------- | -------------------------------------------------------------------------- |
| `<kind>` | `area` \| `goal` \| `project` \| `task` \| `resource` \| `note` \| `inbox` |
| `<slug>` | Entity slug                                                                |

**Flags:**

| Flag              | Description                                |
| ----------------- | ------------------------------------------ |
| `--restore`       | Restore from archive to active folder      |
| `--reason <text>` | Optional reason stored in `archive_events` |

---

## Asset Commands

Manage binary files attached to entity packages under `assets/`.

### `asset add`

Copy a file into an entity's `assets/` folder and record it in the frontmatter manifest + `entity_assets` index.

```bash
sb asset add write-q1-report ./draft.pdf
sb asset add my-note ./screenshot.png --title "Homepage screenshot"
sb asset add my-note ./notes.txt --title "Raw notes" --description "From meeting"
```

**Arguments:**

| Argument   | Description         |
| ---------- | ------------------- |
| `<entity>` | Entity slug or UUID |
| `<file>`   | Source file path    |

**Flags:**

| Flag                   | Description            |
| ---------------------- | ---------------------- |
| `--title <text>`       | Optional display title |
| `--description <text>` | Optional description   |

---

### `asset list`

List assets attached to an entity (from the `entity_assets` index).

```bash
sb asset list write-q1-report
sb asset list my-note --format json
```

**Arguments:**

| Argument   | Description         |
| ---------- | ------------------- |
| `<entity>` | Entity slug or UUID |

---

### `asset remove`

Remove an asset — deletes the file and removes the manifest entry from frontmatter and DB.

```bash
sb asset remove write-q1-report assets/draft.pdf
sb asset remove my-note ccc00000-0000-0000-0000-000000000003  # by asset UUID
```

**Arguments:**

| Argument      | Description                                |
| ------------- | ------------------------------------------ |
| `<entity>`    | Entity slug or UUID                        |
| `<asset_ref>` | Asset UUID or path like `assets/photo.png` |

---

## Drive Commands

The drive is a vault area (`07-drive/`) for importing and organizing external files and folders. Drive items are not PARA entities but can be linked to any entity.

### `drive import`

Import a file or folder into the vault drive. By default imports to `000-inbox/`. Use `--primary` to place directly in a PARA folder.

```bash
sb drive import ./Project-Brief.pdf
sb drive import ./design-assets/ --title "Q1 Design Assets" --description "Figma exports"
sb drive import ./report.pdf --title "Annual Report" --move    # removes source
sb drive import ./data.csv --dry-run                           # preview only

# Import with primary location (skips inbox)
sb drive import ./health-report.pdf --primary area:health      # → 010-areas/health/
sb drive import ./design.fig --primary project:website-redesign # → 020-projects/website-redesign/
sb drive import ./reference.pdf --primary resource             # → 030-resources/
sb drive import ./temp.txt --primary inbox                     # → 000-inbox/ (explicit)
```

**Arguments:**

| Argument | Description                        |
| -------- | ---------------------------------- |
| `<path>` | Source file or directory to import |

**Flags:**

| Flag                   | Description                                                               |
| ---------------------- | ------------------------------------------------------------------------- |
| `--title <text>`       | Title (defaults to source basename)                                       |
| `--description <text>` | Description stored in front matter                                        |
| `--move`               | Remove the source after copying                                           |
| `--primary <link>`     | Primary location: `area:<slug>`, `project:<slug>`, `resource`, or `inbox` |

---

### `drive list`

List drive items with optional filters.

```bash
sb drive list
sb drive list --area work
sb drive list --project q1-report --goal get-fit
sb drive list --tag planning --tag q1
sb drive list --standalone true           # items with no entity links
sb drive list --include-archived
sb drive list --format json

# Primary link filters (Drive Organization)
sb drive list --inbox                      # Items without primary link (unsorted)
sb drive list --primary null               # Same as --inbox
sb drive list --primary area:health        # Items primarily in health area
sb drive list --primary project:my-app     # Items primarily in my-app project
sb drive list --under area:health          # Alias for --primary area:health
```

**Flags:**

| Flag                  | Description                                                       |
| --------------------- | ----------------------------------------------------------------- |
| `--include-archived`  | Include archived drive items                                      |
| `--area <ref>`        | Filter by area id/slug (repeatable)                               |
| `--project <ref>`     | Filter by project id/slug (repeatable)                            |
| `--task <ref>`        | Filter by task id/slug (repeatable)                               |
| `--note <ref>`        | Filter by note id/slug (repeatable)                               |
| `--goal <ref>`        | Filter by goal id/slug (repeatable)                               |
| `--tag <tag>`         | Filter by tag (repeatable)                                        |
| `--standalone <bool>` | `true` = no links; `false` = has links                            |
| `--inbox`             | Show items without primary link (unsorted)                        |
| `--primary <ref>`     | Filter by primary entity: `null`, `area:<slug>`, `project:<slug>` |
| `--under <ref>`       | Alias for `--primary` (more intuitive for browsing)               |

---

### `drive show`

Show a drive item's metadata and body.

```bash
sb drive show my-project-brief
sb drive show 550e8400-e29b-41d4-a716-446655440000  # by UUID
sb drive show archived-doc --include-archived
```

---

### `drive set-primary`

Set the primary link for a drive item, moving it to the appropriate PARA folder. This physically moves the drive item directory to reflect its organizational context.

```bash
# Move to an area folder
sb drive set-primary my-file --area health
sb drive set-primary my-file --area work

# Move to a project folder
sb drive set-primary my-file --project website-redesign
sb drive set-primary my-file --project q1-report

# Move to resources folder
sb drive set-primary my-file --resource

# Move to inbox (unsorted)
sb drive set-primary my-file --inbox

# Preview without moving
sb drive set-primary my-file --area health --dry-run
```

**Arguments:**

| Argument | Description             |
| -------- | ----------------------- |
| `<ref>`  | Drive item slug or UUID |

**Flags (exactly one required):**

| Flag               | Description                                     |
| ------------------ | ----------------------------------------------- |
| `--area <slug>`    | Link to area, move to `010-areas/<slug>/`       |
| `--project <slug>` | Link to project, move to `020-projects/<slug>/` |
| `--resource`       | Move to `030-resources/`                        |
| `--inbox`          | Move to `000-inbox/`                            |
| `--dry-run`        | Preview move without executing                  |

---

### `drive move`

Rename a drive item's slug, which renames its directory. Preserves primary link and all other metadata.

```bash
sb drive move my-old-slug --slug my-new-slug
sb drive move my-file --slug better-name --dry-run
```

**Arguments:**

| Argument | Description             |
| -------- | ----------------------- |
| `<ref>`  | Drive item slug or UUID |

**Flags:**

| Flag            | Description                      |
| --------------- | -------------------------------- |
| `--slug <slug>` | New slug (directory name)        |
| `--dry-run`     | Preview rename without executing |

---

### `drive structure`

Show the current drive folder structure with item counts. Useful for browsing and understanding organization.

```bash
sb drive structure
sb drive structure --format json
```

**JSON Output:**

```json
{
  "folders": [
    { "path": "000-inbox", "name": "Inbox", "count": 5 },
    { "path": "010-areas/health", "name": "Health & Fitness", "count": 3 },
    { "path": "020-projects/website-redesign", "name": "Website Redesign", "count": 2 }
  ],
  "unsorted_count": 5,
  "total_drive_items": 10
}
```

---

### `drive migrate`

Migrate existing flat drive items (from `07-drive/items/`) to the new PARA-organized structure.

```bash
# Move all flat items to inbox (conservative)
sb drive migrate --strategy inbox

# Use first entity link as primary (if any)
sb drive migrate --strategy first-link

# Preview without migrating
sb drive migrate --strategy inbox --dry-run

# Migrate only first 10 items
sb drive migrate --strategy inbox --limit 10
```

**Flags:**

| Flag                    | Description                                                  |
| ----------------------- | ------------------------------------------------------------ |
| `--strategy <strategy>` | `inbox` (move all to inbox) or `first-link` (use first link) |
| `--limit <n>`           | Only migrate first N items                                   |
| `--dry-run`             | Show migration plan without executing                        |

---

### `drive link`

Link a drive item to areas, projects, tasks, notes, or goals. Updates `item.md` frontmatter and the `drive_items` index row.

```bash
sb drive link my-project-brief --project q1-report --area work
sb drive link my-doc --goal get-fit --note meeting-2026-01
sb drive link my-doc --area work --replace       # replace existing area links
sb drive link my-doc --clear area,project        # clear specific kinds first
```

**Arguments:**

| Argument      | Description             |
| ------------- | ----------------------- |
| `<drive_ref>` | Drive item slug or UUID |

**Flags:**

| Flag                 | Description                                                         |
| -------------------- | ------------------------------------------------------------------- |
| `--area <ref>`       | Area id/slug (repeatable)                                           |
| `--project <ref>`    | Project id/slug (repeatable)                                        |
| `--task <ref>`       | Task id/slug (repeatable)                                           |
| `--note <ref>`       | Note id/slug (repeatable)                                           |
| `--goal <ref>`       | Goal id/slug (repeatable)                                           |
| `--replace`          | Replace (not merge) each provided kind                              |
| `--clear <kinds>`    | Comma-separated kinds to clear first: `area,project,task,note,goal` |
| `--include-archived` | Allow archived drive items                                          |

---

### `drive update`

Update drive item description, tags, or body in `item.md`.

```bash
sb drive update my-project-brief --description "Updated Q1 planning doc"
sb drive update my-doc --tag planning --tag 2026
sb drive update my-doc --clear-tags --tag revised
sb drive update my-doc --body "New notes about this document"
```

**Arguments:**

| Argument      | Description             |
| ------------- | ----------------------- |
| `<drive_ref>` | Drive item slug or UUID |

**Flags:**

| Flag                   | Description                            |
| ---------------------- | -------------------------------------- |
| `--description <text>` | New front matter description           |
| `--tag <tag>`          | Add tag (repeatable)                   |
| `--clear-tags`         | Remove all tags before adding new ones |
| `--body <text>`        | New markdown body                      |
| `--include-archived`   | Allow archived drive items             |

---

### `drive archive`

Move a drive item package to `99-archive/drive/`.

```bash
sb drive archive my-project-brief
sb drive archive my-old-doc --reason "Project completed"
```

**Flags:**

| Flag              | Description                       |
| ----------------- | --------------------------------- |
| `--reason <text>` | Archive reason stored in metadata |

---

### `drive restore`

Restore an archived drive item back to `07-drive/items/`.

```bash
sb drive restore my-project-brief
```

---

## Utility Commands

### `exists`

Check if an entity exists. Returns a simple boolean — useful for scripts and agents.

```bash
sb exists area health
sb exists project website-redesign
sb exists task write-report
sb exists note meeting-2026-03-15
sb exists goal get-fit

# Check by UUID
sb exists area 550e8400-e29b-41d4-a716-446655440000

# JSON output for automation
sb exists area health --format json
```

**Arguments:**

| Argument | Description                                            |
| -------- | ------------------------------------------------------ |
| `<type>` | Entity type: `area`, `goal`, `project`, `task`, `note` |
| `<ref>`  | Entity slug or UUID                                    |

**Output:**

- Human: prints `true` or `false`
- JSON: `{ "exists": true }` or `{ "exists": false }`

---

### `resolve`

Resolve entity relationships and hierarchy. Useful for AI agents making decisions about where to place drive items.

#### `resolve parent`

Find the parent entity for a task, note, or goal to determine appropriate drive folder placement.

```bash
# Resolve a task's parent (returns Project or Area)
sb resolve parent --task write-report
sb resolve parent --task 550e8400-e29b-41d4-a716-446655440000 --format json

# Resolve a note's parent
sb resolve parent --note meeting-notes

# Resolve a goal's parent (returns Area)
sb resolve parent --goal get-fit
```

**Output (JSON):**

```json
{
  "entity": {
    "type": "task",
    "id": "task-uuid",
    "slug": "write-report",
    "title": "Write Q1 Report"
  },
  "parent": {
    "type": "project",
    "id": "project-uuid",
    "slug": "q1-report",
    "title": "Q1 Report Project"
  },
  "suggested_path": "020-projects/q1-report/write-report",
  "suggested_primary": {
    "type": "project",
    "slug": "q1-report"
  },
  "ancestors": [
    { "type": "project", "slug": "q1-report", "title": "Q1 Report Project" },
    { "type": "area", "slug": "work", "title": "Work" }
  ],
  "reason": "Task links to project 'q1-report' which links to area 'work'"
}
```

#### `resolve entity`

Resolve any entity type to its full details including child counts.

```bash
sb resolve entity area health
sb resolve entity project website-redesign --format json
sb resolve entity task write-report
```

**Arguments:**

| Argument | Description                                            |
| -------- | ------------------------------------------------------ |
| `<type>` | Entity type: `area`, `goal`, `project`, `task`, `note` |
| `<ref>`  | Entity slug or UUID                                    |

---

## Health Commands

### `doctor`

Validate the vault's configuration, index consistency, and data health. The primary tool for detecting and fixing drift between files and the SQLite index.

```bash
# Check for issues
sb doctor
sb doctor --format json

# Preview what repair would do (no changes)
sb doctor --repair --dry-run
sb doctor --repair --dry-run --format json

# Actually repair
sb doctor --repair
sb doctor --repair --format json
```

**Flags:**

| Flag       | Description                                   |
| ---------- | --------------------------------------------- |
| `--repair` | Reindex from disk and prune orphan index rows |

**Recommended repair workflow:**

```
1. sb doctor                    ← See what's wrong
2. sb doctor --repair --dry-run ← Preview the fix
3. sb doctor --repair           ← Apply the fix
4. sb doctor                    ← Confirm clean
```

**What doctor checks:**

- Config file is valid and parseable
- Database exists and is reachable
- Every indexed entity has a file on disk
- Every entity file in vault folders is indexed
- File paths in DB match actual disk paths
- Frontmatter IDs match DB IDs
- No orphaned `entity_links` rows
- **Drive items:** `item_path` matches actual disk location
- **Drive items:** Primary entity reference exists and is valid
- **Drive items:** Items in inbox have no primary link (or warning if they do)

---

## Exit Codes & JSON Envelope

### Exit Codes

```
0   Success
1   Command failed (check errors[] in JSON mode)
```

### JSON Envelope Shape

Every command with `--format json` returns:

```json
{
  "ok": true,
  "schema_version": "1.0.0",
  "data": {},
  "warnings": [],
  "errors": [],
  "next_actions": []
}
```

On failure (`ok: false`), `data` is `null` and `errors` contains objects:

```json
{
  "ok": false,
  "schema_version": "1.0.0",
  "data": null,
  "warnings": [],
  "errors": [{ "code": "ENTITY_NOT_FOUND", "message": "No task with slug 'bad-slug'" }],
  "next_actions": ["second-brain-os list tasks --format json"]
}
```

**Parsing contract (for scripts/agents):**

1. Check `ok` first
2. If `false` — read `errors[].message` and follow `next_actions`
3. If `true` — consume `data`, optionally log `warnings`

---

> **Next:** [schema.md](./schema.md) — Deep-dive into the SQLite database schema.

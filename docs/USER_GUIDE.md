# Second Brain OS — User & integration guide

This document explains what the **Second Brain OS** CLI (`second-brain-os`, alias `second-brain`) is, how it is structured, how to install and use it from the terminal, how **JSON output** works for automation and agents, and how to use the **Cursor skill** so an AI assistant drives the real CLI instead of guessing files or SQL.

**Package:** [`second-brain-os` on npm](https://www.npmjs.com/package/second-brain-os) (install with `npm install -g second-brain-os`). The unrelated npm package **`second-brain`** is not this project.

**Related docs:** [README.md](../README.md) (overview, quick start, repository layout). [DEV_GUIDE.md](DEV_GUIDE.md) (contributor setup, tests, Drizzle, releases).

---

## 1. What this tool is

**Second Brain OS** (`second-brain-os`) is a **local-first** command-line application that helps you run a personal knowledge system (“second brain”) on disk:

- **Markdown files** are the durable source of truth for notes, tasks, projects, areas, goals, resources, inbox captures, and review artifacts.
- A **SQLite database** (indexed metadata) keeps queries, search, and dashboards fast and consistent with what is on disk.
- The CLI **captures**, **organizes**, **lists**, **searches**, **reviews**, **archives**, and **repairs** drift between files and the index—without requiring a hosted service.

Think of it as: **files you own** + **a local index** + **one consistent command surface** (`second-brain-os` / `second-brain`).

---

## 2. High-level architecture

| Layer | Role |
|--------|------|
| **CLI** (`second-brain-os`) | Parses flags, resolves the workspace, prints human or JSON output. |
| **Application services** | Capture, organize, entity CRUD, doctor, reviews, etc. |
| **Markdown repository** | Reads/writes `.md` with front matter; stable IDs and paths. |
| **SQLite + Drizzle** | Schema, migrations, index rows linked to files. |
| **Workspace config** | `.second-brain/config.yml` — database path, output style, optional AI provider. |

**Workspace discovery**

1. If you pass **`--workspace <path>`**, that directory is the vault root (resolved relative to the current working directory).
2. Else if **`SECOND_BRAIN_WORKSPACE`** is set, that path is used.
3. Else the CLI **walks upward** from the current directory looking for **`.second-brain/config.yml`**.

If none of that finds a config, commands that need a workspace will fail until you run **`init`** or set **`--workspace`** / **`SECOND_BRAIN_WORKSPACE`**.

---

## 3. Prerequisites

- **Node.js 20+** (see `package.json` → `engines`).
- **Native build tools** may be required once: the dependency **better-sqlite3** compiles on install. See [better-sqlite3 troubleshooting](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/troubleshooting.md) if install fails (common on Windows without Visual Studio Build Tools).

---

## 4. Installation and how to run the CLI

### 4.1 Install from npm (recommended)

Install globally, then use **`second-brain-os`** or the short alias **`second-brain`** from any directory:

```bash
npm install -g second-brain-os
second-brain-os --version
second-brain-os --help
```

One-off without a global install (downloads the package from the registry):

```bash
npx second-brain-os doctor --format json --workspace ~/SecondBrain
```

This is the path most users should follow. Examples below use **`sb`** as a stand-in for **`second-brain-os`** (or **`second-brain`**); substitute your actual command.

### 4.2 Build and run from the repository (development)

If you are working on a **git clone** of this repo, from the repository root:

```bash
npm install
npm run build
```

The compiled entry is **`dist/cli/index.js`**. The package **`bin`** maps **`second-brain-os`** (and **`second-brain`**) to that file.

**Ways to invoke during development**

```bash
# One command: build + run (from repo root; see DEV_GUIDE for npm flag quirks on Windows)
node scripts/dev-run.mjs --help

# From repo root after build
npx second-brain-os --help

# Or explicitly
node dist/cli/index.js --help
```

**`npx second-brain-os` only works when npm can see this package.** That means either:

- Your shell’s current directory is the **cloned repo** (with `node_modules` installed and `npm run build` done), or  
- You use `npx --prefix /path/to/second-brain-os second-brain-os ...`, or  
- You run `node /path/to/second-brain-os/dist/cli/index.js ...` directly.

It does **not** work if you `cd` into a **vault directory** that only contains Markdown and `.second-brain/`—that folder is not an npm package, so `npx` fails with *could not determine executable to run*. For that case, use a **global** install (`npm install -g second-brain-os`), **`SECOND_BRAIN_WORKSPACE`**, or **`--workspace`**, or run `node` with an absolute path to `dist/cli/index.js`.

To link the clone globally: **`npm link`** once in the repo after `npm run build`.

---

## 5. First-time setup: creating a vault

### Interactive init (recommended for humans)

If you installed from npm:

```bash
second-brain-os init
```

If you are developing from a clone (after `npm run build`):

```bash
cd /path/to/second-brain-os
npx second-brain-os init
```

You will be prompted for a folder. The tool creates the canonical layout, config, database, and starter content where appropriate.

### Non-interactive init (scripts / CI / agents)

You **must** pass both **`--non-interactive`** and **`--workspace`**:

```bash
second-brain-os init --non-interactive --workspace ~/SecondBrain
```

(From a dev clone you can use `npx second-brain-os` instead of `second-brain-os` the same way.)

Then point later commands at the same workspace with **`--workspace`** or **`SECOND_BRAIN_WORKSPACE`**.

---

## 6. Typical vault layout

The CLI expects a **PARA-style** folder structure (numbered prefixes may vary by version; your initialized vault is authoritative). Common areas include:

- Inbox for quick capture  
- Areas, goals, projects, tasks, resources, notes  
- Reviews (daily / weekly)  
- Archive  
- **`.second-brain/`** — `config.yml`, SQLite path, indexes/state as implemented  

Exact folders are created by **`init`** and documented in your workspace after setup.

---

## 7. Global options (all subcommands)

These apply **before** the subcommand (e.g. `second-brain-os --format json doctor`).

| Option | Meaning |
|--------|---------|
| `--format <mode>` | `pretty` (default), `markdown`, or `json`. |
| `--json` | Shorthand for `--format json`. |
| `-n`, `--non-interactive` | Disable interactive prompts. |
| `-q`, `--quiet` | Minimal output (still errors; JSON mode behaves as designed). |
| `--dry-run` | Preview actions where supported (no persistent changes). |
| `--workspace <path>` | Vault root (overrides walk + `SECOND_BRAIN_WORKSPACE`). |
| `-v`, `--version` | Print CLI version. |

**Environment**

| Variable | Role |
|----------|------|
| `SECOND_BRAIN_WORKSPACE` | Default vault root when `--workspace` is omitted. |

---

## 8. JSON envelope (for scripts and agents)

When **`--format json`** or **`--json`** is used, successful and failed operations are printed as a single JSON object with **stable top-level keys**:

| Field | Purpose |
|-------|---------|
| `ok` | `true` on success, `false` on failure. |
| `schema_version` | Envelope version (e.g. `1.0.0`). |
| `data` | Command-specific payload, or `null` on failure. |
| `warnings` | Non-fatal issues. |
| `errors` | On failure: `{ code, message, details? }[]`. |
| `next_actions` | Suggested follow-up commands or fixes. |

**Always** parse `ok` and, on failure, `errors` and `next_actions` before treating output as success.

Example (conceptual success):

```json
{
  "ok": true,
  "schema_version": "1.0.0",
  "data": { "...": "command-specific" },
  "warnings": [],
  "errors": [],
  "next_actions": ["..."]
}
```

---

## 9. Command overview

Below, **`sb`** means your invocation prefix, e.g. `npx second-brain-os` or `second-brain-os` (or the short alias `second-brain`).

### Workspace & config

| Command | Purpose |
|---------|---------|
| `sb init` | Create/configure workspace (see §5). |
| `sb config show` | Print resolved configuration. |
| `sb config set <key> <value>` | Update `output_style`, `database_path`, or `ai_provider`. |

Valid **`ai_provider`** values: **`openai`** or **`null`** (local-only / deterministic paths).

### Capture

| Command | Purpose |
|---------|---------|
| `sb capture "raw text"` | Raw **inbox** capture (default when no `--type`). |
| `sb capture --type task "Title"` | Typed capture (`area`, `goal`, `project`, `task`, `resource`, `note`, or `inbox`). |

Typed capture supports options such as `--title`, `--body`, `--slug`, `--area`, `--project`, `--url`, `--due`, `--priority`, etc. (see `second-brain-os capture --help`).

### Organize

| Command | Purpose |
|---------|---------|
| `sb organize analyze` | Heuristic suggestions for inbox items (`--limit` optional). |
| `sb organize promote --from <ref> --to <kind>` | Promote inbox → typed entity (`--area` / `--project` as needed). |
| `sb organize rename --path <rel.md> ...` | Rename / retitle with index sync. |
| `sb organize link --path <rel.md> ...` | Attach areas/projects. |
| `sb organize reclassify --path <rel.md> --to <kind>` | Change kind among note / resource / task. |

### Day / dashboard / queries

| Command | Purpose |
|---------|---------|
| `sb today` | Daily action surface (`--days` optional). |
| `sb dashboard show` | Home-style aggregated view (`--days` optional). |
| `sb list [entity]` | List `tasks`, `areas`, `goals`, `projects`, `notes`, `resources`, `inbox` (filters: `--status`, `--due`, `--limit`, …). |
| `sb show <slug\|id>` | One entity with context. |
| `sb search [query...]` | Search titles/content/metadata (`--limit`, `--expand`). |

### Review & archive

| Command | Purpose |
|---------|---------|
| `sb review weekly` | Weekly review flow and artifacts. |
| `sb archive <kind> <slug>` | Archive an entity. |
| `sb archive <kind> <slug> --restore` | Restore from archive. |

### Health

| Command | Purpose |
|---------|---------|
| `sb doctor` | Validate config, indexing, and surface findings. |
| `sb doctor --repair` | Reindex from disk and prune orphan index rows (use `--dry-run` to preview where supported). |

---

## 10. CLI examples

The following use the global command **`second-brain-os`** (after `npm install -g second-brain-os`). From a development clone, use **`npx second-brain-os`** instead, run from the repo root after `npm run build`.

**Initialize and capture (human-friendly)**

```bash
second-brain-os init
cd ~/SecondBrain
second-brain-os capture "idea: refactor the CLI help text"
```

**Non-interactive init + JSON capture**

```bash
second-brain-os init --non-interactive --workspace ./my-vault
second-brain-os --workspace ./my-vault --format json capture "remember dentist"
```

**Doctor in JSON**

```bash
second-brain-os --workspace ~/SecondBrain --format json doctor
```

**Repair (preview then apply)**

```bash
second-brain-os --workspace ~/SecondBrain doctor --repair --dry-run --format json
second-brain-os --workspace ~/SecondBrain doctor --repair --format json
```

**List tasks**

```bash
second-brain-os --workspace ~/SecondBrain list tasks --format json
```

**Weekly review**

```bash
second-brain-os --workspace ~/SecondBrain review weekly --format markdown
```

**Config**

```bash
second-brain-os config show --format json
second-brain-os config set output_style json --workspace ~/SecondBrain
```

---

## 11. Using the Cursor skill (`second-brain-os`)

The repo includes a **Cursor Agent Skill** at **`.cursor/skills/second-brain-os/`** (name: **`second-brain-os`**).

### What the skill is for

- Tells the AI to **run the real `second-brain-os` CLI** (build first: `npm run build`) instead of inventing Markdown files or editing SQLite by hand.
- Steers toward **`--format json`** when the agent needs structured success/failure.
- Points to **`references/cli-contract.md`** and **`references/recovery.md`** inside the skill for flags and recovery order.

### How to use it in Cursor

1. Ensure the skill is available to the workspace (the skill lives under **`.cursor/skills/second-brain-os/`** in this project).
2. When you work on Second Brain / vault / PARA / `doctor` / capture flows, the skill description helps the agent **choose** this behavior.
3. You can explicitly ask: *“Follow the second-brain-os skill and use the CLI with JSON output.”*

### What you should expect from the agent

- Shell commands such as **`second-brain-os ...`** (if installed globally), **`npx second-brain-os ...`** (from a clone or via `npx`), or **`node dist/cli/index.js ...`** after `npm run build` in the repo.
- Parsing of the **JSON envelope** (`ok`, `errors`, `warnings`, `next_actions`).
- Use of **`--workspace`**, **`--non-interactive`**, **`--quiet`**, **`--dry-run`** when automating.

### Skill evaluation (optional)

The skill includes **`evals/evals.json`** for **skill-creator**-style benchmarks (with-skill vs without-skill). See **`.cursor/skills/skill-creator/SKILL.md`** if you want to run formal eval loops.

---

## 12. Troubleshooting

| Symptom | What to do |
|---------|------------|
| “No workspace found” | Run **`init`**, or set **`SECOND_BRAIN_WORKSPACE`**, or pass **`--workspace`**. |
| `npx second-brain-os` fails inside a vault folder | The vault is not an npm package. Use the globally installed CLI, or `npx` from the cloned repo with **`--workspace`**, or `node /path/to/second-brain-os/dist/cli/index.js`. |
| **`npm install -g`** / **`better-sqlite3` build errors** | Install a C++ build toolchain for your OS (see [better-sqlite3 troubleshooting](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/troubleshooting.md)). |
| Validation / wrong slug | Use **`list`** / **`show`** with **`--format json`** to get real IDs and slugs. |
| Index drift or odd doctor findings | **`doctor --format json`**, then **`doctor --repair --dry-run`**, then **`doctor --repair`** if appropriate. |
| Config mistakes | **`config set`** with **`--dry-run`** first when available. |

Detailed recovery order is in **`.cursor/skills/second-brain-os/references/recovery.md`** (same ideas as above, CLI-only).

---

## 13. Running tests (developers)

```bash
npm test
```

---

## 14. Further reading

- **npm package**: [second-brain-os](https://www.npmjs.com/package/second-brain-os) — install and version history.  
- **Developer guide**: [DEV_GUIDE.md](DEV_GUIDE.md) — toolchain, layout, testing, migrations, publishing.  
- **Second Brain OS Dev (Cursor skill):** `.cursor/skills/second-brain-os-dev/` — maintainer workflow (`dev:run`, scripts, pre-publish).  
- **Task roadmap / epics**: `Tasks markdowns/` in this repo.  
- **Stable CLI table**: `.cursor/skills/second-brain-os/references/cli-contract.md`.  
- **Envelope implementation**: `src/shared/envelope.ts`.  
- **Command registration**: `src/cli/program.ts`.

---

*This guide matches the CLI as implemented in the repository and published to npm. If a flag or subcommand differs, `second-brain-os <command> --help` is authoritative.*

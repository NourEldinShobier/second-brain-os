---
name: second-brain-os
description: >
  Drive Second Brain OS — the local-first CLI (Markdown vault + SQLite index) for capture, organize, inbox,
  weekly review, archive/restore, doctor, dashboard, search, and config. Use this skill whenever the
  user works with a Second Brain OS vault, PARA-style folders, inbox processing, knowledge capture,
  `second-brain-os` or `second-brain` commands, `.second-brain/config.yml`, workspace health, or agent-friendly JSON CLI
  output—even if they do not say "second brain" by name. Prefer routing work through real CLI
  invocations rather than inventing vault files or SQL by hand.
---

# Second Brain OS (CLI-first)

The product is the **`second-brain-os`** Node CLI in this repo (short global alias **`second-brain`** when installed from npm). The skill’s job is to **orchestrate that CLI** and interpret its outputs—not to reimplement indexing, capture, or schema rules in prose.

## Principles

1. **Shell out to the CLI** for mutations and most reads. Use `run_terminal_cmd` (or the user’s shell) with the repo built (`npm run build`) so `second-brain-os` resolves to `dist/cli/index.js` via `npx second-brain-os` from the package root, or `node dist/cli/index.js` after build.
2. **Agent mode**: pass `--format json` or `--json` whenever you need structured success/error envelopes (`ok`, `schema_version`, `errors`, `warnings`, `next_actions`, `data`).
3. **Automation**: add `-n` / `--non-interactive`, `-q` / `--quiet`, and `--dry-run` when the user is scripting or you must avoid prompts.
4. **Workspace**: pass `--workspace <path>` when the vault root is not discovered from cwd. Respect `SECOND_BRAIN_WORKSPACE` if the user sets it.
5. **Recovery**: if commands fail with missing workspace, config, or index drift, follow the **`doctor`** and **`config`** paths in `references/recovery.md`—still via CLI.

## Quick command map

| Intent | Example |
|--------|---------|
| Health / drift | `second-brain-os doctor --format json` |
| Repair index | `second-brain-os doctor --repair --format json` (omit `--repair` with `--dry-run` to preview) |
| Inbox capture | `second-brain-os capture "text"` or `second-brain-os capture --type task "Title"` |
| Organize | `second-brain-os organize analyze`, `organize promote --from ... --to ...` |
| Query | `second-brain-os list tasks`, `show <slug|id>`, `search query` |
| Review | `second-brain-os review weekly` |
| Vault drive | `second-brain-os drive import <path>`, `drive list --area <ref>`, `drive show <ref>`, `drive link <ref>`, `drive update <ref>`, `drive archive <slug>`, `drive restore <slug>` |
| **Drive Organization** | `second-brain-os drive import <path> --primary area:health`, `drive set-primary <ref> --area <slug>`, `drive move <ref> --slug <new>`, `drive structure`, `drive migrate --strategy inbox` |
| **Entity Resolution** | `second-brain-os resolve parent --task <ref>`, `resolve entity area <slug>`, `exists area <slug>` |
| Config | `second-brain-os config show`, `config set ...` |

Full tables and flags: see `references/cli-contract.md`.

## What not to do

- Do not write Markdown entities or SQLite rows **by hand** when the CLI can create/update them—unless the user explicitly wants a one-off edit.
- Do not guess stable IDs or front matter; use `list` / `show` / JSON output.
- Do not bypass the JSON envelope: parse `errors` and `warnings` before declaring success.

## Progressive disclosure

- Read **`references/cli-contract.md`** when choosing flags or subcommands.
- Read **`references/recovery.md`** when fixing workspace/config/index issues.
- For **maintaining this repository** (scripts, `dev:run`, tests, releases), use the **`second-brain-os-dev`** skill (`.cursor/skills/second-brain-os-dev/`).

## Evaluation

This skill ships with **`evals/evals.json`** for skill-creator runs (with-skill vs without-skill). Use the `skill-creator` workflow from `.cursor/skills/skill-creator/SKILL.md` to iterate.

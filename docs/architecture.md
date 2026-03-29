# 🏗️ Architecture

> **Reading order:** This is document **1 of 4** — read this first.
> Next → [vault-structure.md](./vault-structure.md)

This document explains how Second Brain OS is built: what layers exist, how data flows between them, and why the system is designed the way it is.

---

## Table of Contents

1. [What Is Second Brain OS?](#what-is-second-brain-os)
2. [Core Design Principles](#core-design-principles)
3. [System Layers](#system-layers)
4. [Data Flow](#data-flow)
5. [Workspace Discovery](#workspace-discovery)
6. [JSON Output Envelope](#json-output-envelope)
7. [Layer Dependency Map](#layer-dependency-map)
8. [Source Code Layout](#source-code-layout)

---

## What Is Second Brain OS?

Second Brain OS is a **local-first** CLI for running a personal knowledge management (PKM) system entirely on your machine.

```
  ┌──────────────────────────────────────────────────────────┐
  │                      SECOND BRAIN OS                     │
  │                                                          │
  │  Markdown files   ──▶  source of truth, human readable   │
  │  SQLite index     ──▶  fast queries, rebuildable          │
  │  CLI surface      ──▶  capture, organize, search, review  │
  │  No cloud needed  ──▶  works offline, Git-syncable         │
  └──────────────────────────────────────────────────────────┘
```

The core contract: **you own your files**. The database is a derivative that can always be rebuilt from disk using `doctor --repair`.

---

## Core Design Principles

| Principle | What it means in practice |
|-----------|--------------------------|
| **Files are truth** | `.md` files with YAML frontmatter are always authoritative. The DB can be wiped and rebuilt. |
| **Local-first** | No required cloud service. Runs fully offline. Optional OpenAI integration. |
| **Stable IDs** | Every entity has a UUID in both the frontmatter and the DB. IDs never change even when files are renamed or moved. |
| **Consistent CLI surface** | All commands share global flags (`--format`, `--workspace`, `--dry-run`, etc.) and a stable JSON envelope. |
| **Agent-friendly** | `--format json` on every command gives AI agents a structured, machine-parseable interface. |

---

## System Layers

The codebase is organized as four clean layers, each with a strict dependency direction (no circular imports):

```
  ┌──────────────────────────────────────────────────────────────┐
  │                      CLI LAYER                               │
  │   src/cli/                                                   │
  │   • Commander.js program & subcommands                       │
  │   • Parses flags, resolves workspace, renders output         │
  │   • Uses Application layer; never touches DB or files direct │
  └───────────────────────┬──────────────────────────────────────┘
                          │ calls
  ┌───────────────────────▼──────────────────────────────────────┐
  │                 APPLICATION LAYER                            │
  │   src/application/                                           │
  │   • Use cases: CaptureService, DoctorService, etc.           │
  │   • Pure business logic; no HTTP, no SQL                     │
  │   • Depends only on Domain interfaces                        │
  └───────────────────────┬──────────────────────────────────────┘
                          │ implements interfaces from
  ┌───────────────────────▼──────────────────────────────────────┐
  │                   DOMAIN LAYER                               │
  │   src/domain/                                                │
  │   • TypeScript interfaces and types only                     │
  │   • Entities (Area, Goal, Task…), statuses, IDs, slugs       │
  │   • Zero runtime dependencies                                │
  └───────────────────────┬──────────────────────────────────────┘
                          │ implemented by
  ┌───────────────────────▼──────────────────────────────────────┐
  │               INFRASTRUCTURE LAYER                           │
  │   src/infrastructure/                                        │
  │   • Markdown repository (gray-matter, file I/O)              │
  │   • SQLite + Drizzle ORM (schema, queries, migrations)       │
  │   • Config reader/writer (.second-brain/config.yml)          │
  │   • AI provider adapter (OpenAI)                             │
  │   • Workspace resolver                                       │
  └──────────────────────────────────────────────────────────────┘
```

### Layer Rules

- **CLI** only calls Application services — never touches the DB or filesystem directly.
- **Application** only calls Domain interfaces — never imports infrastructure concretely.
- **Infrastructure** implements Domain interfaces and is wired together at startup.
- **Domain** has zero external dependencies — it is pure TypeScript types.

---

## Data Flow

### Capture flow (example: `second-brain-os capture "my idea"`)

```
  User types command
        │
        ▼
  CLI parses flags + args       (src/cli/program.ts)
        │
        ▼
  Workspace resolved            ( .second-brain/config.yml )
        │
        ▼
  CaptureService.captureRaw()   (src/application/capture-service.ts)
        │
        ├──▶ Generates slug + UUID
        │
        ├──▶ MarkdownRepository.writeFile()   ← creates 00-inbox/<slug>/index.md
        │         Writes YAML frontmatter with id, slug, title, status, etc.
        │
        └──▶ SQLite index upsert              ← inserts row into inbox_items
                  id, slug, title, file_path, status, created_at...
        │
        ▼
  CLI formats result            (pretty / markdown / json)
        │
        ▼
  stdout
```

### Organize promote flow (example: `organize promote --from <slug> --to task`)

```
  Inbox item slug resolved via DB
        │
        ▼
  Read index.md frontmatter
        │
        ▼
  Validate + transform to new kind
        │
        ├──▶ Write new file:  04-tasks/<slug>/index.md
        ├──▶ Update frontmatter: kind = "task", status = "inbox"
        └──▶ Delete old:      00-inbox/<slug>/  (or move to archive)
        │
        ▼
  Update SQLite:
        ├──▶ DELETE from inbox_items WHERE id = ...
        └──▶ INSERT into tasks ...
```

### Doctor + Repair flow

```
  doctor scans:
    ├── Walk all *.md files in vault folders
    ├── Parse each frontmatter → extract id, kind, slug
    ├── Compare against DB rows
    │
    ├── Reports:  missing from DB │ stale path │ orphaned DB row
    │
    └── --repair:
          ├── Reindex missing files → INSERT
          ├── Update stale paths   → UPDATE file_path
          └── Prune orphans        → DELETE rows with no file
```

---

## Workspace Discovery

When you run any command, the CLI resolves the vault root in this priority order:

```
  Priority 1:  --workspace <path> flag
       │
       ▼ (if not set)
  Priority 2:  SECOND_BRAIN_WORKSPACE env var
       │
       ▼ (if not set)
  Priority 3:  Walk upward from CWD
               looking for .second-brain/config.yml
       │
       ▼ (if not found)
  ERROR: "No workspace found" — run init or set --workspace
```

**Example (PowerShell):**

```powershell
# Set once for the session
$env:SECOND_BRAIN_WORKSPACE = "D:\MyVault"

# Now all commands use D:\MyVault automatically
second-brain-os list tasks
second-brain-os today
```

---

## JSON Output Envelope

Every command supports `--format json` (or `--json`). The output always has this stable shape, regardless of success or failure:

```json
{
  "ok": true,
  "schema_version": "1.0.0",
  "data": { "...": "command-specific payload" },
  "warnings": [],
  "errors": [],
  "next_actions": ["suggested follow-up commands"]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `ok` | boolean | `true` = success, `false` = failure |
| `schema_version` | string | Envelope version for forward compat |
| `data` | object\|null | Command-specific result payload |
| `warnings` | string[] | Non-fatal issues |
| `errors` | object[] | `{ code, message, details? }` on failure |
| `next_actions` | string[] | Suggested CLI commands to run next |

**Always check `ok` and `errors` before consuming `data`.**

---

## Layer Dependency Map

```
  src/
  ├── cli/              ──depends on──▶  application/
  │   ├── program.ts                     (never domain/ or infra/ directly)
  │   ├── commands/
  │   └── presentation/
  │
  ├── application/      ──depends on──▶  domain/
  │   ├── capture-service.ts             (interfaces only, not infra)
  │   ├── doctor-service.ts
  │   ├── entity-crud-service.ts
  │   ├── organize-service.ts
  │   └── ...
  │
  ├── domain/           ──depends on──▶  (nothing external)
  │   ├── core-entities.ts
  │   ├── entity-kind.ts
  │   ├── statuses.ts
  │   ├── repositories.ts
  │   ├── services.ts
  │   └── markdown/
  │
  └── infrastructure/   ──implements──▶  domain/ interfaces
      ├── db/           (Drizzle + SQLite)
      ├── markdown/     (gray-matter file I/O)
      ├── config/       (YAML config.yml)
      ├── ai/           (OpenAI adapter)
      └── workspace/    (path resolution)
```

---

## Source Code Layout

```
second-brain-os/
│
├── src/
│   ├── cli/                   # Commander program, command handlers
│   ├── application/           # Business logic use cases
│   ├── domain/                # Pure TypeScript types & interfaces
│   ├── infrastructure/        # DB, Markdown I/O, Config, AI
│   ├── shared/                # Utilities (envelope, version, etc.)
│   └── test-support/          # Test helpers and fixtures
│
├── drizzle/                   # SQL migration files (auto-applied)
│   ├── 0000_init.sql
│   ├── 0001_core_and_supporting_tables.sql
│   ├── 0002_complex_doctor_doom.sql   (entity_assets)
│   └── 0003_thick_leopardon.sql      (drive_items)
│
├── docs/                      # ← You are here
│   ├── index.md               # Reading order guide
│   ├── architecture.md        # This file
│   ├── vault-structure.md     # Vault layout & frontmatter
│   ├── cli-reference.md       # Every command & flag
│   ├── schema.md              # SQLite schema deep-dive
│   ├── USER_GUIDE.md          # Install, JSON envelope, agents
│   └── DEV_GUIDE.md           # Contributor guide
│
├── scripts/                   # Dev utilities
├── dist/                      # Compiled output (after npm run build)
└── package.json
```

---

> **Next:** [vault-structure.md](./vault-structure.md) — Learn how files and folders are organized inside a vault.

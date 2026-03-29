# 📂 Vault Structure

> **Reading order:** This is document **2 of 4**.
> Previous → [architecture.md](./architecture.md) | Next → [cli-reference.md](./cli-reference.md)

This document explains how a Second Brain OS vault is laid out on disk: the folder structure, how each entity is stored as a "package" directory, and what the YAML frontmatter inside each `.md` file looks like.

---

## Table of Contents

1. [Top-Level Folder Layout](#top-level-folder-layout)
2. [Entity Package Structure](#entity-package-structure)
3. [YAML Frontmatter Schema](#yaml-frontmatter-schema)
4. [Frontmatter Field Reference](#frontmatter-field-reference)
5. [Folder → Entity Kind Mapping](#folder--entity-kind-mapping)
6. [Drive Items Structure](#drive-items-structure)
7. [Archive Layout](#archive-layout)
8. [Config File](#config-file)

---

## Top-Level Folder Layout

When you run `second-brain-os init`, a vault is created with this directory tree:

```
MyVault/
│
├── .second-brain/              ← CLI config and database
│   ├── config.yml              ← workspace configuration
│   └── brain.db                ← SQLite index (rebuildable)
│
├── 00-inbox/                   ← Raw unprocessed captures
│   └── <slug>/
│       └── index.md
│
├── 01-areas/                   ← Long-running life/work spheres
│   └── <slug>/
│       └── index.md
│
├── 02-goals/                   ← Time-boxed outcomes
│   └── <slug>/
│       └── index.md
│
├── 03-projects/                ← Bounded work with end states
│   └── <slug>/
│       └── index.md
│
├── 04-tasks/                   ← Actionable work items
│   └── <slug>/
│       └── index.md
│
├── 05-resources/               ← Reference material, links, books
│   └── <slug>/
│       └── index.md
│
├── 06-notes/                   ← Free-form knowledge and ideas
│   └── <slug>/
│       └── index.md
│
├── 07-drive/                   ← Imported external files and folders
│   └── items/
│       └── <slug>/
│           ├── item.md         ← Drive item manifest
│           └── <original-file> ← The imported content
│
├── 08-reviews/                 ← Generated review artifacts
│   └── weekly-2026-01-13.md
│
└── 99-archive/                 ← Archived entities (by kind)
    ├── inbox/
    ├── areas/
    ├── goals/
    ├── projects/
    ├── tasks/
    ├── resources/
    ├── notes/
    └── drive/
```

---

## Entity Package Structure

Each entity lives in its own **package directory** — a folder named after its slug, containing `index.md` as the canonical document:

```
04-tasks/
└── write-q1-report/            ← slug = "write-q1-report"
    ├── index.md                ← canonical entity document
    └── assets/                 ← optional: attached files
        ├── draft.pdf
        └── notes.png
```

### Why a package directory (not a single file)?

- Allows **assets** (binary files, attachments) to live alongside the entity without polluting the parent folder.
- Keeps the **slug** stable as the directory name — even if the title changes, `rename` updates the frontmatter but the path is configurable.
- Clean for **Git**: each entity is a self-contained folder that diffs and merges cleanly.

---

## YAML Frontmatter Schema

Every `index.md` file stores its metadata inside a YAML frontmatter block under the root key `second_brain`. This is the **source of truth** for the SQLite index.

```yaml
---
second_brain:
  id: "550e8400-e29b-41d4-a716-446655440000"   # UUID — stable forever
  kind: "task"
  version: 1
  slug: "write-q1-report"
  title: "Write Q1 Report"
  status: "next"
  archived: false

  # Scheduling (tasks only)
  due_date: "2026-03-31"
  energy: "high"
  priority: 1

  # Relationships (outgoing edges — UUIDs)
  area_ids:
    - "aaa00000-0000-0000-0000-000000000001"
  project_ids:
    - "bbb00000-0000-0000-0000-000000000002"

  # Assets manifest (populated by `asset add`)
  assets:
    - id: "ccc00000-0000-0000-0000-000000000003"
      path: "assets/draft.pdf"
      original_filename: "Q1-draft.pdf"
      mime_type: "application/pdf"
      imported_at: "2026-01-10T09:00:00.000Z"
      title: "Q1 Draft"
---

# Write Q1 Report

Body content goes here as regular Markdown...
```

---

## Frontmatter Field Reference

### Core Fields (all entity kinds)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | UUID string | ✅ | Stable primary key — never changes |
| `kind` | enum | ✅ | `inbox_item` \| `area` \| `goal` \| `project` \| `task` \| `resource` \| `note` \| `archive_record` |
| `version` | `1` | ✅ | Schema version (currently always `1`) |
| `slug` | kebab-case string | ✅ | URL-safe identifier, max 120 chars, pattern `^[a-z0-9]+(-[a-z0-9]+)*$` |
| `title` | string | ✅ | Human-readable title |
| `status` | string | ✅ | Kind-specific status (see Status Vocabularies) |
| `archived` | boolean | ✅ | `false` = active, `true` = archived |

### Inbox-Specific Fields

| Field | Type | Description |
|-------|------|-------------|
| `captured_at` | ISO-8601 string | When the item was captured |
| `suggested_entity_type` | string | AI/heuristic suggestion for promotion |
| `processed_at` | ISO-8601 string \| null | When it was promoted |

### Goal-Specific Fields

| Field | Type | Description |
|-------|------|-------------|
| `target_date` | ISO date string \| null | Goal deadline |
| `quarter` | string \| null | e.g. `"Q1"`, `"Q3"` |
| `year` | integer \| null | Calendar year |
| `key_results` | KeyResult[] | OKR key results (see below) |

**Key Result schema:**

```yaml
key_results:
  - id: "uuid"
    title: "Ship MVP to 100 users"
    done: false
    order: 0
  - id: "uuid"
    title: "Achieve 4.5 avg rating"
    done: false
    order: 1
```

### Project-Specific Fields

_(none beyond core — priority, dates are indexed from DB only)_

### Task-Specific Fields

| Field | Type | Description |
|-------|------|-------------|
| `due_date` | ISO date \| null | When the task should be done |
| `priority` | integer \| null | Numeric priority |
| `energy` | string \| null | `low` \| `medium` \| `high` |

### Resource-Specific Fields

| Field | Type | Description |
|-------|------|-------------|
| `source_url` | string \| null | Original URL or reference |
| `pinned` | boolean | Pin to top of list |

### Note-Specific Fields

| Field | Type | Description |
|-------|------|-------------|
| `notebook` | string \| null | Logical group name |
| `pinned` | boolean | Pin to top |
| `favorite` | boolean | Mark as favorite |

### Relationship Fields (all non-inbox kinds)

These are **outgoing edges** — the IDs of related entities. They are mirrored into the `entity_links` table.

| Field | Type | Which kinds |
|-------|------|-------------|
| `area_ids` | UUID[] | goal, project, task, resource, note |
| `goal_ids` | UUID[] | project, task, resource, note |
| `project_ids` | UUID[] | task, resource, note |
| `task_ids` | UUID[] | resource, note |
| `resource_ids` | UUID[] | task |
| `note_ids` | UUID[] | task |

### Archive Bookkeeping Fields

| Field | Type | Description |
|-------|------|-------------|
| `archived_at` | ISO-8601 \| null | When archived |
| `archive_reason` | string \| null | Why archived |

### Assets Field

```yaml
assets:
  - id: "uuid"
    path: "assets/filename.ext"      # relative to package root
    original_filename: "name.ext"
    mime_type: "image/png"
    imported_at: "2026-01-10T09:00:00.000Z"
    title: "Optional display title"  # optional
    description: "Optional note"     # optional
    sha256: "abc123..."             # optional, for dedup
```

---

## Folder → Entity Kind Mapping

```
┌──────────────┬────────────────┬─────────────────────────────────────┐
│ Folder       │ Entity Kind    │ Archive Destination                  │
├──────────────┼────────────────┼─────────────────────────────────────┤
│ 00-inbox/    │ inbox_item     │ 99-archive/inbox/                    │
│ 01-areas/    │ area           │ 99-archive/areas/                    │
│ 02-goals/    │ goal           │ 99-archive/goals/                    │
│ 03-projects/ │ project        │ 99-archive/projects/                 │
│ 04-tasks/    │ task           │ 99-archive/tasks/                    │
│ 05-resources/│ resource       │ 99-archive/resources/                │
│ 06-notes/    │ note           │ 99-archive/notes/                    │
│ 07-drive/    │ (drive_item)   │ 99-archive/drive/                    │
│ 99-archive/  │ archive_record │ (is the archive destination)         │
└──────────────┴────────────────┴─────────────────────────────────────┘
```

---

## Drive Items Structure

Drive items have a slightly different package structure — they use `item.md` instead of `index.md`, and store the actual imported content alongside it:

```
07-drive/
└── items/
    └── my-project-brief/           ← slug
        ├── item.md                 ← manifest (frontmatter under "drive_item" key)
        └── Project-Brief-2026.pdf  ← the imported file

    └── design-assets/              ← folder import (item_type: "folder")
        ├── item.md
        ├── logo.svg
        ├── banner.png
        └── icons/
```

### Drive item `item.md` frontmatter schema

```yaml
---
drive_item:
  id: "uuid"
  version: 1
  slug: "my-project-brief"
  title: "My Project Brief"
  description: "Q1 planning document"
  item_type: "file"              # "file" | "folder"
  original_name: "Project-Brief-2026.pdf"
  source_path: "/Users/me/Downloads/Project-Brief-2026.pdf"  # optional
  imported_at: "2026-01-15T10:00:00.000Z"
  mime_type: "application/pdf"  # optional
  sha256: "abc123..."           # optional
  child_count: null             # for folders: number of files
  archived: false
  archived_at: null
  archive_reason: null

  # Linked entities (UUIDs)
  area_ids: []
  project_ids: ["bbb00000-0000-0000-0000-000000000002"]
  task_ids: []
  note_ids: []
  goal_ids: []
  tags: ["planning", "q1"]
---

Body / notes about this drive item...
```

---

## Archive Layout

When you run `archive <kind> <slug>`, the entity's entire package directory is **moved** (not copied) into the corresponding archive subfolder:

```
Before archive:
  04-tasks/write-report/index.md

After archive:
  99-archive/tasks/write-report/index.md
```

The frontmatter `archived: true` is also updated, and an `archive_events` row is written to the DB recording the path change. This means `doctor --repair` can always re-sync if the files are manually moved.

---

## Config File

Located at `<vault>/.second-brain/config.yml`:

```yaml
schema_version: "1.0.0"
database_path: ".second-brain/brain.db"   # relative to vault root (or absolute)
output_style: "pretty"                    # "pretty" | "markdown" | "json"
ai_provider: null                         # null | "openai"
```

| Field | Description |
|-------|-------------|
| `schema_version` | Config schema version |
| `database_path` | Path to SQLite file — relative to vault root, or absolute |
| `output_style` | Default output format (`--format` overrides per-command) |
| `ai_provider` | `null` = deterministic only; `"openai"` = enables AI features |

Edit with `config set <key> <value>` or open the YAML directly.

---

> **Next:** [cli-reference.md](./cli-reference.md) — Complete reference for every command and flag.

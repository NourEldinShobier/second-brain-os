# 📖 Second Brain OS — Documentation Index

> **Start here.** This file tells you what each document covers and the recommended order to read them depending on your goal.

---

## Recommended Reading Order

```
┌─────────────────────────────────────────────────────────────────────┐
│                    READING ORDER MAP                                │
│                                                                     │
│  New user / first time?                                             │
│  ─────────────────────                                              │
│  1. architecture.md   ← Understand how the system is built          │
│  2. vault-structure.md ← Understand how files are organized on disk │
│  3. cli-reference.md  ← Learn every command and flag                │
│  4. schema.md         ← Deep-dive the SQLite database               │
│                                                                     │
│  Just need a command lookup?                                        │
│  ──────────────────────────                                         │
│  → cli-reference.md                                                 │
│                                                                     │
│  Debugging drift / doctor issues?                                   │
│  ─────────────────────────────────                                  │
│  → schema.md (understand tables) then cli-reference.md §doctor      │
│                                                                     │
│  Contributing / extending the schema?                               │
│  ─────────────────────────────────────                              │
│  → architecture.md → schema.md → DEV_GUIDE.md                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Document Map

| # | File | What it covers | Read when… |
|---|------|----------------|------------|
| 1 | [architecture.md](./architecture.md) | System layers, data flow, design decisions | You're new or want the big picture |
| 2 | [vault-structure.md](./vault-structure.md) | Folder layout, frontmatter schema, file packages | You need to understand how Markdown files are structured |
| 3 | [cli-reference.md](./cli-reference.md) | Every command, flag, and example | You need to use or script the CLI |
| 4 | [schema.md](./schema.md) | Every SQLite table, column, index, and relationship | You're debugging the index or extending the schema |
| — | [USER_GUIDE.md](./USER_GUIDE.md) | Installation, JSON envelope, agent skills | You're setting up or integrating with an AI agent |
| — | [DEV_GUIDE.md](./DEV_GUIDE.md) | Contributor setup, Drizzle migrations, publishing | You're contributing to the codebase |

---

## Quick Orientation

```
second-brain-os
│
│   You write Markdown (.md files) ← source of truth
│   The CLI reads/writes them      ← commands in cli-reference.md
│   SQLite indexes the metadata    ← schema in schema.md
│   Files live in a vault folder   ← layout in vault-structure.md
│   All layers are described in    ← architecture.md
│
└── .second-brain/
        config.yml   ← database path, output style, AI provider
        brain.db     ← SQLite index (derivative, rebuildable)
```

**Golden rule:** The `.md` files are always the source of truth. The SQLite database is a speed layer — always rebuildable with `doctor --repair`.

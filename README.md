# Second Brain OS

[![npm](https://img.shields.io/npm/v/second-brain-os.svg)](https://www.npmjs.com/package/second-brain-os)

**Second Brain OS** is a **local-first** command-line tool for running a personal knowledge system (“second brain” / PKM) entirely on your machine:

- **Markdown files** are the source of truth: inbox, areas, goals, projects, tasks, resources, notes, reviews, and archives live as normal `.md` files you can open in any editor or sync with Git.
- **SQLite** stores an **index** of metadata so listing, search, dashboards, and health checks stay fast and consistent with what is on disk.
- The **`second-brain-os`** CLI (short alias **`second-brain`**) provides **capture**, **organize**, **list**, **show**, **search**, **today**, **dashboard**, **weekly review**, **archive / restore**, **doctor** (validation + repair), and **config**—with **human-friendly** output and a stable **`--format json`** mode for scripts and AI agents.

There is **no** required cloud service. Optional **OpenAI** can be enabled later for richer flows; without it, the CLI uses deterministic behavior and heuristics.

On disk, each vault still uses a **`.second-brain/`** folder for config and the local database path (that directory name is unchanged).

---

## What this project is for

| Goal | How Second Brain OS helps |
|------|-----------------------------|
| **Capture quickly** | Raw inbox capture or typed entities (`capture`) with optional areas/projects. |
| **Organize** | Heuristic inbox analysis, promote to typed entities, link, rename, reclassify (`organize`). |
| **See your day** | `today` and `dashboard show` aggregate tasks and context from local state. |
| **Find things** | `list`, `show`, `search` over indexed metadata and content. |
| **Stay healthy** | `doctor` reports drift; `doctor --repair` re-syncs index with disk when needed. |
| **Agents & automation** | JSON envelope (`ok`, `errors`, `warnings`, `next_actions`, `data`) on every command. |

**Workspace model:** Each “vault” is a folder containing `.second-brain/config.yml` and your Markdown tree. The CLI discovers it by walking up from the current directory, or via `--workspace` / `SECOND_BRAIN_WORKSPACE`.

---

## Install (from npm)

The package is published as **`second-brain-os`** on the [npm registry](https://www.npmjs.com/package/second-brain-os). The unrelated package **`second-brain`** is a different project—install **`second-brain-os`** for this CLI.

Install globally:

```bash
npm install -g second-brain-os
second-brain-os --help
# optional short alias (also installed):
second-brain --help
```

Or run a one-off without a global install:

```bash
npx second-brain-os doctor --format json --workspace ~/SecondBrain
```

**Requirements:** **Node.js 20+**. The dependency **better-sqlite3** includes native code; on some systems you need a [build toolchain](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/troubleshooting.md) for `npm install` to compile (common on Windows without Visual Studio Build Tools).

**Documentation:** This file is the project overview. For a full user and integration guide (architecture, JSON envelope, commands, optional agent skills, troubleshooting), see **[docs/USER_GUIDE.md](docs/USER_GUIDE.md)** (also included in the published npm package under `docs/`). For contributors—setup, scripts, testing, database workflow, and releases—see **[docs/DEV_GUIDE.md](docs/DEV_GUIDE.md)**.

---

## Quick start

```bash
second-brain-os init
cd ~/SecondBrain
second-brain-os capture "remember to book dentist"
second-brain-os doctor --format json
```

If your vault lives elsewhere, use **`--workspace <path>`** on each command or set **`SECOND_BRAIN_WORKSPACE`** for the shell session (see **Global options** / **Environment** in [docs/USER_GUIDE.md](docs/USER_GUIDE.md)) so you do not have to repeat the path.

Non-interactive init (CI / scripts):

```bash
second-brain-os init --non-interactive --workspace ./my-vault
```

Point commands at a vault that is **not** your current directory:

```bash
second-brain-os doctor --format json --workspace D:\second-brain
second-brain-os capture --workspace D:\second-brain "quick note"
```

Or set for the session:

```bash
# PowerShell
$env:SECOND_BRAIN_WORKSPACE = "D:\second-brain"
second-brain-os doctor --format json
```

---

## Install from source (development)

```bash
git clone https://github.com/NourEldinShobier/second-brain-os.git
cd second-brain-os
npm install
npm run build
npx second-brain-os --help
```

**Note:** `npx second-brain-os` from a clone resolves this **package** on disk. If you `cd` into a **vault folder** that is not an npm package, `npx` may fail with *could not determine executable to run*. Use `npx` from the cloned repo, pass `--workspace` to your vault, use `npm link` after `npm run build`, or install **`second-brain-os`** from npm and use the global `second-brain-os` / `second-brain` commands.

---

## Global CLI flags

| Flag | Purpose |
|------|---------|
| `--format pretty\|markdown\|json` | Output style (`--json` = JSON). |
| `-n, --non-interactive` | No prompts. |
| `-q, --quiet` | Minimal output. |
| `--dry-run` | Preview where supported. |
| `--workspace <path>` | Vault root. |

---

## Commands (overview)

| Area | Commands |
|------|----------|
| Setup | `init`, `config show`, `config set` |
| Capture | `capture` (inbox or `--type` area \| goal \| project \| task \| resource \| note) |
| Organize | `organize analyze`, `promote`, `link`, `rename`, `reclassify` |
| Surfaces | `today`, `dashboard show` |
| Query | `list`, `show`, `search` |
| Maintenance | `review weekly`, `archive`, `doctor` |

Full detail: **[docs/USER_GUIDE.md](docs/USER_GUIDE.md)** (architecture, JSON envelope, examples, troubleshooting).

---

## JSON output (for scripts & agents)

With `--format json` or `--json`, success and failure responses share a stable shape: `ok`, `schema_version`, `data`, `warnings`, `errors`, `next_actions`. Parse `ok` and `errors` before treating a run as successful.

---

## Agent skills (optional)

You can give **AI coding assistants** (Cursor, Claude Code, Copilot, or similar) **instruction packs** (“skills”) so they call the real `second-brain-os` CLI and use JSON output instead of hand-editing files or SQLite. Layout depends on the tool (e.g. `.cursor/skills/` in Cursor, or each vendor’s documented folder). See **[docs/USER_GUIDE.md §11](docs/USER_GUIDE.md#11-agent-skills-optional-second-brain-os)**.

---

## Repository layout (high level)

| Path | Role |
|------|------|
| `src/cli/` | Commander program, commands |
| `src/application/` | Use cases (capture, doctor, etc.) |
| `src/infrastructure/` | Markdown repo, SQLite/Drizzle, config |
| `src/domain/` | Types, validation |
| `drizzle/` | SQL migrations shipped with the CLI |
| `dist/` | Compiled output (produced by `npm run build`) |

---

## Scripts (development)

| Script | Purpose |
|--------|---------|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run dev` | Watch mode (`tsc --watch`) |
| `npm run dev:run` | Build once, then run the CLI via `scripts/dev-run.mjs`. For flags like `--format`, prefer `node scripts/dev-run.mjs …` or `npm run dev:run -- -- …` — see [DEV_GUIDE](docs/DEV_GUIDE.md) (running the CLI during development) |
| `npm test` | Run Vitest |
| `npm run typecheck` | Typecheck |
| `npm run lint` | ESLint |

Details: **[docs/DEV_GUIDE.md](docs/DEV_GUIDE.md)**.

---

## Publishing to npm (for maintainers)

1. **Account:** Create an account on [npmjs.com](https://www.npmjs.com/) and sign in locally: `npm login`.
2. **Name:** This repo publishes as **`second-brain-os`**. The global **`second-brain`** name on npm is a different package—do not overwrite it. The **`bin`** field installs both **`second-brain-os`** and **`second-brain`** entry points for this project. To use a [scoped](https://docs.npmjs.com/about-scopes) name instead (e.g. `@your-org/second-brain-os`), change `"name"` in `package.json` and set `"publishConfig": { "access": "public" }` for a public scoped package.
3. **Version:** Bump with `npm version patch` (or `minor` / `major`) so `package.json` and git tag stay aligned.
4. **Build:** `prepublishOnly` runs `npm run build`; the tarball includes only `files` listed in `package.json` (`dist/`, `drizzle/`, `README.md`, `LICENSE`, `docs/`).
5. **Dry run:** `npm pack` and inspect the `.tgz`, or `npm publish --dry-run`.
6. **Publish:** `npm publish` (use `--access public` for scoped public packages). npm may require **two-factor authentication** for publishing: use `npm publish --otp=<code>` from your authenticator, or a **granular access token** with publish permissions. `package.json` `repository` / `bugs` / `homepage` should match this GitHub repo.

**Native module:** `better-sqlite3` compiles on install for the user’s platform; no separate publish step for binaries unless you add prebuild automation later.

---

## License

MIT — see [LICENSE](LICENSE).

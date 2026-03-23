# Second Brain OS — Developer guide

This document is for **contributors and maintainers**: how to set up the repo, run the toolchain, navigate the codebase, work with the database layer, test, and ship releases. End-user and integration topics live in **[USER_GUIDE.md](USER_GUIDE.md)**; the project overview is **[README.md](../README.md)**.

---

## 1. Stack and prerequisites

| Requirement | Notes |
|-------------|--------|
| **Node.js 20+** | Matches `package.json` → `engines`. |
| **npm** | Used for install, scripts, and publishing. |
| **Native toolchain** | **`better-sqlite3`** compiles during `npm install`. On Windows, install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (C++ workload) if install fails. See [better-sqlite3 troubleshooting](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/troubleshooting.md). |

**TypeScript:** `tsconfig.json` enables strict options (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, etc.). **ESLint** uses `typescript-eslint` with type-aware rules (`eslint.config.mjs`).

---

## 2. Clone and first-time setup

```bash
git clone https://github.com/NourEldinShobier/second-brain-os.git
cd second-brain-os
npm install
npm run build
```

- **`npm install`** — installs dependencies and builds the native SQLite binding.
- **`npm run build`** — compiles `src/` → **`dist/`** via `tsconfig.build.json` (emit excludes `*.test.ts` and `src/test-support/**` from the bundle).

Verify:

```bash
npx second-brain-os --version
npx second-brain-os --help
```

---

## 3. npm scripts

| Script | Purpose |
|--------|---------|
| `npm run build` | One-shot compile to `dist/`. |
| `npm run dev` | `tsc --watch` using the build config (iterate on CLI; does not run the CLI). |
| `npm run dev:run` | **Build once, then run the CLI** — implemented by `scripts/dev-run.mjs`. Prefer **`node scripts/dev-run.mjs …`** for manual tests so npm does not interpret flags like `--format` / `--help`; or use **`npm run dev:run -- -- …`** (extra `--` before CLI args). See §4. |
| `npm test` | **Vitest** — `src/**/*.test.ts`, Node environment (`vitest.config.mjs`). |
| `npm run test:watch` | Vitest watch mode. |
| `npm run typecheck` | `tsc --noEmit` (full `src/**/*.ts` including tests; uses root `tsconfig.json`). |
| `npm run lint` | ESLint on the project (see ignores in `eslint.config.mjs`). |
| `npm run format` | Prettier write. |
| `npm run db:generate` | **Drizzle Kit** — generate SQL under `drizzle/` from `src/infrastructure/db/schema.ts` (`drizzle.config.ts`). |
| `npm run migrate` | Placeholder script; migrations apply when a workspace DB is bootstrapped (see §6). |

---

## 4. Running the CLI during development

| Method | When to use |
|--------|-------------|
| **`npm run dev:run -- …`** | **Preferred for quick manual checks:** one command = build + `node dist/cli/index.js …`. |
| **`npx second-brain-os …`** | From the **repo root** after `npm install` + `npm run build`. |
| **`node dist/cli/index.js …`** | Direct entrypoint; good for debugging or absolute paths. |
| **`npm link`** | Once after build — installs global symlinks to this package so `second-brain-os` works from any directory. |
| **Global install from npm** | `npm install -g second-brain-os` — use when you are **not** developing the CLI (see USER_GUIDE). |

**Vault directories are not npm packages.** If you `cd` into a vault and run `npx second-brain-os`, npm may error. Use **`--workspace`**, **`SECOND_BRAIN_WORKSPACE`**, a **global** install, or `node /path/to/repo/dist/cli/index.js`.

**npm and CLI flags (Windows / npm 10+):** `npm run dev:run -- doctor --format json` can mis-parse because npm treats some flags as its own. Prefer **`node scripts/dev-run.mjs doctor --format json …`**, or **`npm run dev:run -- -- doctor --format json …`** (note the extra `--` before the subcommand).

---

## 5. Repository layout

| Path | Role |
|------|------|
| **`src/cli/`** | Commander **`program`**, per-command modules, CLI tests (`*.test.ts`, integration tests). |
| **`src/application/`** | Use cases: capture, organize, doctor, reviews, etc. |
| **`src/infrastructure/`** | Markdown repository, SQLite/Drizzle, config, indexing, search, workspace discovery. |
| **`src/domain/`** | Types, markdown conventions, validation helpers. |
| **`src/shared/`** | JSON **envelope**, version string, shared printing helpers. |
| **`src/test-support/`** | Test fixtures and helpers (not emitted in `dist/`). |
| **`drizzle/`** | Generated SQL migrations and meta; **shipped** in the npm package. |
| **`dist/`** | Build output — gitignored; produced by `npm run build`. |

**Layering:** Prefer adding behavior in **application** + **infrastructure** with thin **CLI** adapters. Keep **`src/shared/envelope.ts`** as the single place for JSON response shape when touching outputs.

---

## 6. Database and migrations

- **Schema source:** `src/infrastructure/db/schema.ts` (and related files under `src/infrastructure/db/`).
- **Drizzle config:** `drizzle.config.ts` — SQLite dialect, output directory `drizzle/`.
- **Regenerating SQL:** After schema changes, run **`npm run db:generate`** and commit the new files under `drizzle/`.
- **Runtime:** Workspace databases are created/updated when users run **`init`** or when bootstrap runs; the CLI applies migrations from the shipped `drizzle/` assets. The **`npm run migrate`** script only prints a short pointer (see `scripts/migrate-placeholder.mjs`).

---

## 7. Testing

- **Unit / focused tests:** Colocated as `src/**/*.test.ts` (e.g. domain, infrastructure, application).
- **CLI / integration:** `src/cli/cli-critical-flows.integration.test.ts` and related CLI tests exercise commands against temp workspaces.
- **Running a single file:**  
  `npx vitest run src/path/to/file.test.ts`

Keep tests **deterministic** (temp dirs, no network unless explicitly testing integration). Prefer **`--format json`** in tests when asserting structured output.

---

## 8. Version and releases

1. **`package.json`** — canonical **semver** for npm.
2. **`src/shared/version.ts`** — **`VERSION`** used by `second-brain-os --version`. **Keep it aligned** with `package.json` when you cut a release (same major.minor.patch).
3. Bump with **`npm version patch`** (or `minor` / `major`) so git tags and `package.json` stay in sync, then publish.

---

## 9. Publishing to npm (maintainers)

Summary:

1. `npm login` (2FA may be required on the account).
2. `npm version patch|minor|major` (or edit `package.json` + `version.ts` consistently).
3. `npm publish --dry-run` — inspect tarball; confirm `files` in `package.json` (`dist`, `drizzle`, `README.md`, `LICENSE`, `docs`).
4. `npm publish` — if npm requires OTP: **`npm publish --otp=<code>`**.

**`prepublishOnly`** runs **`npm run build`** automatically before pack/publish.

Full checklist and notes (scoped names, native module): **[README.md § Publishing to npm](../README.md#publishing-to-npm-for-maintainers)**.

---

## 10. Agent skills and internal references

Optional **instruction packs** for AI assistants (see [USER_GUIDE §11](USER_GUIDE.md#11-agent-skills-optional-second-brain-os)) are **not** part of the published npm package; you install them per your IDE or agent (Cursor, Claude Code, Copilot, etc.). Typical layouts include a **`second-brain-os`** folder with `SKILL.md` and `references/`.

- **Product skill (`second-brain-os`):** CLI-first vault workflows; **`references/cli-contract.md`** and **`references/recovery.md`** are the stable tables.
- **Maintainer skill (`second-brain-os-dev`):** scripts, `dev:run`, pre-publish checks, keeping this guide and `src/shared/version.ts` aligned with `package.json`.
- **Skill-creator tooling** (if you use it): evals and benchmarks; see that pack’s own `SKILL.md`.

---

## 11. Roadmap and tasks (in-repo)

Planning documents and task specs may live under **`Tasks markdowns/`** (epics and tasks). Paths can change; treat that folder as the author’s working backlog, not as API documentation.

---

## 12. Related documentation

| Doc | Audience |
|-----|----------|
| [README.md](../README.md) | Overview, install, quick start, publishing summary. |
| [USER_GUIDE.md](USER_GUIDE.md) | Architecture, commands, JSON envelope, troubleshooting. |
| This file | Development, testing, DB workflow, releases. |

---

*When in doubt, `second-brain-os <command> --help` and the tests are authoritative for behavior.*

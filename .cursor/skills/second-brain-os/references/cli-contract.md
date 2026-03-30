# Second Brain OS CLI contract (agent reference)

Commands below use **`second-brain-os`**; the short alias **`second-brain`** is equivalent when installed from npm.

Global options (before subcommand):

| Flag | Meaning |
|------|---------|
| `--format json` / `--json` | JSON envelope on stdout |
| `-n` / `--non-interactive` | No prompts |
| `-q` / `--quiet` | Minimal human output; errors still use stderr one-liner or JSON |
| `--dry-run` | No mutations where supported |
| `--workspace <path>` | Vault root |

## Response envelope (JSON)

Top-level keys are stable: `ok`, `schema_version`, `data`, `warnings`, `errors`, `next_actions`.

- Success: `ok: true`, `data` object.
- Failure: `ok: false`, `errors` array of `{ code, message, details? }`.

## Commands (stable surface)

| Command | Role |
|---------|------|
| `init` | Create workspace, config, DB, layout |
| `capture [text]` | Raw inbox; `--type` for typed entities |
| `organize analyze` | Heuristic inbox suggestions |
| `organize promote` | Inbox → typed entity |
| `organize link` / `rename` / `reclassify` | Relationships & metadata |
| `list <entity>` | Filtered listing |
| `show <ref>` | Entity detail + body |
| `search [query]` | Full-text search |
| `today` | Daily surface |
| `dashboard show` | Aggregated home |
| `review weekly` | Weekly review artifact |
| `archive <kind> <slug>` / `--restore` | Archive semantics |
| `doctor` / `--repair` | Health + optional repair (covers drive) |
| `config show` / `config set` | Config |
| `drive import <path>` | Import file/folder to vault drive (default: inbox) |
| `drive import <path> --primary <link>` | Import with primary location: `area:<slug>`, `project:<slug>`, `resource`, or `inbox` |
| `drive list` | List drive items (filters: `--area`, `--project`, `--task`, `--note`, `--goal`, `--tag`, `--standalone`) |
| `drive list --inbox` | List items without primary link (unsorted) |
| `drive list --primary <entity>` | Filter by primary: `null`, `area:<slug>`, `project:<slug>` |
| `drive show <ref>` | Drive item detail |
| `drive set-primary <ref>` | Set primary link and move to PARA folder (`--area`, `--project`, `--resource`, `--inbox`) |
| `drive move <ref>` | Rename slug: `--slug <new-slug>` |
| `drive structure` | Show PARA folder hierarchy with counts |
| `drive migrate` | Migrate flat items to PARA folders (`--strategy inbox|first-link`, `--limit N`) |
| `drive link <ref>` | Link drive to entities (`--area`, `--project`, etc.) |
| `drive update <ref>` | Update metadata (`--description`, `--tag`, `--body`) |
| `drive archive <slug>` / `drive restore <slug>` | Archive/restore drive package |
| `resolve parent --task <ref>` | Find parent Project/Area for drive placement |
| `resolve parent --note <ref>` | Find parent for note |
| `resolve parent --goal <ref>` | Find parent Area for goal |
| `resolve entity <type> <ref>` | Resolve entity details + child counts |
| `exists <type> <ref>` | Check entity exists (returns bool/JSON) |

## AI provider

`ai_provider` in config accepts only `openai` or `null` (local-only, default). Set via `second-brain-os config set ai_provider openai` or `config set ai_provider null`. When set to `openai`, the stub adapter is used — no API calls are made until a real SDK is wired.

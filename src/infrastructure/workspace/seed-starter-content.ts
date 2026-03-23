import { access, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Result } from '../../domain/result.js';
import { err, ok } from '../../domain/result.js';
import {
  EXAMPLE_AREA,
  EXAMPLE_NOTE,
  FIRST_CAPTURE,
  README_WORKSPACE,
} from './starter-templates.js';

export type SeedError = { readonly kind: 'io'; readonly message: string };

const FILES: readonly { readonly rel: string; readonly body: string }[] = [
  { rel: 'README.md', body: README_WORKSPACE },
  { rel: '01-areas/area-personal.md', body: EXAMPLE_AREA },
  { rel: '06-notes/note-how-your-second-brain-works.md', body: EXAMPLE_NOTE },
  { rel: '00-inbox/inbox-starter-capture.md', body: FIRST_CAPTURE },
];

async function writeIfAbsent(root: string, rel: string, body: string): Promise<Result<true, SeedError>> {
  const full = path.join(root, rel);
  try {
    await access(full);
    return ok(true);
  } catch {
    try {
      await writeFile(full, body, 'utf8');
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      return err({ kind: 'io', message: `Could not write ${full}: ${detail}` });
    }
  }
  return ok(true);
}

/** Idempotent: only creates files that are still missing. */
export async function ensureStarterContent(workspaceRoot: string): Promise<Result<true, SeedError>> {
  const root = path.resolve(workspaceRoot);
  for (const f of FILES) {
    const r = await writeIfAbsent(root, f.rel, f.body);
    if (!r.ok) {
      return r;
    }
  }
  return ok(true);
}

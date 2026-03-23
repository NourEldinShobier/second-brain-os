import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Result } from '../../domain/result.js';
import { err, ok } from '../../domain/result.js';
import { CANONICAL_RELATIVE_DIRS } from './canonical-layout.js';

export type LayoutError = { readonly kind: 'io'; readonly message: string };

export async function ensureCanonicalLayout(workspaceRoot: string): Promise<Result<true, LayoutError>> {
  const root = path.resolve(workspaceRoot);
  try {
    for (const rel of CANONICAL_RELATIVE_DIRS) {
      await mkdir(path.join(root, rel), { recursive: true });
    }
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return err({ kind: 'io', message: `Could not create workspace folders: ${detail}` });
  }
  return ok(true);
}

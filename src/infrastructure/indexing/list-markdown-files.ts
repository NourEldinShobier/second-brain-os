import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { CANONICAL_RELATIVE_DIRS } from '../workspace/canonical-layout.js';

async function walkMarkdownUnder(dir: string, workspaceRoot: string, out: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      await walkMarkdownUnder(abs, workspaceRoot, out);
    } else if (e.isFile() && e.name.endsWith('.md')) {
      out.push(path.relative(workspaceRoot, abs).replace(/\\/g, '/'));
    }
  }
}

/** All `.md` files under canonical PARA/CODE layout folders. */
export async function listIndexedMarkdownPaths(workspaceRoot: string): Promise<string[]> {
  const root = path.resolve(workspaceRoot);
  const out: string[] = [];
  for (const rel of CANONICAL_RELATIVE_DIRS) {
    await walkMarkdownUnder(path.join(root, rel), root, out);
  }
  return out;
}

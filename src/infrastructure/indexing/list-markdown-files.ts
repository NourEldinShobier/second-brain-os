import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { parseEntityFilename } from '../../domain/markdown/filename.js';
import { CANONICAL_RELATIVE_DIRS } from '../workspace/canonical-layout.js';
import { isDriveItemMarkdownPath } from './drive-markdown-path.js';

const LEGACY_ACTIVE_ROOTS = new Set([
  '00-inbox',
  '01-areas',
  '02-goals',
  '03-projects',
  '04-tasks',
  '05-resources',
  '06-notes',
]);

const LEGACY_ARCHIVE_ROOTS = new Set([
  '99-archive/inbox',
  '99-archive/areas',
  '99-archive/goals',
  '99-archive/projects',
  '99-archive/tasks',
  '99-archive/resources',
  '99-archive/notes',
]);

/** Entity packages use `index.md`; skip `assets/` and other non-entity Markdown. Legacy flat `kind-slug.md` still indexed. */
function isIndexableEntityMarkdownPath(relPath: string): boolean {
  const norm = relPath.replace(/\\/g, '/');
  if (/(^|\/)assets\//u.test(norm)) {
    return false;
  }
  if (norm.endsWith('/index.md')) {
    return true;
  }
  const parts = norm.split('/');
  const base = parts[parts.length - 1] ?? '';
  const parsed = parseEntityFilename(base);
  if ('error' in parsed) {
    return false;
  }
  if (parts.length === 2) {
    const top = parts[0];
    return top !== undefined && LEGACY_ACTIVE_ROOTS.has(top);
  }
  if (parts.length === 3 && parts[0] === '99-archive') {
    const second = parts[1];
    return second !== undefined && LEGACY_ARCHIVE_ROOTS.has(`99-archive/${second}`);
  }
  return false;
}

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
      const rel = path.relative(workspaceRoot, abs).replace(/\\/g, '/');
      if (isIndexableEntityMarkdownPath(rel) || isDriveItemMarkdownPath(rel)) {
        out.push(rel);
      }
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

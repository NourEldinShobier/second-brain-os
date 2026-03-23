import { access, constants } from 'node:fs/promises';
import path from 'node:path';

/** Walk parents from `startDir` until `.second-brain/config.yml` exists; return its workspace root. */
export async function discoverWorkspaceRoot(startDir: string): Promise<string | null> {
  let dir = path.resolve(startDir);
  for (;;) {
    const candidate = path.join(dir, '.second-brain', 'config.yml');
    try {
      await access(candidate, constants.R_OK);
      return dir;
    } catch {
      const parent = path.dirname(dir);
      if (parent === dir) {
        break;
      }
      dir = parent;
    }
  }
  return null;
}

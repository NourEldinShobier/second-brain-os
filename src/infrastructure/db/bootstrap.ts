import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Result } from '../../domain/result.js';
import { err, ok } from '../../domain/result.js';
import { openAndMigrate } from './open-database.js';

/** Create parent dirs, open SQLite, and apply Drizzle migrations. */
export async function bootstrapWorkspaceDatabase(
  workspaceRoot: string,
  databaseRelativePath: string,
): Promise<Result<true, string>> {
  const abs = path.resolve(workspaceRoot, databaseRelativePath);
  try {
    await mkdir(path.dirname(abs), { recursive: true });
    openAndMigrate(abs);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return err(`SQLite bootstrap failed: ${detail}`);
  }
  return ok(true);
}

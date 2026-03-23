import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { WorkspaceConfig } from '../domain/config-model.js';
import { saveWorkspaceConfigFile } from '../infrastructure/config/save-workspace-config.js';
import type { SecondBrainDb } from '../infrastructure/db/open-database.js';
import { closeSecondBrainDatabase, openAndMigrate } from '../infrastructure/db/open-database.js';
import { ensureCanonicalLayout } from '../infrastructure/workspace/create-layout.js';

export interface TestWorkspace {
  readonly root: string;
  readonly databaseAbsolutePath: string;
  readonly db: SecondBrainDb;
  readonly cleanup: () => Promise<void>;
}

/**
 * Temporary workspace with config, canonical folders, migrated SQLite — for integration-style tests.
 */
export async function createTestWorkspace(config?: Partial<WorkspaceConfig>): Promise<TestWorkspace> {
  const root = await mkdtemp(join(tmpdir(), 'sb-fixture-'));
  const layout = await ensureCanonicalLayout(root);
  if (!layout.ok) {
    await rm(root, { recursive: true, force: true });
    throw new Error(layout.error.message);
  }
  const cfgPath = join(root, '.second-brain', 'config.yml');
  const fullConfig: WorkspaceConfig = {
    schema_version: '1',
    database_path: '.second-brain/second-brain.db',
    output_style: 'pretty',
    ai_provider: null,
    ...config,
  };
  const saved = await saveWorkspaceConfigFile(cfgPath, fullConfig);
  if (!saved.ok) {
    await rm(root, { recursive: true, force: true });
    throw new Error(saved.error.message);
  }
  const databaseAbsolutePath = join(root, fullConfig.database_path);
  await mkdir(dirname(databaseAbsolutePath), { recursive: true });
  const db = openAndMigrate(databaseAbsolutePath);
  return {
    root,
    databaseAbsolutePath,
    db,
    cleanup: async () => {
      closeSecondBrainDatabase(db);
      await rm(root, { recursive: true, force: true });
    },
  };
}

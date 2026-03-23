import path from 'node:path';
import type { WorkspaceConfig } from '../../domain/config-model.js';
import type { Result } from '../../domain/result.js';
import { err, ok } from '../../domain/result.js';
import type { ConfigLoadError } from '../config/config-load-error.js';
import { loadWorkspaceConfigFile } from '../config/load-workspace-config.js';
import { discoverWorkspaceRoot } from './discover-workspace-root.js';

export interface ResolveWorkspaceInput {
  readonly cwd: string;
  readonly workspaceFlag?: string | undefined;
  readonly envWorkspace?: string | undefined;
}

export interface ResolvedWorkspace {
  readonly workspaceRoot: string;
  readonly configPath: string;
  readonly config: WorkspaceConfig;
  readonly databaseAbsolutePath: string;
}

export type WorkspaceResolveFailure =
  | { readonly kind: 'missing_workspace'; readonly message: string }
  | { readonly kind: 'config_load'; readonly error: ConfigLoadError };

function configPathForRoot(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.second-brain', 'config.yml');
}

export async function resolveWorkspace(
  input: ResolveWorkspaceInput,
): Promise<Result<ResolvedWorkspace, WorkspaceResolveFailure>> {
  const explicit = input.workspaceFlag ?? input.envWorkspace;
  let root: string | null = null;

  if (explicit !== undefined && explicit.length > 0) {
    root = path.resolve(input.cwd, explicit);
  } else {
    root = await discoverWorkspaceRoot(input.cwd);
  }

  if (root === null) {
    return err({
      kind: 'missing_workspace',
      message:
        'No workspace found. Looked for `.second-brain/config.yml` from the current directory, ' +
        'or set `SECOND_BRAIN_WORKSPACE` / pass `--workspace <path>`.',
    });
  }

  const configPath = configPathForRoot(root);
  const loaded = await loadWorkspaceConfigFile(configPath);
  if (!loaded.ok) {
    return err({ kind: 'config_load', error: loaded.error });
  }

  const databaseAbsolutePath = path.isAbsolute(loaded.value.database_path)
    ? loaded.value.database_path
    : path.resolve(root, loaded.value.database_path);

  return ok({
    workspaceRoot: root,
    configPath,
    config: loaded.value,
    databaseAbsolutePath,
  });
}

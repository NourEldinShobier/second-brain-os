import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { stringify } from 'yaml';
import type { WorkspaceConfig } from '../../domain/config-model.js';
import type { Result } from '../../domain/result.js';
import { err, ok } from '../../domain/result.js';
import type { ConfigLoadError } from './config-load-error.js';

export async function saveWorkspaceConfigFile(
  configYamlPath: string,
  config: WorkspaceConfig,
): Promise<Result<true, ConfigLoadError>> {
  const body = {
    schema_version: config.schema_version,
    ...(config.workspace_root !== undefined ? { workspace_root: config.workspace_root } : {}),
    database_path: config.database_path,
    output_style: config.output_style,
    ai_provider: config.ai_provider,
  };

  const text = stringify(body, { lineWidth: 100 });
  try {
    await mkdir(dirname(configYamlPath), { recursive: true });
    await writeFile(configYamlPath, text, 'utf8');
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return err({
      kind: 'missing_file',
      path: configYamlPath,
      message: `Could not write config at ${configYamlPath}: ${detail}`,
    });
  }

  return ok(true);
}

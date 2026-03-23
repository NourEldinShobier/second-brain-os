import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import type { WorkspaceConfig } from '../../domain/config-model.js';
import type { Result } from '../../domain/result.js';
import { err, ok } from '../../domain/result.js';
import type { ConfigLoadError } from './config-load-error.js';
import { workspaceConfigSchema, type WorkspaceConfigParsed } from './workspace-config-schema.js';

function toModel(parsed: WorkspaceConfigParsed): WorkspaceConfig {
  const base: WorkspaceConfig = {
    schema_version: parsed.schema_version,
    database_path: parsed.database_path,
    output_style: parsed.output_style,
    ai_provider: parsed.ai_provider ?? null,
  };
  return parsed.workspace_root !== undefined
    ? { ...base, workspace_root: parsed.workspace_root }
    : base;
}

export async function loadWorkspaceConfigFile(
  configYamlPath: string,
): Promise<Result<WorkspaceConfig, ConfigLoadError>> {
  let rawText: string;
  try {
    rawText = await readFile(configYamlPath, 'utf8');
  } catch {
    return err({
      kind: 'missing_file',
      path: configYamlPath,
      message: `Config file not found or unreadable: ${configYamlPath}`,
    });
  }

  let doc: unknown;
  try {
    doc = parseYaml(rawText);
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return err({
      kind: 'invalid_yaml',
      path: configYamlPath,
      message: `Invalid YAML in ${configYamlPath}: ${detail}`,
    });
  }

  const parsed = workspaceConfigSchema.safeParse(doc);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`).join('; ');
    return err({
      kind: 'validation',
      path: configYamlPath,
      message: `Invalid config in ${configYamlPath}: ${msg}`,
    });
  }

  return ok(toModel(parsed.data));
}

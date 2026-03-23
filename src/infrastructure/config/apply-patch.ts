import { normalizeAiProviderCliValue } from '../../domain/ai-provider.js';
import type { WorkspaceConfig } from '../../domain/config-model.js';
import type { Result } from '../../domain/result.js';
import { err, ok } from '../../domain/result.js';
import { workspaceConfigSchema } from './workspace-config-schema.js';

const PATCHABLE = new Set(['output_style', 'database_path', 'ai_provider']);

export function parseConfigSet(
  key: string,
  rawValue: string,
): Result<Partial<Pick<WorkspaceConfig, 'output_style' | 'database_path' | 'ai_provider'>>, string> {
  if (!PATCHABLE.has(key)) {
    return err(`Unsupported key: ${key}. Use: output_style, database_path, or ai_provider.`);
  }

  if (key === 'output_style') {
    if (rawValue !== 'pretty' && rawValue !== 'markdown' && rawValue !== 'json') {
      return err('output_style must be pretty, markdown, or json.');
    }
    return ok({ output_style: rawValue });
  }

  if (key === 'database_path') {
    if (rawValue.length < 1) {
      return err('database_path cannot be empty.');
    }
    return ok({ database_path: rawValue });
  }

  if (key === 'ai_provider') {
    const n = normalizeAiProviderCliValue(rawValue);
    if (!n.ok) {
      return err(n.error);
    }
    return ok({ ai_provider: n.value });
  }

  return err('Unreachable');
}

export function mergeWorkspaceConfig(
  current: WorkspaceConfig,
  patch: Partial<Pick<WorkspaceConfig, 'output_style' | 'database_path' | 'ai_provider'>>,
): Result<WorkspaceConfig, string> {
  const merged: WorkspaceConfig = {
    schema_version: current.schema_version,
    database_path: patch.database_path ?? current.database_path,
    output_style: patch.output_style ?? current.output_style,
    ai_provider: patch.ai_provider !== undefined ? patch.ai_provider : current.ai_provider,
  };
  const withRoot =
    current.workspace_root !== undefined
      ? { ...merged, workspace_root: current.workspace_root }
      : merged;

  const parsed = workspaceConfigSchema.safeParse(withRoot);
  if (!parsed.success) {
    return err(parsed.error.issues.map((i) => i.message).join('; '));
  }

  const out: WorkspaceConfig = {
    schema_version: parsed.data.schema_version,
    database_path: parsed.data.database_path,
    output_style: parsed.data.output_style,
    ai_provider: parsed.data.ai_provider ?? null,
  };
  return parsed.data.workspace_root !== undefined
    ? ok({ ...out, workspace_root: parsed.data.workspace_root })
    : ok(out);
}

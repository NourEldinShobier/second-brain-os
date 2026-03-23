import { z } from 'zod';

const aiProviderYaml = z.preprocess((val: unknown) => {
  if (val === null || val === undefined) {
    return null;
  }
  if (typeof val !== 'string') {
    return val;
  }
  const t = val.trim();
  if (t === '' || t.toLowerCase() === 'null') {
    return null;
  }
  if (t.toLowerCase() === 'openai') {
    return 'openai';
  }
  return val;
}, z.union([z.literal('openai'), z.null()]));

/** Validates `<workspace>/.second-brain/config.yml` payload. */
export const workspaceConfigSchema = z.object({
  schema_version: z.string().min(1),
  workspace_root: z.string().optional(),
  database_path: z.string().min(1).default('.second-brain/second-brain.db'),
  output_style: z.enum(['pretty', 'markdown', 'json']).default('pretty'),
  ai_provider: aiProviderYaml.optional().default(null),
});

export type WorkspaceConfigParsed = z.infer<typeof workspaceConfigSchema>;

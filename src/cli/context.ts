import type { Command } from 'commander';
import type { OutputFormat } from '../shared/output-format.js';

export type { OutputFormat } from '../shared/output-format.js';

/** Shared flags and resolved options for every command invocation. */
export interface CommandContext {
  readonly outputFormat: OutputFormat;
  readonly nonInteractive: boolean;
  readonly quiet: boolean;
  readonly dryRun: boolean;
  /** Explicit `--workspace` path (resolved relative to cwd when relative). */
  readonly workspaceFlag?: string | undefined;
}

interface GlobalOptionBag {
  format?: string;
  json?: boolean;
  nonInteractive?: boolean;
  quiet?: boolean;
  dryRun?: boolean;
  workspace?: string;
}

function normalizeOutputFormat(raw: string | undefined, jsonFlag: boolean | undefined): OutputFormat {
  if (jsonFlag) {
    return 'json';
  }
  if (raw === 'markdown' || raw === 'json' || raw === 'pretty') {
    return raw;
  }
  return 'pretty';
}

/** Resolve merged global + inherited options from the active command. */
export function commandContextFrom(cmd: Command): CommandContext {
  const o = cmd.optsWithGlobals<GlobalOptionBag>();
  return {
    outputFormat: normalizeOutputFormat(o.format, o.json),
    nonInteractive: Boolean(o.nonInteractive),
    quiet: Boolean(o.quiet),
    dryRun: Boolean(o.dryRun),
    workspaceFlag: o.workspace,
  };
}

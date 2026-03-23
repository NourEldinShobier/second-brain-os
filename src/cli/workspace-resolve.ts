import type { CommandContext } from './context.js';
import type { ResolvedWorkspace } from '../infrastructure/workspace/resolve-workspace.js';
import {
  resolveWorkspace,
  type WorkspaceResolveFailure,
} from '../infrastructure/workspace/resolve-workspace.js';
import type { Result } from '../domain/result.js';

export function resolveWorkspaceForCli(
  ctx: CommandContext,
): Promise<Result<ResolvedWorkspace, WorkspaceResolveFailure>> {
  return resolveWorkspace({
    cwd: process.cwd(),
    workspaceFlag: ctx.workspaceFlag,
    envWorkspace: process.env['SECOND_BRAIN_WORKSPACE'],
  });
}

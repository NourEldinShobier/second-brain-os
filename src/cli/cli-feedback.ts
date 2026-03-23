import type { CommandContext } from './context.js';
import { isJsonOutput, shouldPrintHuman } from './output-policy.js';

/** Mark the process as failed (non-zero exit) for automation and CI. */
export function cliFailed(): void {
  process.exitCode = 1;
}

/**
 * When human-oriented output is suppressed (--quiet without --json), still surface
 * a single stderr line so scripts can detect failures without parsing prompts.
 */
export function emitQuietFallback(ctx: CommandContext, plainMessage: string): void {
  if (isJsonOutput(ctx)) {
    return;
  }
  if (shouldPrintHuman(ctx)) {
    return;
  }
  console.error(`second-brain-os: ${plainMessage}`);
}

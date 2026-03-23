import type { CommandContext } from './context.js';

export function shouldPrintHuman(ctx: CommandContext): boolean {
  return !ctx.quiet && ctx.outputFormat !== 'json';
}

export function isJsonOutput(ctx: CommandContext): boolean {
  return ctx.outputFormat === 'json';
}

import type { CommandContext } from '../context.js';
import { shouldPrintHuman } from '../output-policy.js';

const HR = '─'.repeat(48);

export function heading(ctx: CommandContext, title: string): void {
  if (!shouldPrintHuman(ctx)) {
    return;
  }
  console.log('');
  console.log(`  ${title}`);
  console.log(`  ${HR}`);
}

export function bodyLine(ctx: CommandContext, line: string): void {
  if (!shouldPrintHuman(ctx)) {
    return;
  }
  console.log(`  ${line}`);
}

export function suggestions(ctx: CommandContext, items: readonly string[]): void {
  if (!shouldPrintHuman(ctx) || items.length === 0) {
    return;
  }
  console.log('');
  console.log('  Next steps');
  console.log(`  ${HR}`);
  for (const item of items) {
    console.log(`  • ${item}`);
  }
}

export function warningBlock(ctx: CommandContext, message: string): void {
  if (!shouldPrintHuman(ctx)) {
    return;
  }
  console.log('');
  console.log(`  Warning: ${message}`);
}

export function errorBlock(ctx: CommandContext, message: string): void {
  if (!shouldPrintHuman(ctx)) {
    return;
  }
  console.log('');
  console.log(`  ${message}`);
}

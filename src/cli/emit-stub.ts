import type { CommandContext } from './context.js';
import { isJsonOutput, shouldPrintHuman } from './output-policy.js';
import * as presentation from './presentation/blocks.js';
import { successEnvelope } from '../shared/envelope.js';
import { printJsonEnvelope } from '../shared/print-envelope.js';

export function emitNotImplemented(
  ctx: CommandContext,
  command: string,
  nextActions: readonly string[],
): void {
  const data = { command, phase: 'not_implemented' as const };
  const envelope = successEnvelope(data, [], nextActions);

  if (isJsonOutput(ctx)) {
    printJsonEnvelope(envelope);
    return;
  }

  if (ctx.outputFormat === 'markdown') {
    console.log(`## ${command}\n`);
    console.log('_Status: not yet implemented._\n');
    if (nextActions.length > 0) {
      console.log('### Suggested next steps\n');
      for (const line of nextActions) {
        console.log(`- ${line}`);
      }
      console.log('');
    }
    return;
  }

  if (shouldPrintHuman(ctx)) {
    presentation.heading(ctx, command);
    presentation.bodyLine(ctx, 'This command is registered but not implemented yet.');
    presentation.suggestions(ctx, nextActions);
  }
}

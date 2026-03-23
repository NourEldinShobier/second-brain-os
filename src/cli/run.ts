import { createProgram } from './program.js';

export async function runCli(argv: string[]): Promise<void> {
  const program = createProgram();
  await program.parseAsync(argv);
}

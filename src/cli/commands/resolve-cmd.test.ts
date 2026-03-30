import { describe, expect, it } from 'vitest';
import { createProgram } from '../program.js';

describe('resolve command registration', () => {
  it('registers resolve as top-level command', () => {
    const program = createProgram();
    const resolve = program.commands.find((c) => c.name() === 'resolve');
    expect(resolve).toBeDefined();
  });

  it('registers parent subcommand under resolve', () => {
    const program = createProgram();
    const resolve = program.commands.find((c) => c.name() === 'resolve');
    const parent = resolve?.commands.find((c) => c.name() === 'parent');
    expect(parent).toBeDefined();
    expect(parent?.options.map((o) => o.long)).toContain('--task');
    expect(parent?.options.map((o) => o.long)).toContain('--note');
    expect(parent?.options.map((o) => o.long)).toContain('--goal');
  });
});

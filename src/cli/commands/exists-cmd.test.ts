import { describe, expect, it } from 'vitest';
import { createProgram } from '../program.js';

describe('exists command', () => {
  it('registers exists as a top-level command', () => {
    const program = createProgram();
    const existsCmd = program.commands.find((c) => c.name() === 'exists');
    expect(existsCmd).toBeDefined();
    expect(existsCmd?.description()).toContain('Check if an entity exists');
  });

  it('accepts entity-type and ref positional arguments', () => {
    const program = createProgram();
    const existsCmd = program.commands.find((c) => c.name() === 'exists');
    const registeredArgs =
      (existsCmd as unknown as { registeredArguments: unknown[] }).registeredArguments ?? [];
    expect(registeredArgs.length).toBe(2);
  });
});

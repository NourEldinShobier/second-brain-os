import { describe, expect, it } from 'vitest';
import { createProgram } from './program.js';

describe('createProgram', () => {
  it('registers every top-level command group from the PRD', () => {
    const program = createProgram();
    const top = program.commands.map((c) => c.name()).sort();
    expect(top).toEqual(
      [
        'archive',
        'capture',
        'config',
        'dashboard',
        'doctor',
        'init',
        'list',
        'organize',
        'review',
        'search',
        'show',
        'today',
      ].sort(),
    );
  });

  it('nests config show and set under config', () => {
    const program = createProgram();
    const cfg = program.commands.find((c) => c.name() === 'config');
    expect(cfg?.commands.map((c) => c.name()).sort()).toEqual(['set', 'show']);
  });

  it('nests dashboard show under dashboard', () => {
    const program = createProgram();
    const dash = program.commands.find((c) => c.name() === 'dashboard');
    expect(dash?.commands.map((c) => c.name())).toEqual(['show']);
  });

  it('nests review weekly under review', () => {
    const program = createProgram();
    const rev = program.commands.find((c) => c.name() === 'review');
    expect(rev?.commands.map((c) => c.name())).toEqual(['weekly']);
  });

  it('nests organize analyze, promote, rename, link, reclassify under organize', () => {
    const program = createProgram();
    const org = program.commands.find((c) => c.name() === 'organize');
    expect(org?.commands.map((c) => c.name()).sort()).toEqual(['analyze', 'link', 'promote', 'reclassify', 'rename']);
  });
});

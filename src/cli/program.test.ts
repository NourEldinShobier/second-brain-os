import { describe, expect, it } from 'vitest';
import { createProgram } from './program.js';

describe('createProgram', () => {
  it('registers every top-level command group from the PRD', () => {
    const program = createProgram();
    const top = program.commands.map((c) => c.name()).sort();
    expect(top).toEqual(
      [
        'capture',
        'config',
        'dashboard',
        'doctor',
        'drive',
        'init',
        'list',
        'organize',
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

  it('nests organize analyze, promote, rename, link, reclassify under organize', () => {
    const program = createProgram();
    const org = program.commands.find((c) => c.name() === 'organize');
    expect(org?.commands.map((c) => c.name()).sort()).toEqual([
      'analyze',
      'link',
      'promote',
      'reclassify',
      'rename',
    ]);
  });

  it('nests drive import, list, show, link, update under drive', () => {
    const program = createProgram();
    const drive = program.commands.find((c) => c.name() === 'drive');
    expect(drive?.commands.map((c) => c.name()).sort()).toEqual([
      'import',
      'link',
      'list',
      'show',
      'update',
    ]);
  });
});

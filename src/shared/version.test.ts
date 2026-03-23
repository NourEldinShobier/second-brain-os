import { describe, expect, it } from 'vitest';
import { VERSION } from './version.js';

describe('version', () => {
  it('is a non-empty semver-shaped string', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});

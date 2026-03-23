import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ENVELOPE_STABLE_FIELDS } from '../shared/envelope.js';
import { runCli } from './run.js';

describe('CLI hardening (quiet, exit codes, dry-run)', () => {
  beforeEach(() => {
    process.exitCode = 0;
  });

  afterEach(() => {
    process.exitCode = 0;
  });

  it('sets exit code 1 when capture fails validation in quiet mode', async () => {
    await runCli(['node', 'test', 'capture', '--quiet']);
    expect(process.exitCode).toBe(1);
  });

  it('prints a single stderr line for quiet validation failures', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await runCli(['node', 'test', 'capture', '--quiet']);
    expect(spy).toHaveBeenCalledWith(expect.stringMatching(/^second-brain-os:/));
    spy.mockRestore();
  });

  it('sets exit code 1 for JSON validation failures', async () => {
    await runCli(['node', 'test', 'capture', '--format', 'json']);
    expect(process.exitCode).toBe(1);
  });

  it('prints JSON errors using the stable top-level envelope fields', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runCli(['node', 'test', 'capture', '--format', 'json']);
    const raw: unknown = spy.mock.calls[0]?.[0];
    spy.mockRestore();
    expect(raw).toBeDefined();
    const parsed: unknown = JSON.parse(String(raw));
    expect(parsed).toEqual(expect.any(Object));
    expect(parsed).not.toBeNull();
    const rec = parsed as Record<string, unknown>;
    for (const k of ENVELOPE_STABLE_FIELDS) {
      expect(rec).toHaveProperty(k);
    }
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ENVELOPE_STABLE_FIELDS } from '../shared/envelope.js';
import { createTestWorkspace } from '../test-support/workspace-fixture.js';
import { runCli } from './run.js';

/** Parses the first pretty-printed JSON object from mocked `console.log` output. */
function parseJsonEnvelopeFromLogs(logs: readonly string[]): unknown {
  const raw = logs.join('\n').trim();
  const start = raw.indexOf('{');
  expect(start).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let i = start; i < raw.length; i++) {
    const c = raw[i];
    if (c === '{') depth++;
    if (c === '}') {
      depth--;
      if (depth === 0) {
        return JSON.parse(raw.slice(start, i + 1));
      }
    }
  }
  throw new Error('Expected a JSON object in console output');
}

describe('CLI critical flows (integration)', () => {
  beforeEach(() => {
    process.exitCode = 0;
  });

  afterEach(() => {
    process.exitCode = 0;
  });

  it('capture and doctor succeed with JSON envelopes on a fresh workspace', async () => {
    const ws = await createTestWorkspace();
    try {
      const capLogs: string[] = [];
      const capSpy = vi.spyOn(console, 'log').mockImplementation((msg) => {
        capLogs.push(String(msg));
      });
      await runCli(['node', 'test', 'capture', '--workspace', ws.root, '--format', 'json', 'integration smoke']);
      capSpy.mockRestore();

      expect(process.exitCode).not.toBe(1);
      const capParsed = parseJsonEnvelopeFromLogs(capLogs) as Record<string, unknown>;
      for (const k of ENVELOPE_STABLE_FIELDS) {
        expect(capParsed).toHaveProperty(k);
      }
      expect(capParsed.ok).toBe(true);

      const docLogs: string[] = [];
      const docSpy = vi.spyOn(console, 'log').mockImplementation((msg) => {
        docLogs.push(String(msg));
      });
      await runCli(['node', 'test', 'doctor', '--workspace', ws.root, '--format', 'json']);
      docSpy.mockRestore();

      expect(process.exitCode).not.toBe(1);
      const docParsed = parseJsonEnvelopeFromLogs(docLogs) as Record<string, unknown>;
      for (const k of ENVELOPE_STABLE_FIELDS) {
        expect(docParsed).toHaveProperty(k);
      }
      expect(docParsed.ok).toBe(true);
    } finally {
      await ws.cleanup();
    }
  });

  it('config show returns JSON envelope for the workspace', async () => {
    const ws = await createTestWorkspace();
    try {
      const logs: string[] = [];
      const spy = vi.spyOn(console, 'log').mockImplementation((msg) => {
        logs.push(String(msg));
      });
      await runCli(['node', 'test', 'config', 'show', '--workspace', ws.root, '--format', 'json']);
      spy.mockRestore();

      expect(process.exitCode).not.toBe(1);
      const parsed = parseJsonEnvelopeFromLogs(logs) as Record<string, unknown>;
      expect(parsed.ok).toBe(true);
      expect(parsed.data).toEqual(expect.any(Object));
    } finally {
      await ws.cleanup();
    }
  });
});

import { describe, expect, it } from 'vitest';
import { ErrorCodes } from './error-codes.js';
import { ENVELOPE_STABLE_FIELDS, errorEnvelope, successEnvelope } from './envelope.js';
import { recoverableError } from './recoverable.js';

function expectStableEnvelopeKeys(record: Record<string, unknown>): void {
  for (const k of ENVELOPE_STABLE_FIELDS) {
    expect(record).toHaveProperty(k);
  }
  expect(Object.keys(record).every((k) => (ENVELOPE_STABLE_FIELDS as readonly string[]).includes(k))).toBe(
    true,
  );
}

describe('JsonEnvelope', () => {
  it('serializes a success payload with stable top-level keys', () => {
    const env = successEnvelope({ hello: 'world' }, [], ['Run doctor']);
    expect(env.ok).toBe(true);
    expect(env.schema_version).toMatch(/^\d+\.\d+\.\d+/);
    expect(env.data).toEqual({ hello: 'world' });
    expect(env.errors).toEqual([]);
    expect(env.next_actions).toEqual(['Run doctor']);
    expect(JSON.parse(JSON.stringify(env))).toMatchObject({
      ok: true,
      data: { hello: 'world' },
    });
    expectStableEnvelopeKeys(env as unknown as Record<string, unknown>);
  });

  it('serializes recoverable errors with codes and next actions', () => {
    const env = errorEnvelope(
      [recoverableError(ErrorCodes.MISSING_WORKSPACE, 'No .second-brain workspace found.')],
      ['Run `second-brain-os init` to create a workspace.'],
    );
    expect(env.ok).toBe(false);
    expect(env.data).toBeNull();
    expect(env.errors[0]?.code).toBe(ErrorCodes.MISSING_WORKSPACE);
    expect(env.next_actions[0]).toContain('init');
    expectStableEnvelopeKeys(env as unknown as Record<string, unknown>);
  });

  it('matches snapshot for contract regression (update intentionally when schema changes)', () => {
    const okEnv = successEnvelope({ sample: true }, [{ code: 'demo', message: 'optional warning' }], ['next']);
    const errEnv = errorEnvelope([recoverableError(ErrorCodes.VALIDATION, 'bad input')], ['fix and retry']);
    expect(okEnv).toMatchSnapshot('success');
    expect(errEnv).toMatchSnapshot('error');
  });
});

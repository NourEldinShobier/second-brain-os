import { describe, expect, it } from 'vitest';
import { validateRelationshipInvariants } from './validation.js';

describe('validateRelationshipInvariants', () => {
  it('requires goals to list at least one area', () => {
    const r = validateRelationshipInvariants({
      id: '11111111-1111-4111-8111-111111111111',
      kind: 'goal',
      version: 1,
      slug: 'run-10k',
      title: 'Run 10k',
      status: 'active',
    });
    expect(r.ok).toBe(false);
    if (r.ok) {
      return;
    }
    expect(r.error).toContain('area');
  });

  it('accepts a goal with area_ids', () => {
    const r = validateRelationshipInvariants({
      id: '22222222-2222-4222-8222-222222222222',
      kind: 'goal',
      version: 1,
      slug: 'run-10k',
      title: 'Run 10k',
      status: 'active',
      area_ids: ['33333333-3333-4333-8333-333333333333'],
    });
    expect(r.ok).toBe(true);
  });

  it('requires projects to list at least one area', () => {
    const r = validateRelationshipInvariants({
      id: '44444444-4444-4444-8444-444444444444',
      kind: 'project',
      version: 1,
      slug: 'site',
      title: 'Site',
      status: 'active',
    });
    expect(r.ok).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { buildEntityFilename, parseEntityFilename } from './filename.js';

describe('parseEntityFilename', () => {
  it('parses typed prefixes and dated inbox files', () => {
    expect(parseEntityFilename('area-personal.md')).toMatchObject({
      kind: 'area',
      slug: 'personal',
    });
    expect(parseEntityFilename('2026-03-23-starter.md')).toMatchObject({
      kind: 'inbox_item',
      slug: 'starter',
      inboxDate: '2026-03-23',
    });
    expect(parseEntityFilename('inbox-notes.md')).toMatchObject({
      kind: 'inbox_item',
      slug: 'notes',
    });
  });
});

describe('buildEntityFilename', () => {
  it('builds names consistent with parse', () => {
    expect(buildEntityFilename('task', 'book-dentist')).toBe('task-book-dentist.md');
    expect(buildEntityFilename('inbox_item', 'cap', { inboxDate: '2026-01-02' })).toBe(
      '2026-01-02-cap.md',
    );
  });
});

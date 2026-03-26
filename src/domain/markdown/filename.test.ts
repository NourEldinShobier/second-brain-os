import { describe, expect, it } from 'vitest';
import { buildEntityFilename, parseEntityDocumentRelativePath, parseEntityFilename } from './filename.js';

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

describe('parseEntityDocumentRelativePath', () => {
  it('parses package index paths and legacy flat files', () => {
    expect(parseEntityDocumentRelativePath('04-tasks/my-task/index.md')).toMatchObject({
      kind: 'task',
      slug: 'my-task',
    });
    expect(parseEntityDocumentRelativePath('00-inbox/2026-01-02-cap/index.md')).toMatchObject({
      kind: 'inbox_item',
      slug: 'cap',
      inboxDate: '2026-01-02',
    });
    expect(parseEntityDocumentRelativePath('00-inbox/inbox-notes/index.md')).toMatchObject({
      kind: 'inbox_item',
      slug: 'notes',
    });
    expect(parseEntityDocumentRelativePath('99-archive/tasks/foo/index.md')).toMatchObject({
      kind: 'task',
      slug: 'foo',
    });
    expect(parseEntityDocumentRelativePath('04-tasks/task-legacy.md')).toMatchObject({
      kind: 'task',
      slug: 'legacy',
    });
  });
});

import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EntityCrudService } from './entity-crud-service.js';
import {
  addCalendarDays,
  buildDailySurface,
  isCompletedTaskStatus,
  isFocusTaskStatus,
  localIsoDate,
} from './daily-surface.js';
import { openAndMigrate } from '../infrastructure/db/open-database.js';
import { MarkdownWorkspaceRepository } from '../infrastructure/markdown/markdown-repository.js';
import { ensureCanonicalLayout } from '../infrastructure/workspace/create-layout.js';

describe('daily-surface helpers', () => {
  it('formats local ISO date', () => {
    expect(localIsoDate(new Date(2026, 2, 23))).toBe('2026-03-23');
  });

  it('adds calendar days', () => {
    expect(addCalendarDays('2026-01-10', 5)).toBe('2026-01-15');
  });

  it('detects completed task statuses', () => {
    expect(isCompletedTaskStatus('done')).toBe(true);
    expect(isCompletedTaskStatus('Delegated')).toBe(true);
    expect(isCompletedTaskStatus('todo')).toBe(false);
  });

  it('detects focus statuses', () => {
    expect(isFocusTaskStatus('Do Next')).toBe(true);
    expect(isFocusTaskStatus('in-progress')).toBe(true);
    expect(isFocusTaskStatus('todo')).toBe(false);
  });
});

describe('buildDailySurface', () => {
  it('buckets overdue, today, upcoming, and focus tasks', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-daily-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);
    const repo = new MarkdownWorkspaceRepository(root);
    const entities = new EntityCrudService(repo, db);

    const area = await entities.createArea({ title: 'A', slug: 'a' });
    expect(area.ok).toBe(true);
    if (!area.ok) {
      return;
    }
    const aid = area.value.meta.id;

    const overdue = await entities.createTask({
      title: 'Past',
      slug: 'past',
      status: 'todo',
      areaIds: [aid],
      dueDate: '2026-01-14',
    });
    const today = await entities.createTask({
      title: 'Today',
      slug: 'today',
      status: 'todo',
      areaIds: [aid],
      dueDate: '2026-01-15',
    });
    const soon = await entities.createTask({
      title: 'Soon',
      slug: 'soon',
      status: 'todo',
      areaIds: [aid],
      dueDate: '2026-01-17',
    });
    const done = await entities.createTask({
      title: 'Done',
      slug: 'done',
      status: 'done',
      areaIds: [aid],
      dueDate: '2026-01-10',
    });
    const focus = await entities.createTask({
      title: 'Focus',
      slug: 'focus',
      status: 'do-next',
      areaIds: [aid],
    });

    expect(overdue.ok && today.ok && soon.ok && done.ok && focus.ok).toBe(true);

    const asOf = new Date(2026, 0, 15);
    const surface = buildDailySurface({
      db,
      asOf,
      upcomingDays: 7,
      maxPerSection: 50,
    });

    expect(surface.date).toBe('2026-01-15');
    expect(surface.overdue.map((t) => t.slug)).toContain('past');
    expect(surface.dueToday.map((t) => t.slug)).toContain('today');
    expect(surface.upcoming.map((t) => t.slug)).toContain('soon');
    expect(surface.focus.map((t) => t.slug)).toContain('focus');
    expect(surface.overdue.some((t) => t.slug === 'done')).toBe(false);
  });
});

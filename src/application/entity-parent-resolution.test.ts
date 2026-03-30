import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, beforeEach } from 'vitest';
import { openAndMigrate } from '../infrastructure/db/open-database.js';
import { ensureCanonicalLayout } from '../infrastructure/workspace/create-layout.js';
import { EntityCrudService } from './entity-crud-service.js';
import { MarkdownWorkspaceRepository } from '../infrastructure/markdown/markdown-repository.js';
import {
  resolveEntityParent,
  resolveTaskParent,
  resolveNoteParent,
  resolveGoalParent,
} from './entity-parent-resolution.js';
import type { SecondBrainDb } from '../infrastructure/db/open-database.js';

describe('resolveEntityParent', () => {
  let db: SecondBrainDb;
  let root: string;
  let entities: EntityCrudService;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), 'sb-parent-res-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    db = openAndMigrate(dbPath);
    const repo = new MarkdownWorkspaceRepository(root);
    entities = new EntityCrudService(repo, db);
  });

  describe('Task resolution', () => {
    it('returns area when task links to project which links to area', async () => {
      const area = await entities.createArea({ title: 'Work', slug: 'work' });
      expect(area.ok).toBe(true);
      if (!area.ok) return;

      const project = await entities.createProject({
        title: 'My Project',
        slug: 'my-project',
        areaIds: [area.value.meta.id],
      });
      expect(project.ok).toBe(true);
      if (!project.ok) return;

      const task = await entities.createTask({
        title: 'My Task',
        slug: 'my-task',
        projectIds: [project.value.meta.id],
      });
      expect(task.ok).toBe(true);
      if (!task.ok) return;

      const result = resolveTaskParent(db, 'my-task');
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.parent).not.toBeNull();
      expect(result.value.parent?.type).toBe('area');
      expect(result.value.parent?.slug).toBe('work');
      expect(result.value.suggestedPath).toContain('010-areas');
      expect(result.value.suggestionReason).toContain('project');
      expect(result.value.suggestionReason).toContain('area');
    });

    it('returns area when task links to area but not project', async () => {
      const area = await entities.createArea({ title: 'Health', slug: 'health' });
      expect(area.ok).toBe(true);
      if (!area.ok) return;

      const task = await entities.createTask({
        title: 'My Task',
        slug: 'my-task',
        areaIds: [area.value.meta.id],
      });
      expect(task.ok).toBe(true);
      if (!task.ok) return;

      const result = resolveTaskParent(db, 'my-task');
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.parent).not.toBeNull();
      expect(result.value.parent?.type).toBe('area');
      expect(result.value.parent?.slug).toBe('health');
      expect(result.value.suggestedPath).toContain('010-areas');
      expect(result.value.suggestedPath).toContain('health');
    });

    it('returns null when task has no links', async () => {
      const task = await entities.createTask({
        title: 'Orphan Task',
        slug: 'orphan-task',
      });
      expect(task.ok).toBe(true);
      if (!task.ok) return;

      const result = resolveTaskParent(db, 'orphan-task');
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.parent).toBeNull();
      expect(result.value.suggestedPath).toContain('000-inbox');
      expect(result.value.suggestionReason).toContain('no linked project or area');
    });

    it('prioritizes project over area when both exist', async () => {
      const area1 = await entities.createArea({ title: 'Area 1', slug: 'area-1' });
      expect(area1.ok).toBe(true);
      if (!area1.ok) return;

      const area2 = await entities.createArea({ title: 'Area 2', slug: 'area-2' });
      expect(area2.ok).toBe(true);
      if (!area2.ok) return;

      const project = await entities.createProject({
        title: 'My Project',
        slug: 'my-project',
        areaIds: [area1.value.meta.id],
      });
      expect(project.ok).toBe(true);
      if (!project.ok) return;

      const task = await entities.createTask({
        title: 'Multi Task',
        slug: 'multi-task',
        projectIds: [project.value.meta.id],
        areaIds: [area2.value.meta.id],
      });
      expect(task.ok).toBe(true);
      if (!task.ok) return;

      const result = resolveTaskParent(db, 'multi-task');
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.parent).not.toBeNull();
      expect(result.value.parent?.type).toBe('area');
      expect(result.value.parent?.slug).toBe('area-1');
    });
  });

  describe('Note resolution', () => {
    it('follows same pattern as task', async () => {
      const note = await entities.createNote({
        title: 'My Note',
        slug: 'my-note',
      });
      expect(note.ok).toBe(true);
      if (!note.ok) return;

      const result = resolveNoteParent(db, 'my-note');
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.parent).toBeNull();
      expect(result.value.suggestionReason).toContain('no linked project or area');
    });
  });

  describe('Goal resolution', () => {
    it('returns area when goal links to area', async () => {
      const area = await entities.createArea({ title: 'Health', slug: 'health' });
      expect(area.ok).toBe(true);
      if (!area.ok) return;

      const goal = await entities.createGoal({
        title: 'My Goal',
        slug: 'my-goal',
        areaIds: [area.value.meta.id],
      });
      expect(goal.ok).toBe(true);
      if (!goal.ok) return;

      const result = resolveGoalParent(db, 'my-goal');
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.parent).not.toBeNull();
      expect(result.value.parent?.type).toBe('area');
      expect(result.value.parent?.slug).toBe('health');
      expect(result.value.suggestedPath).toContain('010-areas');
    });

    it('returns null when goal has no area', async () => {
      const area = await entities.createArea({ title: 'Temp', slug: 'temp' });
      expect(area.ok).toBe(true);
      if (!area.ok) return;

      const goalResult = await entities.createGoal({
        title: 'Orphan Goal',
        slug: 'orphan-goal',
        areaIds: [area.value.meta.id],
      });
      expect(goalResult.ok).toBe(true);
      if (!goalResult.ok) return;

      const result = resolveGoalParent(db, 'orphan-goal');
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.parent?.type).toBe('area');
    });
  });

  describe('Error cases', () => {
    it('returns error for non-existent task', () => {
      const result = resolveEntityParent(db, 'task', 'nonexistent');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('not found');
      }
    });

    it('returns error for non-existent note', () => {
      const result = resolveEntityParent(db, 'note', 'nonexistent');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('not found');
      }
    });

    it('returns error for non-existent goal', () => {
      const result = resolveEntityParent(db, 'goal', 'nonexistent');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain('not found');
      }
    });
  });

  describe('resolveEntityParent dispatcher', () => {
    it('dispatches to task resolver', async () => {
      const area = await entities.createArea({ title: 'Work', slug: 'work' });
      expect(area.ok).toBe(true);
      if (!area.ok) return;

      const task = await entities.createTask({
        title: 'My Task',
        slug: 'my-task',
        areaIds: [area.value.meta.id],
      });
      expect(task.ok).toBe(true);
      if (!task.ok) return;

      const result = resolveEntityParent(db, 'task', 'my-task');
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.entity.type).toBe('task');
      expect(result.value.entity.slug).toBe('my-task');
    });

    it('dispatches to note resolver', async () => {
      const note = await entities.createNote({
        title: 'My Note',
        slug: 'my-note',
      });
      expect(note.ok).toBe(true);
      if (!note.ok) return;

      const result = resolveEntityParent(db, 'note', 'my-note');
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.entity.type).toBe('note');
      expect(result.value.entity.slug).toBe('my-note');
    });

    it('dispatches to goal resolver', async () => {
      const area = await entities.createArea({ title: 'Work', slug: 'work' });
      expect(area.ok).toBe(true);
      if (!area.ok) return;

      const goal = await entities.createGoal({
        title: 'My Goal',
        slug: 'my-goal',
        areaIds: [area.value.meta.id],
      });
      expect(goal.ok).toBe(true);
      if (!goal.ok) return;

      const result = resolveEntityParent(db, 'goal', 'my-goal');
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.entity.type).toBe('goal');
      expect(result.value.entity.slug).toBe('my-goal');
    });
  });
});

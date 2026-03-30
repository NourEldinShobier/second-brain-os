import { describe, expect, it } from 'vitest';
import {
  DRIVE_AREAS_FOLDER,
  DRIVE_PROJECTS_FOLDER,
  DRIVE_RESOURCES_FOLDER,
  DRIVE_INBOX_FOLDER,
  driveItemOrganizedPath,
  isOrganizedPath,
  folderForPrimaryType,
} from './canonical-layout.js';

describe('canonical layout PARA folders', () => {
  describe('PARA folder constants', () => {
    it('DRIVE_AREAS_FOLDER equals 010-areas', () => {
      expect(DRIVE_AREAS_FOLDER).toBe('010-areas');
    });

    it('DRIVE_PROJECTS_FOLDER equals 020-projects', () => {
      expect(DRIVE_PROJECTS_FOLDER).toBe('020-projects');
    });

    it('DRIVE_RESOURCES_FOLDER equals 030-resources', () => {
      expect(DRIVE_RESOURCES_FOLDER).toBe('030-resources');
    });

    it('DRIVE_INBOX_FOLDER equals 000-inbox', () => {
      expect(DRIVE_INBOX_FOLDER).toBe('000-inbox');
    });
  });

  describe('driveItemOrganizedPath', () => {
    it('should return correct path for area', () => {
      const result = driveItemOrganizedPath('area', 'health', 'my-file');
      expect(result).toBe('07-drive/items/010-areas/health/my-file');
    });

    it('should return correct path for project', () => {
      const result = driveItemOrganizedPath('project', 'my-app', 'design');
      expect(result).toBe('07-drive/items/020-projects/my-app/design');
    });

    it('should return correct path for resource (no entity slug)', () => {
      const result = driveItemOrganizedPath('resource', null, 'doc');
      expect(result).toBe('07-drive/items/030-resources/doc');
    });

    it('should return correct path for inbox (no entity slug)', () => {
      const result = driveItemOrganizedPath('inbox', null, 'untitled');
      expect(result).toBe('07-drive/items/000-inbox/untitled');
    });
  });

  describe('isOrganizedPath', () => {
    it('should return true for organized paths', () => {
      expect(isOrganizedPath('07-drive/items/010-areas/health/file')).toBe(true);
      expect(isOrganizedPath('07-drive/items/020-projects/my-app/file')).toBe(true);
      expect(isOrganizedPath('07-drive/items/030-resources/doc')).toBe(true);
      expect(isOrganizedPath('07-drive/items/000-inbox/file')).toBe(true);
    });

    it('should return false for legacy flat paths', () => {
      expect(isOrganizedPath('07-drive/items/legacy-file/item.md')).toBe(false);
      expect(isOrganizedPath('07-drive/items/another-item')).toBe(false);
    });
  });

  describe('folderForPrimaryType', () => {
    it('should return correct folder for area', () => {
      expect(folderForPrimaryType('area')).toBe('010-areas');
    });

    it('should return correct folder for project', () => {
      expect(folderForPrimaryType('project')).toBe('020-projects');
    });

    it('should return 030-resources for resource', () => {
      expect(folderForPrimaryType('resource')).toBe('030-resources');
    });

    it('should return 000-inbox for inbox', () => {
      expect(folderForPrimaryType('inbox')).toBe('000-inbox');
    });

    it('should throw for task (requires resolution)', () => {
      expect(() => folderForPrimaryType('task')).toThrow('requires hierarchy resolution');
    });

    it('should throw for note (requires resolution)', () => {
      expect(() => folderForPrimaryType('note')).toThrow('requires hierarchy resolution');
    });

    it('should throw for goal (requires resolution)', () => {
      expect(() => folderForPrimaryType('goal')).toThrow('requires hierarchy resolution');
    });
  });
});

import { describe, expect, it } from 'vitest';
import { parseDriveItemPath, inferPrimaryFromPath } from './drive-path-resolution.js';

describe('drive-path-resolution', () => {
  describe('parseDriveItemPath', () => {
    it('should parse organized area path', () => {
      const result = parseDriveItemPath('07-drive/items/010-areas/health/my-file/item.md');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.primaryType).toBe('area');
        expect(result.value.entitySlug).toBe('health');
        expect(result.value.itemSlug).toBe('my-file');
      }
    });

    it('should parse organized project path', () => {
      const result = parseDriveItemPath('07-drive/items/020-projects/my-app/design/item.md');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.primaryType).toBe('project');
        expect(result.value.entitySlug).toBe('my-app');
        expect(result.value.itemSlug).toBe('design');
      }
    });

    it('should parse resource path', () => {
      const result = parseDriveItemPath('07-drive/items/030-resources/doc/item.md');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.primaryType).toBe('resource');
        expect(result.value.entitySlug).toBe(null);
        expect(result.value.itemSlug).toBe('doc');
      }
    });

    it('should parse inbox path', () => {
      const result = parseDriveItemPath('07-drive/items/000-inbox/untitled/item.md');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.primaryType).toBe('inbox');
        expect(result.value.entitySlug).toBe(null);
        expect(result.value.itemSlug).toBe('untitled');
      }
    });

    it('should reject invalid drive item path', () => {
      const result = parseDriveItemPath('07-drive/items/my-file/item.md');
      expect(result.ok).toBe(false);
    });

    it('should reject invalid area path', () => {
      const result = parseDriveItemPath('07-drive/items/010-areas/item.md');
      expect(result.ok).toBe(false);
    });

    it('should reject invalid project path', () => {
      const result = parseDriveItemPath('07-drive/items/020-projects/item.md');
      expect(result.ok).toBe(false);
    });
  });

  describe('inferPrimaryFromPath', () => {
    it('should infer inbox for legacy flat path', () => {
      const result = inferPrimaryFromPath('07-drive/items/legacy-file/item.md');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.primaryType).toBe('inbox');
        expect(result.value.entitySlug).toBe(null);
      }
    });

    it('should infer area from organized path', () => {
      const result = inferPrimaryFromPath('07-drive/items/010-areas/health/file/item.md');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.primaryType).toBe('area');
        expect(result.value.entitySlug).toBe('health');
      }
    });

    it('should infer project from organized path', () => {
      const result = inferPrimaryFromPath('07-drive/items/020-projects/my-app/file/item.md');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.primaryType).toBe('project');
        expect(result.value.entitySlug).toBe('my-app');
      }
    });

    it('should infer resource from organized path', () => {
      const result = inferPrimaryFromPath('07-drive/items/030-resources/doc/item.md');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.primaryType).toBe('resource');
        expect(result.value.entitySlug).toBe(null);
      }
    });

    it('should infer inbox from organized inbox path', () => {
      const result = inferPrimaryFromPath('07-drive/items/000-inbox/file/item.md');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.primaryType).toBe('inbox');
        expect(result.value.entitySlug).toBe(null);
      }
    });
  });
});

/**
 * Folder layout from PRD §9 (relative to workspace root).
 * Keep in sync with `second-brain-cli-prd.md`.
 */
import path from 'node:path';
import type { CoreEntityKind } from '../../domain/entity-kind.js';
import { ACTIVE_FOLDER_BY_KIND, ARCHIVE_FOLDER_BY_KIND } from '../../domain/markdown/folders.js';

export const CANONICAL_RELATIVE_DIRS: readonly string[] = [
  '.second-brain/migrations',
  '.second-brain/logs',
  '.second-brain/cache',
  '00-inbox',
  '01-areas',
  '02-goals',
  '03-projects',
  '04-tasks',
  '05-resources',
  '06-notes',
  '07-drive/items',
  '07-reviews/daily',
  '07-reviews/weekly',
  '99-archive/drive',
  '99-archive/inbox',
  '99-archive/areas',
  '99-archive/goals',
  '99-archive/projects',
  '99-archive/tasks',
  '99-archive/resources',
  '99-archive/notes',
];

/** Canonical Markdown document inside an entity package (PRD §6.1). */
export const ENTITY_INDEX_DOCUMENT = 'index.md' as const;

/** Vault drive: one package per imported file or folder (PRD §8.1). */
export const DRIVE_ITEMS_ROOT = '07-drive/items' as const;
export const DRIVE_ARCHIVE_ROOT = '99-archive/drive' as const;
export const DRIVE_ITEM_DOCUMENT = 'item.md' as const;
export const DRIVE_PAYLOAD_DIR = 'files' as const;

export function driveItemPackageDir(slug: string): string {
  return path.join(DRIVE_ITEMS_ROOT, slug).replace(/\\/g, '/');
}

export function driveItemDocumentPath(slug: string): string {
  return path.join(driveItemPackageDir(slug), DRIVE_ITEM_DOCUMENT).replace(/\\/g, '/');
}

export function archivedDriveItemPackageDir(slug: string): string {
  return path.join(DRIVE_ARCHIVE_ROOT, slug).replace(/\\/g, '/');
}

export function archivedDriveItemDocumentPath(slug: string): string {
  return path.join(archivedDriveItemPackageDir(slug), DRIVE_ITEM_DOCUMENT).replace(/\\/g, '/');
}

type ActiveEntityKind = CoreEntityKind;

/**
 * Folder segment under the kind root (e.g. `my-task` or `2026-01-02-my-capture` for dated inbox).
 */
export function entityPackageFolderSegment(kind: ActiveEntityKind, slug: string, inboxDate?: string): string {
  if (kind === 'inbox_item' && inboxDate !== undefined) {
    return `${inboxDate}-${slug}`;
  }
  if (kind === 'inbox_item') {
    return `inbox-${slug}`;
  }
  return slug;
}

/** Workspace-relative package directory for an active entity (no trailing slash). */
export function activeEntityPackageDir(kind: ActiveEntityKind, slug: string, inboxDate?: string): string {
  const root = ACTIVE_FOLDER_BY_KIND[kind];
  const seg = entityPackageFolderSegment(kind, slug, inboxDate);
  return path.join(root, seg).replace(/\\/g, '/');
}

/** Workspace-relative path to the canonical Markdown file for an active entity. */
export function activeEntityDocumentPath(kind: ActiveEntityKind, slug: string, inboxDate?: string): string {
  return path.join(activeEntityPackageDir(kind, slug, inboxDate), ENTITY_INDEX_DOCUMENT).replace(/\\/g, '/');
}

/** Workspace-relative package directory under an archive root. */
export function archivedEntityPackageDir(kind: ActiveEntityKind, slug: string): string {
  const root = ARCHIVE_FOLDER_BY_KIND[kind];
  return path.join(root, slug).replace(/\\/g, '/');
}

/** Workspace-relative path to the canonical Markdown file for an archived entity package. */
export function archivedEntityDocumentPath(kind: ActiveEntityKind, slug: string): string {
  return path.join(archivedEntityPackageDir(kind, slug), ENTITY_INDEX_DOCUMENT).replace(/\\/g, '/');
}

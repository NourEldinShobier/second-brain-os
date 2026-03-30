import { mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { eq } from 'drizzle-orm';
import type { Result } from '../domain/result.js';
import { err, ok } from '../domain/result.js';
import type { SecondBrainDb } from '../infrastructure/db/open-database.js';
import * as schema from '../infrastructure/db/schema.js';
import {
  DRIVE_ITEM_DOCUMENT,
  DRIVE_ITEMS_ROOT,
} from '../infrastructure/workspace/canonical-layout.js';
import {
  parseDriveItemDocument,
  serializeDriveItem,
} from '../infrastructure/markdown/parse-drive-item.js';
import {
  resolveDriveItemPath,
  parseDriveItemPath,
  type DriveItemPathResolution,
} from './drive-path-resolution.js';
import type { DriveItemMeta } from '../domain/drive/drive-item-meta.js';

export interface SetPrimaryOptions {
  primaryType: 'area' | 'project' | 'resource' | 'inbox';
  entityRef?: string;
}

export interface SetPrimaryResult {
  driveItem: typeof schema.driveItems.$inferSelect;
  oldPath: string;
  newPath: string;
  moved: boolean;
  dryRun: boolean;
}

export async function setDriveItemPrimary(
  workspaceRoot: string,
  db: SecondBrainDb,
  driveRef: string,
  options: SetPrimaryOptions,
  dryRun: boolean = false,
): Promise<Result<SetPrimaryResult, string>> {
  const { primaryType, entityRef } = options;

  const itemRow = findDriveItemByRefSync(db, driveRef);
  if (!itemRow) {
    return err(`Drive item not found: ${driveRef}`);
  }

  const resolution = resolveDriveItemPath(db, {
    itemSlug: itemRow.slug,
    primaryType,
    ...(entityRef !== undefined ? { entityRef } : {}),
  });

  if (!resolution.ok) {
    return err(resolution.error);
  }

  const resolved = resolution.value;

  if (resolved.fullPath === itemRow.file_path) {
    return ok({
      driveItem: itemRow,
      oldPath: itemRow.file_path,
      newPath: resolved.fullPath,
      moved: false,
      dryRun,
    });
  }

  if (dryRun) {
    return ok({
      driveItem: itemRow,
      oldPath: itemRow.file_path,
      newPath: resolved.fullPath,
      moved: true,
      dryRun: true,
    });
  }

  const moveResult = await moveDriveItemPackage(
    workspaceRoot,
    itemRow.file_path,
    resolved.fullPath,
  );
  if (!moveResult.ok) {
    return err(moveResult.error);
  }

  await updateItemMdFrontMatter(workspaceRoot, resolved.fullPath, resolved);

  updateDriveItemIndex(db, itemRow.id, resolved, resolved.fullPath);

  const updatedRow = db
    .select()
    .from(schema.driveItems)
    .where(eq(schema.driveItems.id, itemRow.id))
    .get();

  if (!updatedRow) {
    return err('Failed to fetch updated drive item');
  }

  return ok({
    driveItem: updatedRow,
    oldPath: itemRow.file_path,
    newPath: resolved.fullPath,
    moved: true,
    dryRun: false,
  });
}

function findDriveItemByRefSync(
  db: SecondBrainDb,
  ref: string,
): typeof schema.driveItems.$inferSelect | undefined {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
  const isUuid = UUID_RE.test(ref.trim());

  if (isUuid) {
    return db.select().from(schema.driveItems).where(eq(schema.driveItems.id, ref.trim())).get();
  }
  return db.select().from(schema.driveItems).where(eq(schema.driveItems.slug, ref.trim())).get();
}

async function moveDriveItemPackage(
  workspaceRoot: string,
  oldFilePath: string,
  newFullPath: string,
): Promise<Result<void, string>> {
  const oldAbs = join(workspaceRoot, oldFilePath);
  const newAbs = join(workspaceRoot, newFullPath);

  try {
    await stat(oldAbs);
  } catch {
    return err(`Source path does not exist: ${oldAbs}`);
  }

  const newDir = dirname(newAbs);
  try {
    await mkdir(newDir, { recursive: true });
  } catch {
    return err(`Failed to create directory: ${newDir}`);
  }

  try {
    await rename(oldAbs, newAbs);
  } catch (renameErr: unknown) {
    const errMessage = renameErr instanceof Error ? renameErr.message : String(renameErr);
    if (errMessage.includes('EXDEV') || errMessage.includes('cross-device')) {
      const copyResult = await copyDirectory(oldAbs, newAbs);
      if (!copyResult.ok) {
        return err(`Cross-device move failed: ${copyResult.error}`);
      }
      try {
        await rm(oldAbs, { recursive: true, force: true });
      } catch {
        return err(`Failed to remove source after cross-device move`);
      }
    } else {
      return err(`Failed to move: ${errMessage}`);
    }
  }

  return ok(undefined);
}

async function copyDirectory(src: string, dest: string): Promise<Result<void, string>> {
  try {
    await mkdir(dest, { recursive: true });
    const entries = await readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);
      if (entry.isDirectory()) {
        const subResult = await copyDirectory(srcPath, destPath);
        if (!subResult.ok) return subResult;
      } else {
        await rename(srcPath, destPath);
      }
    }
    return ok(undefined);
  } catch (copyErr: unknown) {
    const errMessage = copyErr instanceof Error ? copyErr.message : String(copyErr);
    return err(`Copy failed: ${errMessage}`);
  }
}

async function updateItemMdFrontMatter(
  workspaceRoot: string,
  itemPath: string,
  resolution: DriveItemPathResolution,
): Promise<Result<void, string>> {
  const itemDocPath = join(workspaceRoot, itemPath, DRIVE_ITEM_DOCUMENT);

  let raw: string;
  try {
    const { readFile } = await import('node:fs/promises');
    raw = await readFile(itemDocPath, 'utf-8');
  } catch {
    return err(`Failed to read item.md: ${itemDocPath}`);
  }

  const parsed = parseDriveItemDocument(raw);
  if (!parsed.ok) {
    return err(`Failed to parse item.md: ${parsed.error}`);
  }

  const updatedMeta: DriveItemMeta = {
    ...parsed.value.meta,
    primary_link: {
      entity_type: resolution.primaryType,
      entity_id: null,
      entity_slug: resolution.entitySlug,
    },
  };

  const updated = serializeDriveItem(updatedMeta, parsed.value.body);
  const { writeFile } = await import('node:fs/promises');
  await writeFile(itemDocPath, updated, 'utf-8');

  return ok(undefined);
}

function updateDriveItemIndex(
  db: SecondBrainDb,
  itemId: string,
  resolution: DriveItemPathResolution,
  newFilePath: string,
): void {
  db.update(schema.driveItems)
    .set({
      file_path: newFilePath,
      item_path: resolution.folderPath,
      primary_entity_type: resolution.primaryType,
      primary_entity_id: null,
      primary_entity_slug: resolution.entitySlug,
      updated_at: new Date().toISOString(),
    })
    .where(eq(schema.driveItems.id, itemId))
    .run();
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const MAX_SLUG_LENGTH = 120;

export function validateSlug(slug: string): Result<void, string> {
  if (!slug || slug.length === 0) {
    return err('Slug cannot be empty');
  }
  if (slug.length > MAX_SLUG_LENGTH) {
    return err(`Slug too long (max ${MAX_SLUG_LENGTH} characters)`);
  }
  if (!SLUG_RE.test(slug)) {
    return err('Slug must be kebab-case (lowercase letters, numbers, hyphens)');
  }
  return ok(undefined);
}

export interface MoveResult {
  driveItem: typeof schema.driveItems.$inferSelect;
  oldSlug: string;
  newSlug: string;
  oldPath: string;
  newPath: string;
  dryRun: boolean;
}

export async function moveDriveItem(
  workspaceRoot: string,
  db: SecondBrainDb,
  driveRef: string,
  newSlug: string,
  dryRun: boolean = false,
): Promise<Result<MoveResult, string>> {
  const validation = validateSlug(newSlug);
  if (!validation.ok) {
    return err(validation.error);
  }

  const itemRow = findDriveItemByRefSync(db, driveRef);
  if (!itemRow) {
    return err(`Drive item not found: ${driveRef}`);
  }

  if (itemRow.slug === newSlug) {
    return ok({
      driveItem: itemRow,
      oldSlug: itemRow.slug,
      newSlug,
      oldPath: itemRow.file_path,
      newPath: itemRow.file_path,
      dryRun,
    });
  }

  const existingBySlug = db
    .select()
    .from(schema.driveItems)
    .where(eq(schema.driveItems.slug, newSlug))
    .get();
  if (existingBySlug !== undefined) {
    return err(`Slug '${newSlug}' already exists`);
  }

  const parsedPath = parseDriveItemPath(itemRow.file_path);
  let basePath: string;
  if (parsedPath.ok) {
    basePath =
      parsedPath.value.primaryType === 'area' || parsedPath.value.primaryType === 'project'
        ? `${DRIVE_ITEMS_ROOT}/${parsedPath.value.primaryType === 'area' ? '010-areas' : '020-projects'}/${parsedPath.value.entitySlug}`
        : parsedPath.value.primaryType === 'resource'
          ? `${DRIVE_ITEMS_ROOT}/030-resources`
          : `${DRIVE_ITEMS_ROOT}/000-inbox`;
  } else {
    basePath = itemRow.file_path.replace(/\/[^/]+$/, '');
  }

  const newPath = `${basePath}/${newSlug}`;

  if (dryRun) {
    return ok({
      driveItem: itemRow,
      oldSlug: itemRow.slug,
      newSlug,
      oldPath: itemRow.file_path,
      newPath,
      dryRun: true,
    });
  }

  const moveResult = await moveDriveItemPackage(workspaceRoot, itemRow.file_path, newPath);
  if (!moveResult.ok) {
    return err(moveResult.error);
  }

  await updateSlugInItemMd(workspaceRoot, newPath, newSlug);

  db.update(schema.driveItems)
    .set({
      slug: newSlug,
      file_path: newPath,
      item_path: newPath,
      updated_at: new Date().toISOString(),
    })
    .where(eq(schema.driveItems.id, itemRow.id))
    .run();

  const updatedRow = db
    .select()
    .from(schema.driveItems)
    .where(eq(schema.driveItems.id, itemRow.id))
    .get();

  if (!updatedRow) {
    return err('Failed to fetch updated drive item');
  }

  return ok({
    driveItem: updatedRow,
    oldSlug: itemRow.slug,
    newSlug,
    oldPath: itemRow.file_path,
    newPath,
    dryRun: false,
  });
}

async function updateSlugInItemMd(
  workspaceRoot: string,
  itemPath: string,
  newSlug: string,
): Promise<Result<void, string>> {
  const itemDocPath = join(workspaceRoot, itemPath, DRIVE_ITEM_DOCUMENT);

  let raw: string;
  try {
    const { readFile } = await import('node:fs/promises');
    raw = await readFile(itemDocPath, 'utf-8');
  } catch {
    return err(`Failed to read item.md: ${itemDocPath}`);
  }

  const parsed = parseDriveItemDocument(raw);
  if (!parsed.ok) {
    return err(`Failed to parse item.md: ${parsed.error}`);
  }

  const updatedMeta: DriveItemMeta = {
    ...parsed.value.meta,
    slug: newSlug,
  };

  const updated = serializeDriveItem(updatedMeta, parsed.value.body);
  const { writeFile } = await import('node:fs/promises');
  await writeFile(itemDocPath, updated, 'utf-8');

  return ok(undefined);
}

export async function listDriveItemFiles(
  workspaceRoot: string,
  itemPath: string,
): Promise<Result<string[], string>> {
  const absPath = join(workspaceRoot, itemPath);
  try {
    const entries = await readdir(absPath, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const relPath = join(itemPath, entry.name).replace(/\\/g, '/');
      if (entry.isDirectory()) {
        const subResult = await listDriveItemFiles(workspaceRoot, relPath);
        if (subResult.ok) {
          files.push(...subResult.value);
        }
      } else {
        files.push(relPath);
      }
    }
    return ok(files);
  } catch (listErr: unknown) {
    const errMessage = listErr instanceof Error ? listErr.message : String(listErr);
    return err(`Failed to list files: ${errMessage}`);
  }
}

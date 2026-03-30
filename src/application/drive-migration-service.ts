import { mkdir, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import type { Result } from '../domain/result.js';
import { err, ok } from '../domain/result.js';
import type { SecondBrainDb } from '../infrastructure/db/open-database.js';
import * as schema from '../infrastructure/db/schema.js';
import { DRIVE_ITEMS_ROOT } from '../infrastructure/workspace/canonical-layout.js';
import {
  serializeDriveItem,
  parseDriveItemDocument,
} from '../infrastructure/markdown/parse-drive-item.js';
import type { DriveItemMeta } from '../domain/drive/drive-item-meta.js';
import { upsertDriveItem } from '../infrastructure/indexing/upsert-drive-item.js';

export type MigrationStrategy = 'inbox' | 'first-link';

export interface MigrationPlan {
  slug: string;
  oldPath: string;
  newPath: string;
  newFolderPath: string;
  primaryType: 'inbox' | 'area' | 'project' | 'resource';
  primaryEntitySlug: string | null;
  strategy: MigrationStrategy;
}

export interface MigrationResult {
  slug: string;
  oldPath: string;
  newPath: string;
  status: 'migrated' | 'skipped';
  reason?: string;
}

function isAlreadyMigrated(itemPath: string | null): boolean {
  if (itemPath === null || itemPath === '') {
    return false;
  }
  return (
    itemPath.startsWith('010-areas/') ||
    itemPath.startsWith('020-projects/') ||
    itemPath.startsWith('030-resources/') ||
    itemPath === '000-inbox' ||
    itemPath.startsWith('000-inbox/')
  );
}

function getItemSlugFromPath(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/');
  const itemMdIndex = parts.lastIndexOf('item.md');
  if (itemMdIndex > 0) {
    return parts[itemMdIndex - 1] ?? '';
  }
  const driveItemsIndex = parts.lastIndexOf('items');
  if (driveItemsIndex >= 0 && driveItemsIndex + 1 < parts.length) {
    return parts[driveItemsIndex + 1] ?? '';
  }
  return '';
}

export function planMigration(
  db: SecondBrainDb,
  strategy: MigrationStrategy,
  options?: { limit?: number },
): Result<MigrationPlan[], string> {
  const items = db.select().from(schema.driveItems).all();
  const plans: MigrationPlan[] = [];

  for (const item of items) {
    if (isAlreadyMigrated(item.item_path)) {
      continue;
    }

    const plan = planItemMigration(db, item, strategy);
    if (plan) {
      plans.push(plan);
    }

    if (options?.limit !== undefined && plans.length >= options.limit) {
      break;
    }
  }

  return ok(plans);
}

function planItemMigration(
  db: SecondBrainDb,
  item: typeof schema.driveItems.$inferSelect,
  strategy: MigrationStrategy,
): MigrationPlan | null {
  const slug = item.slug;
  const oldPath = item.file_path;

  if (strategy === 'inbox') {
    const newFolderPath = `${DRIVE_ITEMS_ROOT}/000-inbox/${slug}`;
    const newPath = `${newFolderPath}/item.md`;
    return {
      slug,
      oldPath,
      newPath,
      newFolderPath,
      primaryType: 'inbox',
      primaryEntitySlug: null,
      strategy: 'inbox',
    };
  }

  if (strategy === 'first-link') {
    const linkResult = getFirstEntityLink(db, item);
    if (linkResult) {
      const { type, entitySlug } = linkResult;
      const folderPrefix = type === 'area' ? '010-areas' : '020-projects';
      const newFolderPath = `${DRIVE_ITEMS_ROOT}/${folderPrefix}/${entitySlug}/${slug}`;
      const newPath = `${newFolderPath}/item.md`;
      return {
        slug,
        oldPath,
        newPath,
        newFolderPath,
        primaryType: type,
        primaryEntitySlug: entitySlug,
        strategy: 'first-link',
      };
    }

    const newFolderPath = `${DRIVE_ITEMS_ROOT}/000-inbox/${slug}`;
    const newPath = `${newFolderPath}/item.md`;
    return {
      slug,
      oldPath,
      newPath,
      newFolderPath,
      primaryType: 'inbox',
      primaryEntitySlug: null,
      strategy: 'first-link',
    };
  }

  return null;
}

function getFirstEntityLink(
  db: SecondBrainDb,
  item: typeof schema.driveItems.$inferSelect,
): { type: 'area' | 'project'; entitySlug: string } | null {
  const projectIds: string[] = item.project_ids_json ? JSON.parse(item.project_ids_json) : [];
  const areaIds: string[] = item.area_ids_json ? JSON.parse(item.area_ids_json) : [];

  if (projectIds.length > 0) {
    const project = db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectIds[0] ?? ''))
      .get();
    if (project) {
      return { type: 'project', entitySlug: project.slug };
    }
  }

  if (areaIds.length > 0) {
    const area = db
      .select()
      .from(schema.areas)
      .where(eq(schema.areas.id, areaIds[0] ?? ''))
      .get();
    if (area) {
      return { type: 'area', entitySlug: area.slug };
    }
  }

  return null;
}

export async function executeMigration(
  workspaceRoot: string,
  db: SecondBrainDb,
  plans: MigrationPlan[],
  options?: { dryRun?: boolean },
): Promise<Result<MigrationResult[], string>> {
  const root = path.resolve(workspaceRoot);
  const results: MigrationResult[] = [];

  for (const plan of plans) {
    const result = await executePlanMigration(root, db, plan, options?.dryRun === true);
    results.push(result);
  }

  return ok(results);
}

async function executePlanMigration(
  workspaceRoot: string,
  db: SecondBrainDb,
  plan: MigrationPlan,
  dryRun: boolean,
): Promise<MigrationResult> {
  const oldAbs = path.join(workspaceRoot, plan.oldPath);
  const newFolderAbs = path.join(workspaceRoot, plan.newFolderPath);

  try {
    await stat(oldAbs);
  } catch {
    return {
      slug: plan.slug,
      oldPath: plan.oldPath,
      newPath: plan.newPath,
      status: 'skipped',
      reason: 'Source file not found',
    };
  }

  if (dryRun) {
    return {
      slug: plan.slug,
      oldPath: plan.oldPath,
      newPath: plan.newPath,
      status: 'migrated',
    };
  }

  try {
    const oldFolderAbs = path.dirname(oldAbs);
    await mkdir(newFolderAbs, { recursive: true });

    const oldFilesAbs = path.join(oldFolderAbs, 'files');
    const newFilesAbs = path.join(newFolderAbs, 'files');

    const oldItemMd = oldAbs;
    const newItemMd = path.join(newFolderAbs, 'item.md');

    const { readFile } = await import('node:fs/promises');
    const raw = await readFile(oldItemMd, 'utf8');
    const parsed = parseDriveItemDocument(raw);
    if (!parsed.ok) {
      return {
        slug: plan.slug,
        oldPath: plan.oldPath,
        newPath: plan.newPath,
        status: 'skipped',
        reason: `Failed to parse item.md: ${parsed.error}`,
      };
    }

    const meta: DriveItemMeta = {
      ...parsed.value.meta,
      primary_link:
        plan.primaryType !== 'inbox'
          ? {
              entity_type: plan.primaryType,
              entity_id: null,
              entity_slug: plan.primaryEntitySlug,
            }
          : undefined,
      item_path:
        plan.primaryType === 'inbox'
          ? '000-inbox'
          : plan.primaryType === 'area'
            ? `010-areas/${plan.primaryEntitySlug}`
            : plan.primaryType === 'project'
              ? `020-projects/${plan.primaryEntitySlug}`
              : '030-resources',
    };

    const newBody = parsed.value.body;
    await import('node:fs/promises').then((fs) =>
      fs.writeFile(newItemMd, serializeDriveItem(meta, newBody), 'utf8'),
    );

    try {
      await rename(oldFilesAbs, newFilesAbs);
    } catch {
      // Files directory might not exist for file items (vs folder items)
    }

    const st = await stat(newItemMd);
    upsertDriveItem(db, meta, plan.newPath, st.birthtime.toISOString(), st.mtime.toISOString());

    try {
      const { rm } = await import('node:fs/promises');
      await rm(path.dirname(oldAbs), { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    return {
      slug: plan.slug,
      oldPath: plan.oldPath,
      newPath: plan.newPath,
      status: 'migrated',
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      slug: plan.slug,
      oldPath: plan.oldPath,
      newPath: plan.newPath,
      status: 'skipped',
      reason: message,
    };
  }
}

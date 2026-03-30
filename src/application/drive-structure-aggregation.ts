import type { SecondBrainDb } from '../infrastructure/db/open-database.js';
import * as schema from '../infrastructure/db/schema.js';
import {
  DRIVE_AREAS_FOLDER,
  DRIVE_PROJECTS_FOLDER,
  DRIVE_RESOURCES_FOLDER,
  DRIVE_INBOX_FOLDER,
  DRIVE_ITEMS_ROOT,
  isOrganizedPath,
} from '../infrastructure/workspace/canonical-layout.js';

export interface FolderChild {
  path: string;
  entity_type: 'area' | 'project' | 'resource' | 'inbox';
  entity_slug: string | null;
  entity_title: string | null;
  drive_item_count: number;
}

export interface FolderInfo {
  path: string;
  name: string;
  prefix: string;
  children: FolderChild[];
  total_items: number;
}

export interface DriveStructure {
  root: string;
  folders: FolderInfo[];
  total_drive_items: number;
  unsorted_count: number;
  legacy_count: number;
}

function createEmptyFolder(path: string, name: string, prefix: string): FolderInfo {
  return {
    path,
    name,
    prefix,
    children: [],
    total_items: 0,
  };
}

function buildEntityTitleMap(
  db: SecondBrainDb,
): Map<string, { title: string; type: 'area' | 'project' }> {
  const titleMap = new Map<string, { title: string; type: 'area' | 'project' }>();
  const areas = db.select().from(schema.areas).all();
  for (const area of areas) {
    titleMap.set(`area:${area.slug}`, { title: area.title, type: 'area' });
  }
  const projects = db.select().from(schema.projects).all();
  for (const project of projects) {
    titleMap.set(`project:${project.slug}`, { title: project.title, type: 'project' });
  }
  return titleMap;
}

function parseItemPath(
  itemPath: string | null,
  filePath: string,
): {
  primaryType: 'area' | 'project' | 'resource' | 'inbox';
  entitySlug: string | null;
} | null {
  if (itemPath !== null) {
    if (itemPath === DRIVE_INBOX_FOLDER) {
      return { primaryType: 'inbox', entitySlug: null };
    }
    if (itemPath === DRIVE_RESOURCES_FOLDER) {
      return { primaryType: 'resource', entitySlug: null };
    }
    if (itemPath.startsWith(`${DRIVE_AREAS_FOLDER}/`)) {
      const entitySlug = itemPath.slice(`${DRIVE_AREAS_FOLDER}/`.length);
      return { primaryType: 'area', entitySlug };
    }
    if (itemPath.startsWith(`${DRIVE_PROJECTS_FOLDER}/`)) {
      const entitySlug = itemPath.slice(`${DRIVE_PROJECTS_FOLDER}/`.length);
      return { primaryType: 'project', entitySlug };
    }
  }
  if (isOrganizedPath(filePath)) {
    if (filePath.includes(`/${DRIVE_AREAS_FOLDER}/`)) {
      const match = filePath.match(/\/010-areas\/([^/]+)/);
      if (match && match[1]) {
        return { primaryType: 'area', entitySlug: match[1] };
      }
    }
    if (filePath.includes(`/${DRIVE_PROJECTS_FOLDER}/`)) {
      const match = filePath.match(/\/020-projects\/([^/]+)/);
      if (match && match[1]) {
        return { primaryType: 'project', entitySlug: match[1] };
      }
    }
    if (filePath.includes(`/${DRIVE_RESOURCES_FOLDER}/`)) {
      return { primaryType: 'resource', entitySlug: null };
    }
    if (filePath.includes(`/${DRIVE_INBOX_FOLDER}/`)) {
      return { primaryType: 'inbox', entitySlug: null };
    }
  }
  return null;
}

export function aggregateDriveStructure(db: SecondBrainDb): DriveStructure {
  const items = db.select().from(schema.driveItems).all();
  const entityTitles = buildEntityTitleMap(db);
  const areasFolder = createEmptyFolder(DRIVE_AREAS_FOLDER, 'areas', '010');
  const projectsFolder = createEmptyFolder(DRIVE_PROJECTS_FOLDER, 'projects', '020');
  const resourcesFolder = createEmptyFolder(DRIVE_RESOURCES_FOLDER, 'resources', '030');
  const inboxFolder = createEmptyFolder(DRIVE_INBOX_FOLDER, 'inbox', '000');
  const folderByPath = new Map<string, FolderInfo>();
  folderByPath.set(DRIVE_AREAS_FOLDER, areasFolder);
  folderByPath.set(DRIVE_PROJECTS_FOLDER, projectsFolder);
  folderByPath.set(DRIVE_RESOURCES_FOLDER, resourcesFolder);
  folderByPath.set(DRIVE_INBOX_FOLDER, inboxFolder);
  const childCounts = new Map<string, number>();
  let legacyCount = 0;
  for (const item of items) {
    const parsed = parseItemPath(item.item_path, item.file_path);
    if (!parsed) {
      legacyCount++;
      continue;
    }
    const primaryType = parsed.primaryType;
    const entitySlug = parsed.entitySlug;
    const folderName =
      primaryType === 'area'
        ? DRIVE_AREAS_FOLDER
        : primaryType === 'project'
          ? DRIVE_PROJECTS_FOLDER
          : primaryType === 'resource'
            ? DRIVE_RESOURCES_FOLDER
            : DRIVE_INBOX_FOLDER;
    if (primaryType === 'area' || primaryType === 'project') {
      const childKey = `${primaryType}:${entitySlug}`;
      if (!childCounts.has(childKey)) {
        childCounts.set(childKey, 0);
      }
      childCounts.set(childKey, (childCounts.get(childKey) ?? 0) + 1);
    }
    const folder = folderByPath.get(folderName);
    if (folder) {
      folder.total_items++;
    }
  }
  for (const [key, count] of childCounts) {
    const [type, slug] = key.split(':') as ['area' | 'project', string];
    const info = entityTitles.get(key);
    const child: FolderChild = {
      path: `${type === 'area' ? DRIVE_AREAS_FOLDER : DRIVE_PROJECTS_FOLDER}/${slug}`,
      entity_type: type,
      entity_slug: slug,
      entity_title: info?.title ?? null,
      drive_item_count: count,
    };
    if (type === 'area') {
      areasFolder.children.push(child);
    } else {
      projectsFolder.children.push(child);
    }
  }
  areasFolder.children.sort((a, b) => (a.entity_slug ?? '').localeCompare(b.entity_slug ?? ''));
  projectsFolder.children.sort((a, b) => (a.entity_slug ?? '').localeCompare(b.entity_slug ?? ''));
  const folders: FolderInfo[] = [areasFolder, projectsFolder, resourcesFolder, inboxFolder];
  const unsortedCount = inboxFolder.total_items + legacyCount;
  return {
    root: DRIVE_ITEMS_ROOT,
    folders,
    total_drive_items: items.length,
    unsorted_count: unsortedCount,
    legacy_count: legacyCount,
  };
}

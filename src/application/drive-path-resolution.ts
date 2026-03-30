import { eq } from 'drizzle-orm';
import type { Result } from '../domain/result.js';
import { err, ok } from '../domain/result.js';
import type { SecondBrainDb } from '../infrastructure/db/open-database.js';
import * as schema from '../infrastructure/db/schema.js';
import {
  DRIVE_ITEMS_ROOT,
  type PrimaryEntityType,
  isOrganizedPath,
} from '../infrastructure/workspace/canonical-layout.js';

export interface DriveItemPathResolution {
  itemSlug: string;
  primaryType: PrimaryEntityType;
  entitySlug: string | null;
  folderPath: string;
  fullPath: string;
  documentPath: string;
}

function getAreaSlug(db: SecondBrainDb, areaId: string): string | null {
  const row = db.select().from(schema.areas).where(eq(schema.areas.id, areaId)).get();
  return row?.slug ?? null;
}

function getProjectSlug(db: SecondBrainDb, projectId: string): string | null {
  const row = db.select().from(schema.projects).where(eq(schema.projects.id, projectId)).get();
  return row?.slug ?? null;
}

export function resolveDriveItemPath(
  db: SecondBrainDb,
  options: {
    itemSlug: string;
    primaryType: PrimaryEntityType;
    entityRef?: string;
  },
): Result<DriveItemPathResolution, string> {
  const { itemSlug, primaryType, entityRef } = options;

  switch (primaryType) {
    case 'area': {
      if (!entityRef) {
        return err('area requires entity reference');
      }
      const areaResult = resolveAreaId(db, entityRef);
      if (!areaResult.ok) {
        return areaResult;
      }
      const areaSlug = getAreaSlug(db, areaResult.value);
      if (!areaSlug) {
        return err(`Area not found: ${entityRef}`);
      }
      const folderPath = `010-areas/${areaSlug}`;
      const fullPath = `${DRIVE_ITEMS_ROOT}/${folderPath}/${itemSlug}`;
      return ok({
        itemSlug,
        primaryType: 'area',
        entitySlug: areaSlug,
        folderPath,
        fullPath,
        documentPath: `${fullPath}/item.md`,
      });
    }

    case 'project': {
      if (!entityRef) {
        return err('project requires entity reference');
      }
      const projectResult = resolveProjectId(db, entityRef);
      if (!projectResult.ok) {
        return projectResult;
      }
      const projectSlug = getProjectSlug(db, projectResult.value);
      if (!projectSlug) {
        return err(`Project not found: ${entityRef}`);
      }
      const folderPath = `020-projects/${projectSlug}`;
      const fullPath = `${DRIVE_ITEMS_ROOT}/${folderPath}/${itemSlug}`;
      return ok({
        itemSlug,
        primaryType: 'project',
        entitySlug: projectSlug,
        folderPath,
        fullPath,
        documentPath: `${fullPath}/item.md`,
      });
    }

    case 'resource': {
      const folderPath = '030-resources';
      const fullPath = `${DRIVE_ITEMS_ROOT}/${folderPath}/${itemSlug}`;
      return ok({
        itemSlug,
        primaryType: 'resource',
        entitySlug: null,
        folderPath,
        fullPath,
        documentPath: `${fullPath}/item.md`,
      });
    }

    case 'inbox': {
      const folderPath = '000-inbox';
      const fullPath = `${DRIVE_ITEMS_ROOT}/${folderPath}/${itemSlug}`;
      return ok({
        itemSlug,
        primaryType: 'inbox',
        entitySlug: null,
        folderPath,
        fullPath,
        documentPath: `${fullPath}/item.md`,
      });
    }

    case 'task':
    case 'note':
    case 'goal':
      return err(`${primaryType} requires hierarchy resolution - use resolveParent first`);

    default: {
      const _exhaustive: never = primaryType;
      return err(`Invalid primary type: ${_exhaustive}`);
    }
  }
}

export interface ParsedDriveItemPath {
  primaryType: 'area' | 'project' | 'resource' | 'inbox';
  entitySlug: string | null;
  itemSlug: string;
}

export function parseDriveItemPath(filePath: string): Result<ParsedDriveItemPath, string> {
  if (!filePath.startsWith(`${DRIVE_ITEMS_ROOT}/`)) {
    return err(`Invalid drive item path: ${filePath}`);
  }

  const relative = filePath.slice(DRIVE_ITEMS_ROOT.length + 1);

  if (relative.startsWith('010-areas/')) {
    const rest = relative.slice('010-areas/'.length);
    const parts = rest.split('/');
    const entitySlug = parts[0];
    if (!entitySlug || parts.length < 2) {
      return err(`Invalid area path: ${filePath}`);
    }
    const itemSlug = parts
      .slice(1)
      .join('/')
      .replace(/\/item\.md$/, '');
    return ok({ primaryType: 'area', entitySlug, itemSlug });
  }

  if (relative.startsWith('020-projects/')) {
    const rest = relative.slice('020-projects/'.length);
    const parts = rest.split('/');
    const entitySlug = parts[0];
    if (!entitySlug || parts.length < 2) {
      return err(`Invalid project path: ${filePath}`);
    }
    const itemSlug = parts
      .slice(1)
      .join('/')
      .replace(/\/item\.md$/, '');
    return ok({ primaryType: 'project', entitySlug, itemSlug });
  }

  if (relative.startsWith('030-resources/')) {
    const rest = relative.slice('030-resources/'.length);
    const itemSlug = rest.replace(/\/item\.md$/, '');
    return ok({ primaryType: 'resource', entitySlug: null, itemSlug });
  }

  if (relative.startsWith('000-inbox/')) {
    const rest = relative.slice('000-inbox/'.length);
    const itemSlug = rest.replace(/\/item\.md$/, '');
    return ok({ primaryType: 'inbox', entitySlug: null, itemSlug });
  }

  return err(`Path is not organized: ${filePath}`);
}

export interface InferredPrimary {
  primaryType: PrimaryEntityType;
  entitySlug: string | null;
}

export function inferPrimaryFromPath(filePath: string): Result<InferredPrimary, string> {
  if (isOrganizedPath(filePath)) {
    return parseDriveItemPath(filePath);
  }

  return ok({ primaryType: 'inbox', entitySlug: null });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function isUuid(s: string): boolean {
  return UUID_RE.test(s.trim());
}

function resolveAreaId(db: SecondBrainDb, ref: string): Result<string, string> {
  const r = ref.trim();
  if (r.length === 0) {
    return err('Empty area reference');
  }
  if (isUuid(r)) {
    const row = db.select().from(schema.areas).where(eq(schema.areas.id, r)).get();
    if (row === undefined) {
      return err(`Unknown area id: ${r}`);
    }
    return ok(r);
  }
  const row = db.select().from(schema.areas).where(eq(schema.areas.slug, r)).get();
  if (row === undefined) {
    return err(`Unknown area slug: ${r}`);
  }
  return ok(row.id);
}

function resolveProjectId(db: SecondBrainDb, ref: string): Result<string, string> {
  const r = ref.trim();
  if (r.length === 0) {
    return err('Empty project reference');
  }
  if (isUuid(r)) {
    const row = db.select().from(schema.projects).where(eq(schema.projects.id, r)).get();
    if (row === undefined) {
      return err(`Unknown project id: ${r}`);
    }
    return ok(r);
  }
  const row = db.select().from(schema.projects).where(eq(schema.projects.slug, r)).get();
  if (row === undefined) {
    return err(`Unknown project slug: ${r}`);
  }
  return ok(row.id);
}

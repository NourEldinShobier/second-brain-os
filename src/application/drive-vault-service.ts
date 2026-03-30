import { createHash, randomUUID } from 'node:crypto';
import {
  access,
  cp,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import type { DriveItemMeta } from '../domain/drive/drive-item-meta.js';
import { isValidSlug, slugifyTitle } from '../domain/markdown/slug.js';
import type { Result } from '../domain/result.js';
import { err, ok } from '../domain/result.js';
import type { SecondBrainDb } from '../infrastructure/db/open-database.js';
import * as schema from '../infrastructure/db/schema.js';
import {
  driveItemDocumentPath,
  driveItemPackageDir,
  DRIVE_PAYLOAD_DIR,
} from '../infrastructure/workspace/canonical-layout.js';
import {
  type DriveLinkableKind,
  resolveDriveLinkTargetRef,
} from '../infrastructure/relationships/resolve-entity-ref.js';
import {
  parseDriveItemDocument,
  serializeDriveItem,
} from '../infrastructure/markdown/parse-drive-item.js';
import { upsertDriveItem } from '../infrastructure/indexing/upsert-drive-item.js';
import { resolveDriveItemPath } from './drive-path-resolution.js';

function guessMime(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.json': 'application/json',
    '.zip': 'application/zip',
  };
  return map[ext] ?? 'application/octet-stream';
}

async function sha256File(abs: string): Promise<string> {
  const buf = await readFile(abs);
  return createHash('sha256').update(buf).digest('hex');
}

async function countFilesRecursive(dir: string): Promise<number> {
  const entries = await readdir(dir, { withFileTypes: true });
  let n = 0;
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      n += await countFilesRecursive(p);
    } else if (e.isFile()) {
      n += 1;
    }
  }
  return n;
}

async function packageDirExists(workspaceRoot: string, slug: string): Promise<boolean> {
  const p = path.join(workspaceRoot, driveItemPackageDir(slug));
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function allocateDriveSlug(workspaceRoot: string, base: string): Promise<string> {
  let s = base;
  let n = 1;
  while (await packageDirExists(workspaceRoot, s)) {
    n += 1;
    s = `${base}-${String(n)}`;
  }
  return s;
}

function nowIso(): string {
  return new Date().toISOString();
}

export type PrimaryTarget =
  | { type: 'area'; ref: string }
  | { type: 'project'; ref: string }
  | { type: 'resource' }
  | { type: 'inbox' };

export async function importDrivePayload(
  workspaceRoot: string,
  db: SecondBrainDb,
  sourcePath: string,
  options?: {
    readonly title?: string;
    readonly description?: string;
    readonly move?: boolean;
    readonly dryRun?: boolean;
    readonly tags?: readonly string[];
    readonly primary?: PrimaryTarget;
  },
): Promise<
  Result<{ readonly slug: string; readonly relPath: string; readonly meta: DriveItemMeta }, string>
> {
  const root = path.resolve(workspaceRoot);
  const absSource = path.resolve(sourcePath);
  let st;
  try {
    st = await stat(absSource);
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
  const isDir = st.isDirectory();
  const baseTitle =
    options?.title?.trim() ??
    (isDir ? path.basename(absSource) : path.basename(absSource, path.extname(absSource)));
  let slug = slugifyTitle(baseTitle);
  if (!isValidSlug(slug)) {
    slug = slugifyTitle('import') + '-' + randomUUID().slice(0, 8);
  }
  slug = await allocateDriveSlug(root, slug);

  const id = randomUUID();
  const importedAt = nowIso();
  const originalName = path.basename(absSource);

  let resolvedPrimaryType: 'area' | 'project' | 'resource' | 'inbox' = 'inbox';
  let entitySlug: string | null = null;

  if (options?.primary) {
    const primary = options.primary;
    if (primary.type === 'area' || primary.type === 'project') {
      const resolution = resolveDriveItemPath(db, {
        itemSlug: slug,
        primaryType: primary.type,
        entityRef: primary.ref,
      });
      if (!resolution.ok) {
        return err(resolution.error);
      }
      resolvedPrimaryType = primary.type;
      entitySlug = resolution.value.entitySlug;
    } else {
      resolvedPrimaryType = primary.type;
    }
  }

  const primaryMeta =
    resolvedPrimaryType !== 'inbox'
      ? {
          primary_link: {
            entity_type: resolvedPrimaryType,
            entity_id: null,
            entity_slug: entitySlug,
          },
        }
      : {};

  const itemPathSegment =
    resolvedPrimaryType === 'inbox' || resolvedPrimaryType === 'resource'
      ? resolvedPrimaryType === 'inbox'
        ? `000-inbox/${slug}`
        : `030-resources/${slug}`
      : resolvedPrimaryType === 'area'
        ? `010-areas/${entitySlug}/${slug}`
        : `020-projects/${entitySlug}/${slug}`;

  const itemPathValue =
    resolvedPrimaryType === 'inbox' || resolvedPrimaryType === 'resource'
      ? resolvedPrimaryType === 'inbox'
        ? '000-inbox'
        : '030-resources'
      : resolvedPrimaryType === 'area'
        ? `010-areas/${entitySlug}`
        : `020-projects/${entitySlug}`;

  if (options?.dryRun === true) {
    const meta: DriveItemMeta = {
      id,
      version: 1,
      slug,
      title: baseTitle || slug,
      item_type: isDir ? 'folder' : 'file',
      original_name: originalName,
      source_path: absSource,
      imported_at: importedAt,
      ...(options.tags !== undefined && options.tags.length > 0 ? { tags: [...options.tags] } : {}),
      ...primaryMeta,
      item_path: itemPathValue,
    };
    return ok({ slug, relPath: driveItemDocumentPath(slug), meta });
  }

  const pkgDir = path.join(root, '07-drive/items', itemPathSegment);
  const filesDir = path.join(pkgDir, DRIVE_PAYLOAD_DIR);
  await mkdir(filesDir, { recursive: true });

  if (isDir) {
    const entries = await readdir(absSource, { withFileTypes: true });
    for (const e of entries) {
      await cp(path.join(absSource, e.name), path.join(filesDir, e.name), {
        recursive: true,
        force: true,
      });
    }
  } else {
    const dest = path.join(filesDir, originalName);
    await cp(absSource, dest, { force: true });
  }

  let childCount: number | undefined;
  let mime: string | null = null;
  let sha: string | null = null;
  if (isDir) {
    childCount = await countFilesRecursive(filesDir);
  } else {
    const dest = path.join(filesDir, originalName);
    sha = await sha256File(dest);
    mime = guessMime(originalName);
  }

  if (options?.move === true) {
    await rm(absSource, { recursive: true, force: true });
  }

  const meta: DriveItemMeta = {
    id,
    version: 1,
    slug,
    title: baseTitle.length > 0 ? baseTitle : slug,
    description: options?.description ?? null,
    item_type: isDir ? 'folder' : 'file',
    original_name: originalName,
    source_path: absSource,
    imported_at: importedAt,
    mime_type: mime,
    sha256: sha,
    ...(isDir ? { child_count: childCount ?? 0 } : {}),
    ...(options?.tags !== undefined && options.tags.length > 0 ? { tags: [...options.tags] } : {}),
    ...primaryMeta,
    item_path: itemPathValue,
  };

  const relPath = driveItemDocumentPath(slug).replace(
    /^07-drive\/items\/[^/]+/,
    `07-drive/items/${itemPathSegment}`,
  );
  const body = options?.description !== undefined ? options.description : '';
  const absDoc = path.join(root, relPath);
  await mkdir(path.dirname(absDoc), { recursive: true });
  await writeFile(absDoc, serializeDriveItem(meta, body), 'utf8');

  const stDoc = await stat(absDoc);
  upsertDriveItem(db, meta, relPath, stDoc.birthtime.toISOString(), stDoc.mtime.toISOString());

  return ok({ slug, relPath, meta });
}

export interface DriveListFilters {
  readonly areaIds?: string[] | undefined;
  readonly projectIds?: string[] | undefined;
  readonly taskIds?: string[] | undefined;
  readonly noteIds?: string[] | undefined;
  readonly goalIds?: string[] | undefined;
  readonly tags?: string[] | undefined;
  /** Standalone (no links). If false, returns all regardless of link state. */
  readonly standalone?: boolean | undefined;
  /** Show only items in inbox (no primary link). */
  readonly inbox?: boolean | undefined;
  /** Filter by primary entity type. Use 'null' for items with no primary. */
  readonly primaryType?: 'area' | 'project' | 'resource' | 'inbox' | 'null' | undefined;
  /** Filter by primary entity id (requires primaryType). */
  readonly primaryEntityId?: string | undefined;
  /** Filter by primary entity slug (alternative to primaryEntityId). */
  readonly primaryEntitySlug?: string | undefined;
}

function jsonArrayHasAny(json: string | null, ids: readonly string[]): boolean {
  if (!json || ids.length === 0) return false;
  try {
    const arr = JSON.parse(json) as string[];
    return ids.some((id) => arr.includes(id));
  } catch {
    return false;
  }
}

function jsonArrayHasAllTags(json: string | null, tags: readonly string[]): boolean {
  if (!json || tags.length === 0) return false;
  try {
    const arr = JSON.parse(json) as string[];
    return tags.every((t) => arr.includes(t));
  } catch {
    return false;
  }
}

function hasNoLinks(row: typeof schema.driveItems.$inferSelect): boolean {
  return (
    (row.area_ids_json ?? '').length === 0 &&
    (row.project_ids_json ?? '').length === 0 &&
    (row.task_ids_json ?? '').length === 0 &&
    (row.note_ids_json ?? '').length === 0 &&
    (row.goal_ids_json ?? '').length === 0
  );
}

export function listDriveItems(
  db: SecondBrainDb,
  filters: DriveListFilters,
): (typeof schema.driveItems.$inferSelect)[] {
  let rows: (typeof schema.driveItems.$inferSelect)[] = db.select().from(schema.driveItems).all();

  if (
    filters.areaIds === undefined &&
    filters.projectIds === undefined &&
    filters.taskIds === undefined &&
    filters.noteIds === undefined &&
    filters.goalIds === undefined &&
    (filters.tags === undefined || filters.tags.length === 0) &&
    filters.standalone === undefined &&
    filters.inbox === undefined &&
    filters.primaryType === undefined
  ) {
    return rows;
  }

  return rows.filter((row) => {
    if (filters.areaIds !== undefined && filters.areaIds.length > 0) {
      if (!jsonArrayHasAny(row.area_ids_json, filters.areaIds)) return false;
    }
    if (filters.projectIds !== undefined && filters.projectIds.length > 0) {
      if (!jsonArrayHasAny(row.project_ids_json, filters.projectIds)) return false;
    }
    if (filters.taskIds !== undefined && filters.taskIds.length > 0) {
      if (!jsonArrayHasAny(row.task_ids_json, filters.taskIds)) return false;
    }
    if (filters.noteIds !== undefined && filters.noteIds.length > 0) {
      if (!jsonArrayHasAny(row.note_ids_json, filters.noteIds)) return false;
    }
    if (filters.goalIds !== undefined && filters.goalIds.length > 0) {
      if (!jsonArrayHasAny(row.goal_ids_json, filters.goalIds)) return false;
    }
    if (filters.tags !== undefined && filters.tags.length > 0) {
      if (!jsonArrayHasAllTags(row.tags_json, filters.tags)) return false;
    }
    if (filters.standalone === true) {
      if (!hasNoLinks(row)) return false;
    }
    if (filters.standalone === false) {
      if (hasNoLinks(row)) return false;
    }
    if (filters.inbox === true) {
      if (row.primary_entity_type !== null && row.primary_entity_type !== 'inbox') {
        return false;
      }
    }
    if (filters.primaryType === 'null') {
      if (row.primary_entity_type !== null) return false;
    }
    if (
      filters.primaryType !== undefined &&
      filters.primaryType !== 'null' &&
      filters.primaryType !== 'inbox'
    ) {
      if (row.primary_entity_type !== filters.primaryType) return false;
      if (filters.primaryEntityId !== undefined || filters.primaryEntitySlug !== undefined) {
        const idMatch = row.primary_entity_id === filters.primaryEntityId;
        const slugMatch = row.primary_entity_slug === filters.primaryEntitySlug;
        if (!idMatch && !slugMatch) return false;
      }
    }
    return true;
  });
}

export function findDriveItemByRef(
  db: SecondBrainDb,
  ref: string,
): Result<typeof schema.driveItems.$inferSelect, string> {
  const r = ref.trim();
  if (r.length === 0) {
    return err('Empty reference');
  }
  const byId = db.select().from(schema.driveItems).where(eq(schema.driveItems.id, r)).get();
  if (byId !== undefined) {
    return ok(byId);
  }
  const bySlug = db.select().from(schema.driveItems).where(eq(schema.driveItems.slug, r)).get();
  if (bySlug !== undefined) {
    return ok(bySlug);
  }
  return err(`Drive item not found: ${r}`);
}

export async function loadDriveItemBody(
  workspaceRoot: string,
  filePath: string,
): Promise<Result<string, string>> {
  const abs = path.join(workspaceRoot, filePath);
  try {
    const raw = await readFile(abs, 'utf8');
    const p = parseDriveItemDocument(raw);
    if (!p.ok) {
      return err(p.error);
    }
    return ok(p.value.body);
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

/** Comma-separated kinds for `drive link --clear` (e.g. `area,project`). */
export function parseDriveLinkClearKinds(
  raw: string | undefined,
): Result<readonly DriveLinkableKind[], string> {
  if (raw === undefined || raw.trim() === '') {
    return ok([]);
  }
  const kinds: DriveLinkableKind[] = [];
  const allowed = new Set<string>(['area', 'project', 'task', 'note', 'goal']);
  for (const part of raw.split(',')) {
    const t = part.trim().toLowerCase();
    if (t.length === 0) {
      continue;
    }
    if (!allowed.has(t)) {
      return err(`Unknown link kind in --clear: ${t} (use area, project, task, note, goal)`);
    }
    kinds.push(t as DriveLinkableKind);
  }
  return ok(kinds);
}

export interface DriveLinkAppendInput {
  readonly areas?: readonly string[];
  readonly projects?: readonly string[];
  readonly tasks?: readonly string[];
  readonly notes?: readonly string[];
  readonly goals?: readonly string[];
}

function clearDriveLinkKind(meta: DriveItemMeta, kind: DriveLinkableKind): DriveItemMeta {
  switch (kind) {
    case 'area':
      return { ...meta, area_ids: undefined };
    case 'project':
      return { ...meta, project_ids: undefined };
    case 'task':
      return { ...meta, task_ids: undefined };
    case 'note':
      return { ...meta, note_ids: undefined };
    case 'goal':
      return { ...meta, goal_ids: undefined };
  }
}

function mergeIds(existing: string[] | undefined, add: readonly string[]): string[] | undefined {
  const merged = [...new Set([...(existing ?? []), ...add])];
  return merged.length > 0 ? merged : undefined;
}

function resolveIdsForKind(
  db: SecondBrainDb,
  kind: DriveLinkableKind,
  refs: readonly string[],
): Result<string[], string> {
  const ids: string[] = [];
  for (const ref of refs) {
    const r = resolveDriveLinkTargetRef(db, kind, ref);
    if (!r.ok) {
      return r;
    }
    ids.push(r.value);
  }
  return ok(ids);
}

async function writeDriveItemDocument(
  workspaceRoot: string,
  db: SecondBrainDb,
  relPath: string,
  meta: DriveItemMeta,
  body: string,
): Promise<void> {
  const root = path.resolve(workspaceRoot);
  const absDoc = path.join(root, relPath);
  await writeFile(absDoc, serializeDriveItem(meta, body), 'utf8');
  const stDoc = await stat(absDoc);
  upsertDriveItem(db, meta, relPath, stDoc.birthtime.toISOString(), stDoc.mtime.toISOString());
}

/**
 * Update relationship ids on a drive item (durable `item.md` + index).
 * - Default: merge new ids into each kind.
 * - `replace`: each kind that has at least one ref is set to exactly those ids.
 * - `clearKinds`: clear listed kinds before applying refs (e.g. clear area, then add new area).
 */
export async function applyDriveItemLinks(
  workspaceRoot: string,
  db: SecondBrainDb,
  driveRef: string,
  options: {
    readonly append: DriveLinkAppendInput;
    readonly replace: boolean;
    readonly clearKinds: readonly DriveLinkableKind[];
    readonly dryRun: boolean;
  },
): Promise<Result<DriveItemMeta, string>> {
  const row = findDriveItemByRef(db, driveRef);
  if (!row.ok) {
    return err(row.error);
  }
  const relPath = row.value.file_path;
  const root = path.resolve(workspaceRoot);
  const raw = await readFile(path.join(root, relPath), 'utf8');
  const parsed = parseDriveItemDocument(raw);
  if (!parsed.ok) {
    return err(parsed.error);
  }
  let meta: DriveItemMeta = { ...parsed.value.meta };
  const body = parsed.value.body;

  for (const k of options.clearKinds) {
    meta = clearDriveLinkKind(meta, k);
  }

  const a = options.append.areas ?? [];
  const p = options.append.projects ?? [];
  const t = options.append.tasks ?? [];
  const n = options.append.notes ?? [];
  const g = options.append.goals ?? [];
  const hasRefs = a.length + p.length + t.length + n.length + g.length > 0;
  if (!hasRefs && options.clearKinds.length === 0) {
    return err('Pass at least one --area/--project/--task/--note/--goal or --clear');
  }

  const applyKind = (kind: DriveLinkableKind, refs: readonly string[]): Result<void, string> => {
    if (refs.length === 0) {
      return ok(undefined);
    }
    const ids = resolveIdsForKind(db, kind, refs);
    if (!ids.ok) {
      return err(ids.error);
    }
    const next = ids.value.length > 0 ? [...ids.value] : undefined;
    if (options.replace) {
      switch (kind) {
        case 'area':
          meta = { ...meta, area_ids: next };
          break;
        case 'project':
          meta = { ...meta, project_ids: next };
          break;
        case 'task':
          meta = { ...meta, task_ids: next };
          break;
        case 'note':
          meta = { ...meta, note_ids: next };
          break;
        case 'goal':
          meta = { ...meta, goal_ids: next };
          break;
      }
    } else {
      switch (kind) {
        case 'area':
          meta = { ...meta, area_ids: mergeIds(meta.area_ids, ids.value) };
          break;
        case 'project':
          meta = { ...meta, project_ids: mergeIds(meta.project_ids, ids.value) };
          break;
        case 'task':
          meta = { ...meta, task_ids: mergeIds(meta.task_ids, ids.value) };
          break;
        case 'note':
          meta = { ...meta, note_ids: mergeIds(meta.note_ids, ids.value) };
          break;
        case 'goal':
          meta = { ...meta, goal_ids: mergeIds(meta.goal_ids, ids.value) };
          break;
      }
    }
    return ok(undefined);
  };

  const rA = applyKind('area', a);
  if (!rA.ok) {
    return rA;
  }
  const rP = applyKind('project', p);
  if (!rP.ok) {
    return rP;
  }
  const rT = applyKind('task', t);
  if (!rT.ok) {
    return rT;
  }
  const rN = applyKind('note', n);
  if (!rN.ok) {
    return rN;
  }
  const rG = applyKind('goal', g);
  if (!rG.ok) {
    return rG;
  }

  if (options.dryRun) {
    return ok(meta);
  }

  await writeDriveItemDocument(workspaceRoot, db, relPath, meta, body);
  return ok(meta);
}

export async function updateDriveItemMetadata(
  workspaceRoot: string,
  db: SecondBrainDb,
  driveRef: string,
  patch: {
    readonly description?: string | null;
    readonly tags?: readonly string[];
    readonly body?: string;
  },
  options: { readonly dryRun: boolean },
): Promise<Result<DriveItemMeta, string>> {
  const row = findDriveItemByRef(db, driveRef);
  if (!row.ok) {
    return err(row.error);
  }
  const relPath = row.value.file_path;
  const root = path.resolve(workspaceRoot);
  const raw = await readFile(path.join(root, relPath), 'utf8');
  const parsed = parseDriveItemDocument(raw);
  if (!parsed.ok) {
    return err(parsed.error);
  }
  const hasPatch =
    patch.description !== undefined || patch.tags !== undefined || patch.body !== undefined;
  if (!hasPatch) {
    return err('Pass at least one of description, tags, or body to update');
  }
  let meta: DriveItemMeta = { ...parsed.value.meta };
  if (patch.description !== undefined) {
    meta = { ...meta, description: patch.description };
  }
  if (patch.tags !== undefined) {
    meta = { ...meta, tags: patch.tags.length > 0 ? [...patch.tags] : undefined };
  }
  const body = patch.body !== undefined ? patch.body : parsed.value.body;
  if (options.dryRun) {
    return ok(meta);
  }
  await writeDriveItemDocument(workspaceRoot, db, relPath, meta, body);
  return ok(meta);
}

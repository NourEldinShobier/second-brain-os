import { createHash, randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import type { EntityAssetManifestEntry } from '../domain/markdown/second-brain-meta.js';
import type { Result } from '../domain/result.js';
import { err, ok } from '../domain/result.js';
import type { SecondBrainDb } from '../infrastructure/db/open-database.js';
import * as schema from '../infrastructure/db/schema.js';
import type { MarkdownWorkspaceRepository } from '../infrastructure/markdown/markdown-repository.js';
import { findEntityByIdOrSlug, type FoundEntityRow } from '../infrastructure/query/find-entity.js';
import type { EntityCrudService } from './entity-crud-service.js';

export const ENTITY_ASSET_OWNER_KINDS = [
  'area',
  'goal',
  'project',
  'task',
  'resource',
  'note',
] as const;

export type EntityAssetOwnerKind = (typeof ENTITY_ASSET_OWNER_KINDS)[number];

function isAssetOwnerKind(k: string): k is EntityAssetOwnerKind {
  return (ENTITY_ASSET_OWNER_KINDS as readonly string[]).includes(k);
}

function requireAssetOwner(row: FoundEntityRow): Result<EntityAssetOwnerKind, string> {
  if (!isAssetOwnerKind(row.kind)) {
    return err(
      `Entity kind "${row.kind}" does not support assets (use area, goal, project, task, resource, or note).`,
    );
  }
  return ok(row.kind);
}

function guessMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
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

function nowIso(): string {
  return new Date().toISOString();
}

function uniqueDestName(existingNames: Set<string>, baseName: string): string {
  if (!existingNames.has(baseName)) {
    return baseName;
  }
  const ext = path.extname(baseName);
  const stem = baseName.slice(0, baseName.length - ext.length);
  let n = 2;
  let candidate = `${stem}-${String(n)}${ext}`;
  while (existingNames.has(candidate)) {
    n += 1;
    candidate = `${stem}-${String(n)}${ext}`;
  }
  return candidate;
}

export async function addEntityAsset(
  db: SecondBrainDb,
  entities: EntityCrudService,
  repo: MarkdownWorkspaceRepository,
  entityRef: string,
  sourceAbsolutePath: string,
  options?: { readonly title?: string; readonly description?: string | null },
): Promise<Result<{ readonly asset: EntityAssetManifestEntry; readonly entityPath: string }, string>> {
  const found = findEntityByIdOrSlug(db, entityRef.trim());
  if (!found.ok) {
    return found;
  }
  const row = found.value;
  if (row.archived) {
    return err('Cannot add assets to an archived entity (restore first).');
  }
  const kindOk = requireAssetOwner(row);
  if (!kindOk.ok) {
    return err(kindOk.error);
  }

  const absSrc = path.resolve(sourceAbsolutePath);
  let st;
  try {
    st = await stat(absSrc);
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
  if (!st.isFile()) {
    return err(`Not a file: ${absSrc}`);
  }

  const read = await repo.readEntity(row.file_path);
  if (!read.ok) {
    return read;
  }
  const prev = read.value.meta;
  const existing = prev.assets ?? [];
  const existingNames = new Set(existing.map((a) => path.basename(a.path)));
  const baseName = path.basename(absSrc);
  const destFile = uniqueDestName(existingNames, baseName);
  const pkgDir = path.dirname(repo.resolvePath(row.file_path));
  const assetsDir = path.join(pkgDir, 'assets');
  await mkdir(assetsDir, { recursive: true });
  const relInPackage = `assets/${destFile.replace(/\\/g, '/')}`;
  const destAbs = path.join(assetsDir, destFile);
  await copyFile(absSrc, destAbs);

  const id = randomUUID();
  const importedAt = nowIso();
  const sha = await sha256File(destAbs);
  const entry: EntityAssetManifestEntry = {
    id,
    path: relInPackage,
    original_filename: baseName,
    mime_type: guessMimeType(destFile),
    imported_at: importedAt,
    sha256: sha,
    ...(options?.title !== undefined && options.title !== '' ? { title: options.title } : {}),
    ...(options?.description !== undefined ? { description: options.description } : {}),
  };

  const nextAssets = [...existing, entry];
  const updated = await entities.updateEntity(row.file_path, { assets: nextAssets });
  if (!updated.ok) {
    try {
      await rm(destAbs, { force: true });
    } catch {
      /* best effort */
    }
    return updated;
  }

  return ok({ asset: entry, entityPath: row.file_path });
}

export function listEntityAssets(
  db: SecondBrainDb,
  entityRef: string,
):
  Result<
    readonly {
      readonly id: string;
      readonly path_in_package: string;
      readonly original_filename: string;
      readonly mime_type: string;
      readonly title: string | null;
      readonly imported_at: string;
    }[],
    string
  >
{
  const found = findEntityByIdOrSlug(db, entityRef.trim());
  if (!found.ok) {
    return found;
  }
  const kindOk = requireAssetOwner(found.value);
  if (!kindOk.ok) {
    return err(kindOk.error);
  }
  const rows = db
    .select({
      id: schema.entityAssets.id,
      path_in_package: schema.entityAssets.path_in_package,
      original_filename: schema.entityAssets.original_filename,
      mime_type: schema.entityAssets.mime_type,
      title: schema.entityAssets.title,
      imported_at: schema.entityAssets.imported_at,
    })
    .from(schema.entityAssets)
    .where(eq(schema.entityAssets.owner_entity_id, found.value.id))
    .all();
  return ok(rows);
}

export async function removeEntityAsset(
  db: SecondBrainDb,
  entities: EntityCrudService,
  repo: MarkdownWorkspaceRepository,
  entityRef: string,
  assetRef: string,
): Promise<Result<{ readonly removed_id: string }, string>> {
  const found = findEntityByIdOrSlug(db, entityRef.trim());
  if (!found.ok) {
    return found;
  }
  const row = found.value;
  if (row.archived) {
    return err('Cannot remove assets from an archived entity (restore first).');
  }
  const kindOk = requireAssetOwner(row);
  if (!kindOk.ok) {
    return err(kindOk.error);
  }

  const read = await repo.readEntity(row.file_path);
  if (!read.ok) {
    return read;
  }
  const assets = read.value.meta.assets ?? [];
  const ref = assetRef.trim();
  let idx = assets.findIndex((a) => a.id === ref);
  if (idx < 0) {
    idx = assets.findIndex((a) => a.path === ref || a.path === ref.replace(/\\/g, '/'));
  }
  if (idx < 0) {
    return err(`Asset not found: ${assetRef}`);
  }
  const [removed] = assets.splice(idx, 1);
  if (removed === undefined) {
    return err(`Asset not found: ${assetRef}`);
  }

  const pkgDir = path.dirname(repo.resolvePath(row.file_path));
  const absPayload = path.join(pkgDir, ...removed.path.split('/').filter(Boolean));

  const updated = await entities.updateEntity(row.file_path, { assets: assets.length > 0 ? assets : [] });
  if (!updated.ok) {
    return updated;
  }

  try {
    await rm(absPayload, { force: true });
  } catch {
    /* file may already be gone */
  }

  return ok({ removed_id: removed.id });
}

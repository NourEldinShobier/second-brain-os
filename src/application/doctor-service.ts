import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import type { ListableEntityKind } from '../domain/listable-kind.js';
import type { DriftItem } from '../domain/indexing/drift.js';
import type { SecondBrainDb } from '../infrastructure/db/open-database.js';
import * as schema from '../infrastructure/db/schema.js';
import {
  deleteEntityIndexRow,
  deleteEntityLinksForEntity,
} from '../infrastructure/indexing/delete-entity-index-row.js';
import { deleteDriveItemById } from '../infrastructure/indexing/upsert-drive-item.js';
import { reindexWorkspace } from '../infrastructure/indexing/reindex-workspace.js';

export type DoctorSeverity = 'error' | 'warning' | 'info';

export interface DoctorFinding {
  readonly severity: DoctorSeverity;
  readonly category: string;
  readonly message: string;
  readonly path?: string;
  readonly id?: string;
  readonly detail?: Readonly<Record<string, unknown>>;
}

function entityRowExists(db: SecondBrainDb, kind: string, id: string): boolean {
  switch (kind) {
    case 'area':
      return db.select().from(schema.areas).where(eq(schema.areas.id, id)).get() !== undefined;
    case 'goal':
      return db.select().from(schema.goals).where(eq(schema.goals.id, id)).get() !== undefined;
    case 'project':
      return db.select().from(schema.projects).where(eq(schema.projects.id, id)).get() !== undefined;
    case 'task':
      return db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).get() !== undefined;
    case 'resource':
      return db.select().from(schema.resources).where(eq(schema.resources.id, id)).get() !== undefined;
    case 'note':
      return db.select().from(schema.notes).where(eq(schema.notes.id, id)).get() !== undefined;
    case 'inbox_item':
      return db.select().from(schema.inboxItems).where(eq(schema.inboxItems.id, id)).get() !== undefined;
    default:
      return false;
  }
}

/** Index rows whose `file_path` no longer exists on disk (orphan metadata). */
export function findOrphanIndexRows(workspaceRoot: string, db: SecondBrainDb): DoctorFinding[] {
  const root = path.resolve(workspaceRoot);
  const findings: DoctorFinding[] = [];

  const check = (kindLabel: ListableEntityKind, rows: readonly { id: string; file_path: string }[]) => {
    for (const row of rows) {
      const abs = path.join(root, row.file_path);
      try {
        statSync(abs);
      } catch {
        findings.push({
          severity: 'error',
          category: 'index_row_missing_file',
          message: `${kindLabel} index row points to missing file: ${row.file_path}`,
          path: row.file_path,
          id: row.id,
        });
      }
    }
  };

  check('area', db.select({ id: schema.areas.id, file_path: schema.areas.file_path }).from(schema.areas).all());
  check('goal', db.select({ id: schema.goals.id, file_path: schema.goals.file_path }).from(schema.goals).all());
  check(
    'project',
    db.select({ id: schema.projects.id, file_path: schema.projects.file_path }).from(schema.projects).all(),
  );
  check('task', db.select({ id: schema.tasks.id, file_path: schema.tasks.file_path }).from(schema.tasks).all());
  check(
    'resource',
    db.select({ id: schema.resources.id, file_path: schema.resources.file_path }).from(schema.resources).all(),
  );
  check('note', db.select({ id: schema.notes.id, file_path: schema.notes.file_path }).from(schema.notes).all());
  check(
    'inbox_item',
    db.select({ id: schema.inboxItems.id, file_path: schema.inboxItems.file_path }).from(schema.inboxItems).all(),
  );

  const driveRows = db
    .select({ id: schema.driveItems.id, file_path: schema.driveItems.file_path })
    .from(schema.driveItems)
    .all();
  for (const row of driveRows) {
    const abs = path.join(root, row.file_path);
    try {
      statSync(abs);
    } catch {
      findings.push({
        severity: 'error',
        category: 'drive_index_missing_file',
        message: `drive_item index row points to missing file: ${row.file_path}`,
        path: row.file_path,
        id: row.id,
      });
      continue;
    }

    // Check that the payload directory exists (e.g., files/ inside the package)
    const pkgDir = path.dirname(abs);
    const payloadDir = path.join(pkgDir, 'files');
    try {
      const st = statSync(payloadDir);
      if (!st.isDirectory()) {
        findings.push({
          severity: 'error',
          category: 'drive_payload_missing_directory',
          message: `drive_item package missing files/ directory: ${pkgDir}`,
          path: pkgDir,
          id: row.id,
        });
      }
    } catch {
      findings.push({
        severity: 'error',
        category: 'drive_payload_missing_directory',
        message: `drive_item package missing files/ directory: ${pkgDir}`,
        path: pkgDir,
        id: row.id,
      });
    }
  }

  return findings;
}

/** `entity_links` rows whose target (or source) id is missing from the index. */
export function findBrokenEntityLinks(db: SecondBrainDb): DoctorFinding[] {
  const links = db.select().from(schema.entityLinks).all();
  const findings: DoctorFinding[] = [];

  for (const link of links) {
    if (!entityRowExists(db, link.to_entity_type, link.to_entity_id)) {
      findings.push({
        severity: 'warning',
        category: 'broken_link_target',
        message: `Link points to missing ${link.to_entity_type} ${link.to_entity_id}`,
        id: link.id,
        detail: {
          from: `${link.from_entity_type}:${link.from_entity_id}`,
          to: `${link.to_entity_type}:${link.to_entity_id}`,
          link_kind: link.link_kind,
        },
      });
    }
    if (!entityRowExists(db, link.from_entity_type, link.from_entity_id)) {
      findings.push({
        severity: 'warning',
        category: 'broken_link_source',
        message: `Link originates from missing ${link.from_entity_type} ${link.from_entity_id}`,
        id: link.id,
        detail: {
          from: `${link.from_entity_type}:${link.from_entity_id}`,
          to: `${link.to_entity_type}:${link.to_entity_id}`,
        },
      });
    }
  }

  return findings;
}

function getEntityFilePath(db: SecondBrainDb, kind: string, id: string): string | undefined {
  switch (kind) {
    case 'area':
      return db.select({ file_path: schema.areas.file_path }).from(schema.areas).where(eq(schema.areas.id, id)).get()
        ?.file_path;
    case 'goal':
      return db.select({ file_path: schema.goals.file_path }).from(schema.goals).where(eq(schema.goals.id, id)).get()
        ?.file_path;
    case 'project':
      return db
        .select({ file_path: schema.projects.file_path })
        .from(schema.projects)
        .where(eq(schema.projects.id, id))
        .get()?.file_path;
    case 'task':
      return db.select({ file_path: schema.tasks.file_path }).from(schema.tasks).where(eq(schema.tasks.id, id)).get()
        ?.file_path;
    case 'resource':
      return db
        .select({ file_path: schema.resources.file_path })
        .from(schema.resources)
        .where(eq(schema.resources.id, id))
        .get()?.file_path;
    case 'note':
      return db.select({ file_path: schema.notes.file_path }).from(schema.notes).where(eq(schema.notes.id, id)).get()
        ?.file_path;
    case 'inbox_item':
      return db
        .select({ file_path: schema.inboxItems.file_path })
        .from(schema.inboxItems)
        .where(eq(schema.inboxItems.id, id))
        .get()?.file_path;
    default:
      return undefined;
  }
}

/** Index rows for entity assets whose payload file is missing, orphan files under `assets/`, or orphan asset index rows. */
export function findEntityAssetDrift(workspaceRoot: string, db: SecondBrainDb): DoctorFinding[] {
  const root = path.resolve(workspaceRoot);
  const findings: DoctorFinding[] = [];
  const assetRows = db.select().from(schema.entityAssets).all();
  for (const row of assetRows) {
    const ownerPath = getEntityFilePath(db, row.owner_entity_type, row.owner_entity_id);
    if (ownerPath === undefined) {
      findings.push({
        severity: 'warning',
        category: 'asset_orphan_index',
        message: `entity_assets row references missing owner ${row.owner_entity_type}:${row.owner_entity_id}`,
        id: row.id,
      });
      continue;
    }
    const entityDir = path.dirname(path.join(root, ownerPath));
    const abs = path.join(entityDir, ...row.path_in_package.split('/').filter(Boolean));
    try {
      statSync(abs);
    } catch {
      findings.push({
        severity: 'error',
        category: 'asset_manifest_missing_payload',
        message: `Asset file missing on disk: ${row.path_in_package} (owner ${row.owner_entity_id})`,
        path: row.path_in_package,
        id: row.id,
      });
    }
  }

  const ownerRows: readonly { readonly id: string; readonly file_path: string }[] = [
    ...db.select({ id: schema.areas.id, file_path: schema.areas.file_path }).from(schema.areas).all(),
    ...db.select({ id: schema.goals.id, file_path: schema.goals.file_path }).from(schema.goals).all(),
    ...db.select({ id: schema.projects.id, file_path: schema.projects.file_path }).from(schema.projects).all(),
    ...db.select({ id: schema.tasks.id, file_path: schema.tasks.file_path }).from(schema.tasks).all(),
    ...db.select({ id: schema.resources.id, file_path: schema.resources.file_path }).from(schema.resources).all(),
    ...db.select({ id: schema.notes.id, file_path: schema.notes.file_path }).from(schema.notes).all(),
  ];

  for (const o of ownerRows) {
    const pkgDir = path.dirname(path.join(root, o.file_path));
    const assetsDir = path.join(pkgDir, 'assets');
    let names: string[];
    try {
      names = readdirSync(assetsDir);
    } catch {
      continue;
    }
    const indexed = new Set(
      db
        .select({ path_in_package: schema.entityAssets.path_in_package })
        .from(schema.entityAssets)
        .where(eq(schema.entityAssets.owner_entity_id, o.id))
        .all()
        .map((r) => r.path_in_package),
    );
    for (const name of names) {
      const absFile = path.join(assetsDir, name);
      try {
        if (!statSync(absFile).isFile()) {
          continue;
        }
      } catch {
        continue;
      }
      const rel = `assets/${name.replace(/\\/g, '/')}`;
      if (!indexed.has(rel)) {
        findings.push({
          severity: 'warning',
          category: 'asset_orphan_file',
          message: `File in assets/ not listed in entity manifest: ${rel}`,
          path: path.relative(root, absFile).replace(/\\/g, '/'),
        });
      }
    }
  }

  return findings;
}

/** Remove `entity_assets` rows when the payload file is missing or the owner entity row is gone. */
export function pruneStaleEntityAssetRows(workspaceRoot: string, db: SecondBrainDb): number {
  const root = path.resolve(workspaceRoot);
  let removed = 0;
  const rows = db.select().from(schema.entityAssets).all();
  for (const row of rows) {
    const ownerPath = getEntityFilePath(db, row.owner_entity_type, row.owner_entity_id);
    if (ownerPath === undefined) {
      db.delete(schema.entityAssets).where(eq(schema.entityAssets.id, row.id)).run();
      removed += 1;
      continue;
    }
    const entityDir = path.dirname(path.join(root, ownerPath));
    const abs = path.join(entityDir, ...row.path_in_package.split('/').filter(Boolean));
    try {
      statSync(abs);
    } catch {
      db.delete(schema.entityAssets).where(eq(schema.entityAssets.id, row.id)).run();
      removed += 1;
    }
  }
  return removed;
}

function driftToFinding(d: DriftItem): DoctorFinding {
  const severity: DoctorSeverity =
    d.category === 'duplicate_stable_id' || d.category === 'unreadable_frontmatter' ? 'error' : 'warning';
  return {
    severity,
    category: d.category,
    message: d.message,
    ...(d.path !== undefined ? { path: d.path } : {}),
    ...(d.id !== undefined ? { id: d.id } : {}),
    ...(d.detail !== undefined ? { detail: d.detail } : {}),
  };
}

export interface DoctorDiagnostics {
  readonly indexed_files: number;
  readonly findings: readonly DoctorFinding[];
  readonly reindex_drift: readonly DriftItem[];
}

/**
 * Run filesystem scan + SQLite checks: reindex drift, orphan index rows, broken entity_links.
 */
export async function runDoctorDiagnostics(workspaceRoot: string, db: SecondBrainDb): Promise<DoctorDiagnostics> {
  const reindex = await reindexWorkspace(workspaceRoot, db);
  const findings: DoctorFinding[] = reindex.drift.map(driftToFinding);

  findings.push(...findOrphanIndexRows(workspaceRoot, db));
  findings.push(...findBrokenEntityLinks(db));
  findings.push(...findEntityAssetDrift(workspaceRoot, db));

  return {
    indexed_files: reindex.indexedFiles,
    findings,
    reindex_drift: reindex.drift,
  };
}

/** Delete SQLite rows (and attached links) when the Markdown file is gone. Returns rows removed. */
export function pruneOrphanIndexRows(workspaceRoot: string, db: SecondBrainDb): number {
  const root = path.resolve(workspaceRoot);
  let removed = 0;

  const prune = (kind: ListableEntityKind, rows: readonly { id: string; file_path: string }[]) => {
    for (const row of rows) {
      const abs = path.join(root, row.file_path);
      try {
        statSync(abs);
      } catch {
        deleteEntityLinksForEntity(db, kind, row.id);
        deleteEntityIndexRow(db, kind, row.id);
        removed += 1;
      }
    }
  };

  prune('area', db.select({ id: schema.areas.id, file_path: schema.areas.file_path }).from(schema.areas).all());
  prune('goal', db.select({ id: schema.goals.id, file_path: schema.goals.file_path }).from(schema.goals).all());
  prune(
    'project',
    db.select({ id: schema.projects.id, file_path: schema.projects.file_path }).from(schema.projects).all(),
  );
  prune('task', db.select({ id: schema.tasks.id, file_path: schema.tasks.file_path }).from(schema.tasks).all());
  prune(
    'resource',
    db.select({ id: schema.resources.id, file_path: schema.resources.file_path }).from(schema.resources).all(),
  );
  prune('note', db.select({ id: schema.notes.id, file_path: schema.notes.file_path }).from(schema.notes).all());
  prune(
    'inbox_item',
    db.select({ id: schema.inboxItems.id, file_path: schema.inboxItems.file_path }).from(schema.inboxItems).all(),
  );

  return removed;
}

/** Delete `drive_items` rows when `item.md` is missing on disk. */
export function pruneOrphanDriveItemRows(workspaceRoot: string, db: SecondBrainDb): number {
  const root = path.resolve(workspaceRoot);
  let removed = 0;
  const driveRows = db
    .select({ id: schema.driveItems.id, file_path: schema.driveItems.file_path })
    .from(schema.driveItems)
    .all();
  for (const row of driveRows) {
    const abs = path.join(root, row.file_path);
    try {
      statSync(abs);
    } catch {
      deleteDriveItemById(db, row.id);
      removed += 1;
    }
  }
  return removed;
}

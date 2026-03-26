import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { stat } from 'node:fs/promises';
import {
  secondBrainMetaSchema,
  type SecondBrainMeta,
} from '../domain/markdown/second-brain-meta.js';
import type { CoreEntityKind } from '../domain/entity-kind.js';
import { isValidSlug, slugifyTitle } from '../domain/markdown/slug.js';
import { validateRelationshipInvariants } from '../domain/relationships/validation.js';
import type { Result } from '../domain/result.js';
import { err, ok } from '../domain/result.js';
import { getCoreEntityCreatedAt } from '../infrastructure/indexing/get-core-entity-created-at.js';
import { upsertByKind } from '../infrastructure/indexing/upsert-entity-row.js';
import { syncEntityLinksFromMeta } from '../infrastructure/indexing/sync-entity-links.js';
import { validateLinkTargetsExist } from '../infrastructure/relationships/validate-link-targets.js';
import type { ListableEntityKind } from '../domain/listable-kind.js';
import { buildMetaForReclassify, type ReclassifyTargetKind } from '../domain/organize/reclassify-meta.js';
import { insertArchiveEvent } from '../infrastructure/archive/insert-archive-event.js';
import { deleteEntityIndexRow } from '../infrastructure/indexing/delete-entity-index-row.js';
import { rewriteEntityKindInLinks } from '../infrastructure/indexing/rewrite-entity-kind-in-links.js';
import { replaceOutgoingLinks } from '../infrastructure/indexing/sync-entity-links.js';
import type { SecondBrainDb } from '../infrastructure/db/open-database.js';
import { MarkdownWorkspaceRepository } from '../infrastructure/markdown/markdown-repository.js';
import { findEntityByKindAndSlug } from '../infrastructure/query/find-entity.js';
import type { ParsedMarkdownEntity } from '../infrastructure/markdown/parse-document.js';

function nowIso(): string {
  return new Date().toISOString();
}

function mergeSecondBrainMeta(
  base: SecondBrainMeta,
  patch: Partial<Omit<SecondBrainMeta, 'id' | 'kind' | 'version'>>,
): Result<SecondBrainMeta, string> {
  const next: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) {
      next[k] = v;
    }
  }
  const parsed = secondBrainMetaSchema.safeParse(next);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'second_brain'}: ${i.message}`).join('; ');
    return err(`Invalid metadata: ${msg}`);
  }
  if (parsed.data.id !== base.id || parsed.data.kind !== base.kind) {
    return err('Cannot change id or kind');
  }
  return ok(parsed.data);
}

export class EntityCrudService {
  constructor(
    private readonly repo: MarkdownWorkspaceRepository,
    private readonly db: SecondBrainDb,
  ) {}

  async readEntity(relativePath: string): Promise<Result<ParsedMarkdownEntity, string>> {
    return this.repo.readEntity(relativePath);
  }

  private validateForWrite(meta: SecondBrainMeta): Result<true, string> {
    const inv = validateRelationshipInvariants(meta);
    if (!inv.ok) {
      return inv;
    }
    return validateLinkTargetsExist(this.db, meta);
  }

  private async syncIndex(
    meta: SecondBrainMeta,
    relPath: string,
    options?: { readonly body?: string },
  ): Promise<void> {
    const abs = this.repo.resolvePath(relPath);
    let updatedAt = nowIso();
    try {
      const st = await stat(abs);
      updatedAt = st.mtime.toISOString();
    } catch {
      // keep nowIso
    }
    const createdAt = getCoreEntityCreatedAt(this.db, meta.kind, meta.id) ?? updatedAt;
    const indexContext =
      meta.kind === 'inbox_item' && options?.body !== undefined ? { body: options.body } : undefined;
    upsertByKind(this.db, meta, relPath, createdAt, updatedAt, indexContext);
    syncEntityLinksFromMeta(this.db, meta, updatedAt);
  }

  async createArea(input: {
    readonly title: string;
    readonly slug?: string;
    readonly body?: string;
    readonly status?: string;
  }): Promise<Result<{ readonly path: string; readonly meta: SecondBrainMeta }, string>> {
    const slug = input.slug ?? slugifyTitle(input.title);
    if (!isValidSlug(slug)) {
      return err(`Invalid slug: ${slug}`);
    }
    const meta: SecondBrainMeta = {
      id: randomUUID(),
      kind: 'area',
      version: 1,
      slug,
      title: input.title,
      status: input.status ?? 'active',
      archived: false,
    };
    const v = this.validateForWrite(meta);
    if (!v.ok) {
      return v;
    }
    const relPath = this.repo.activeEntityPath('area', slug);
    const body = input.body ?? '';
    const w = await this.repo.writeEntity(relPath, meta, body);
    if (!w.ok) {
      return w;
    }
    await this.syncIndex(meta, relPath);
    return ok({ path: relPath, meta });
  }

  async createGoal(input: {
    readonly title: string;
    readonly slug?: string;
    readonly areaIds: readonly string[];
    readonly body?: string;
    readonly status?: string;
  }): Promise<Result<{ readonly path: string; readonly meta: SecondBrainMeta }, string>> {
    const slug = input.slug ?? slugifyTitle(input.title);
    if (!isValidSlug(slug)) {
      return err(`Invalid slug: ${slug}`);
    }
    const meta: SecondBrainMeta = {
      id: randomUUID(),
      kind: 'goal',
      version: 1,
      slug,
      title: input.title,
      status: input.status ?? 'active',
      archived: false,
      area_ids: [...input.areaIds],
    };
    const v = this.validateForWrite(meta);
    if (!v.ok) {
      return v;
    }
    const relPath = this.repo.activeEntityPath('goal', slug);
    const body = input.body ?? '';
    const w = await this.repo.writeEntity(relPath, meta, body);
    if (!w.ok) {
      return w;
    }
    await this.syncIndex(meta, relPath);
    return ok({ path: relPath, meta });
  }

  async createProject(input: {
    readonly title: string;
    readonly slug?: string;
    readonly areaIds: readonly string[];
    readonly body?: string;
    readonly status?: string;
  }): Promise<Result<{ readonly path: string; readonly meta: SecondBrainMeta }, string>> {
    const slug = input.slug ?? slugifyTitle(input.title);
    if (!isValidSlug(slug)) {
      return err(`Invalid slug: ${slug}`);
    }
    const meta: SecondBrainMeta = {
      id: randomUUID(),
      kind: 'project',
      version: 1,
      slug,
      title: input.title,
      status: input.status ?? 'active',
      archived: false,
      area_ids: [...input.areaIds],
    };
    const v = this.validateForWrite(meta);
    if (!v.ok) {
      return v;
    }
    const relPath = this.repo.activeEntityPath('project', slug);
    const body = input.body ?? '';
    const w = await this.repo.writeEntity(relPath, meta, body);
    if (!w.ok) {
      return w;
    }
    await this.syncIndex(meta, relPath);
    return ok({ path: relPath, meta });
  }

  async createTask(input: {
    readonly title: string;
    readonly slug?: string;
    readonly body?: string;
    readonly areaIds?: readonly string[];
    readonly projectIds?: readonly string[];
    readonly status?: string;
    readonly dueDate?: string | null;
    readonly priority?: number | null;
    readonly energy?: string | null;
  }): Promise<Result<{ readonly path: string; readonly meta: SecondBrainMeta }, string>> {
    const slug = input.slug ?? slugifyTitle(input.title);
    if (!isValidSlug(slug)) {
      return err(`Invalid slug: ${slug}`);
    }
    const meta: SecondBrainMeta = {
      id: randomUUID(),
      kind: 'task',
      version: 1,
      slug,
      title: input.title,
      status: input.status ?? 'todo',
      archived: false,
      ...(input.dueDate !== undefined ? { due_date: input.dueDate } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.energy !== undefined ? { energy: input.energy } : {}),
      ...(input.areaIds !== undefined && input.areaIds.length > 0 ? { area_ids: [...input.areaIds] } : {}),
      ...(input.projectIds !== undefined && input.projectIds.length > 0 ? { project_ids: [...input.projectIds] } : {}),
    };
    const v = this.validateForWrite(meta);
    if (!v.ok) {
      return v;
    }
    const relPath = this.repo.activeEntityPath('task', slug);
    const body = input.body ?? '';
    const w = await this.repo.writeEntity(relPath, meta, body);
    if (!w.ok) {
      return w;
    }
    await this.syncIndex(meta, relPath);
    return ok({ path: relPath, meta });
  }

  async createNote(input: {
    readonly title: string;
    readonly slug?: string;
    readonly body?: string;
    readonly status?: string;
    readonly notebook?: string | null;
    readonly pinned?: boolean;
  }): Promise<Result<{ readonly path: string; readonly meta: SecondBrainMeta }, string>> {
    const slug = input.slug ?? slugifyTitle(input.title);
    if (!isValidSlug(slug)) {
      return err(`Invalid slug: ${slug}`);
    }
    const meta: SecondBrainMeta = {
      id: randomUUID(),
      kind: 'note',
      version: 1,
      slug,
      title: input.title,
      status: input.status ?? 'active',
      archived: false,
      ...(input.notebook !== undefined ? { notebook: input.notebook } : {}),
      ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
    };
    const v = this.validateForWrite(meta);
    if (!v.ok) {
      return v;
    }
    const relPath = this.repo.activeEntityPath('note', slug);
    const body = input.body ?? '';
    const w = await this.repo.writeEntity(relPath, meta, body);
    if (!w.ok) {
      return w;
    }
    await this.syncIndex(meta, relPath);
    return ok({ path: relPath, meta });
  }

  async createResource(input: {
    readonly title: string;
    readonly slug?: string;
    readonly body?: string;
    readonly sourceUrl?: string | null;
    readonly status?: string;
  }): Promise<Result<{ readonly path: string; readonly meta: SecondBrainMeta }, string>> {
    const slug = input.slug ?? slugifyTitle(input.title);
    if (!isValidSlug(slug)) {
      return err(`Invalid slug: ${slug}`);
    }
    const meta: SecondBrainMeta = {
      id: randomUUID(),
      kind: 'resource',
      version: 1,
      slug,
      title: input.title,
      status: input.status ?? 'active',
      archived: false,
      ...(input.sourceUrl !== undefined ? { source_url: input.sourceUrl } : {}),
    };
    const v = this.validateForWrite(meta);
    if (!v.ok) {
      return v;
    }
    const relPath = this.repo.activeEntityPath('resource', slug);
    const body = input.body ?? '';
    const w = await this.repo.writeEntity(relPath, meta, body);
    if (!w.ok) {
      return w;
    }
    await this.syncIndex(meta, relPath);
    return ok({ path: relPath, meta });
  }

  async createInboxItem(input: {
    readonly title: string;
    readonly slug?: string;
    readonly body?: string;
    readonly inboxDate?: string;
  }): Promise<Result<{ readonly path: string; readonly meta: SecondBrainMeta }, string>> {
    const slug = input.slug ?? slugifyTitle(input.title);
    if (!isValidSlug(slug)) {
      return err(`Invalid slug: ${slug}`);
    }
    const inboxDate = input.inboxDate ?? nowIso().slice(0, 10);
    const meta: SecondBrainMeta = {
      id: randomUUID(),
      kind: 'inbox_item',
      version: 1,
      slug,
      title: input.title,
      status: 'new',
      archived: false,
      captured_at: nowIso(),
    };
    const v = this.validateForWrite(meta);
    if (!v.ok) {
      return v;
    }
    const relPath = this.repo.activeEntityPath('inbox_item', slug, inboxDate);
    const body = input.body ?? '';
    const w = await this.repo.writeEntity(relPath, meta, body);
    if (!w.ok) {
      return w;
    }
    await this.syncIndex(meta, relPath, { body });
    return ok({ path: relPath, meta });
  }

  /**
   * Rename slug and/or title for an active typed entity (same folder). Preserves stable `id`.
   * Inbox items should use `organize promote` instead.
   */
  async renameEntity(
    relativePath: string,
    patch: { readonly title?: string; readonly slug?: string },
  ): Promise<Result<{ readonly path: string; readonly meta: SecondBrainMeta }, string>> {
    const read = await this.repo.readEntity(relativePath);
    if (!read.ok) {
      return read;
    }
    const { meta, body } = read.value;
    if (meta.kind === 'archive_record') {
      return err('Cannot rename archive records with this command');
    }
    if (meta.kind === 'inbox_item') {
      return err('Inbox items: use `second-brain-os organize promote` or edit the file manually');
    }
    const nextSlug = patch.slug ?? meta.slug;
    const nextTitle = patch.title ?? meta.title;
    if (!isValidSlug(nextSlug)) {
      return err(`Invalid slug: ${nextSlug}`);
    }
    const merged = mergeSecondBrainMeta(meta, { slug: nextSlug, title: nextTitle });
    if (!merged.ok) {
      return merged;
    }
    const nextMeta = merged.value;
    const kind = nextMeta.kind as Exclude<CoreEntityKind, 'archive_record' | 'inbox_item'>;
    const newRelPath = this.repo.activeEntityPath(kind, nextSlug);
    if (newRelPath !== relativePath) {
      const moved = await this.repo.moveEntityPackage(path.dirname(relativePath), path.dirname(newRelPath));
      if (!moved.ok) {
        return moved;
      }
    }
    const w = await this.repo.writeEntity(newRelPath, nextMeta, body);
    if (!w.ok) {
      return w;
    }
    await this.syncIndex(nextMeta, newRelPath);
    return ok({ path: newRelPath, meta: nextMeta });
  }

  async updateEntity(
    relativePath: string,
    patch: Partial<Omit<SecondBrainMeta, 'id' | 'kind' | 'version'>>,
    body?: string,
  ): Promise<Result<SecondBrainMeta, string>> {
    const read = await this.repo.readEntity(relativePath);
    if (!read.ok) {
      return read;
    }
    const merged = mergeSecondBrainMeta(read.value.meta, patch);
    if (!merged.ok) {
      return merged;
    }
    const meta = merged.value;
    const v = this.validateForWrite(meta);
    if (!v.ok) {
      return v;
    }
    const nextBody = body ?? read.value.body;
    const w = await this.repo.writeEntity(relativePath, meta, nextBody);
    if (!w.ok) {
      return w;
    }
    await this.syncIndex(meta, relativePath, meta.kind === 'inbox_item' ? { body: nextBody } : undefined);
    return ok(meta);
  }

  /** Move entity into `99-archive/...`, update index, log archive event. */
  async archiveEntityBySlug(
    kind: ListableEntityKind,
    slug: string,
    options?: { readonly reason?: string | undefined },
  ): Promise<Result<{ readonly path: string; readonly meta: SecondBrainMeta }, string>> {
    const found = findEntityByKindAndSlug(this.db, kind, slug, { archived: 'active' });
    if (!found.ok) {
      return found;
    }
    const prevPath = found.value.file_path;
    const moved = await this.repo.archiveEntity(prevPath, kind, { reason: options?.reason });
    if (!moved.ok) {
      return moved;
    }
    const read = await this.repo.readEntity(moved.value.newRelativePath);
    if (!read.ok) {
      return read;
    }
    const meta = read.value.meta;
    await this.syncIndex(
      meta,
      moved.value.newRelativePath,
      meta.kind === 'inbox_item' ? { body: read.value.body } : undefined,
    );
    insertArchiveEvent(this.db, {
      entityType: kind,
      entityId: meta.id,
      previousPath: prevPath,
      newPath: moved.value.newRelativePath,
      reason: options?.reason ?? null,
    });
    return ok({ path: moved.value.newRelativePath, meta });
  }

  /** Move entity from `99-archive/...` back to active storage. */
  async restoreEntityBySlug(
    kind: ListableEntityKind,
    slug: string,
  ): Promise<Result<{ readonly path: string; readonly meta: SecondBrainMeta }, string>> {
    const found = findEntityByKindAndSlug(this.db, kind, slug, { archived: 'archived' });
    if (!found.ok) {
      return found;
    }
    const prevPath = found.value.file_path;
    const moved = await this.repo.restoreEntity(prevPath);
    if (!moved.ok) {
      return moved;
    }
    const read = await this.repo.readEntity(moved.value.newRelativePath);
    if (!read.ok) {
      return read;
    }
    const meta = read.value.meta;
    await this.syncIndex(
      meta,
      moved.value.newRelativePath,
      meta.kind === 'inbox_item' ? { body: read.value.body } : undefined,
    );
    insertArchiveEvent(this.db, {
      entityType: kind,
      entityId: meta.id,
      previousPath: prevPath,
      newPath: moved.value.newRelativePath,
      reason: 'restore',
    });
    return ok({ path: moved.value.newRelativePath, meta });
  }

  /**
   * Change kind among `note`, `resource`, and `task` while preserving stable id (same slug family).
   * Not for inbox, areas, goals, or projects.
   */
  async reclassifyEntity(
    relativePath: string,
    toKind: ReclassifyTargetKind,
  ): Promise<Result<{ readonly path: string; readonly meta: SecondBrainMeta }, string>> {
    const read = await this.repo.readEntity(relativePath);
    if (!read.ok) {
      return read;
    }
    const { meta, body } = read.value;
    if (meta.archived) {
      return err('Reclassify active entities only (restore from archive first if needed).');
    }
    const built = buildMetaForReclassify(meta, toKind, body);
    if (!built.ok) {
      return built;
    }
    const next = built.value;
    const v = this.validateForWrite(next);
    if (!v.ok) {
      return v;
    }
    const oldKind = meta.kind;
    if (oldKind === next.kind) {
      return err('Entity is already that kind.');
    }

    const newRel = this.repo.activeEntityPath(toKind, next.slug);
    const clash = await this.repo.readEntity(newRel);
    if (clash.ok && clash.value.meta.id !== meta.id) {
      return err(`Refusing to overwrite another entity at ${newRel}`);
    }

    const w = await this.repo.writeEntity(newRel, next, body);
    if (!w.ok) {
      return w;
    }

    const at = nowIso();
    replaceOutgoingLinks(this.db, oldKind, meta.id, [], at);
    rewriteEntityKindInLinks(this.db, meta.id, oldKind, next.kind);
    deleteEntityIndexRow(this.db, oldKind as ListableEntityKind, meta.id);

    if (newRel !== relativePath) {
      try {
        await rm(this.repo.resolvePath(path.dirname(relativePath)), { recursive: true, force: true });
      } catch (e) {
        return err(
          `Reclassified to ${newRel} but could not remove old package: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    await this.syncIndex(next, newRel);
    return ok({ path: newRel, meta: next });
  }
}

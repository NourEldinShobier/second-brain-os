import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CoreEntityKind } from '../../domain/entity-kind.js';
import { ACTIVE_FOLDER_BY_KIND, ARCHIVE_FOLDER_BY_KIND } from '../../domain/markdown/folders.js';
import { buildEntityFilename, parseEntityFilename } from '../../domain/markdown/filename.js';
import type { SecondBrainMeta } from '../../domain/markdown/second-brain-meta.js';
import type { Result } from '../../domain/result.js';
import { err, ok } from '../../domain/result.js';
import { type ParsedMarkdownEntity, parseMarkdownEntity, serializeMarkdownEntity } from './parse-document.js';

export class MarkdownWorkspaceRepository {
  constructor(private readonly workspaceRoot: string) {}

  resolvePath(relativePath: string): string {
    return path.join(this.workspaceRoot, relativePath);
  }

  async readEntity(relativePath: string): Promise<Result<ParsedMarkdownEntity, string>> {
    const abs = this.resolvePath(relativePath);
    let raw: string;
    try {
      raw = await readFile(abs, 'utf8');
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      return err(`read failed: ${detail}`);
    }
    return parseMarkdownEntity(raw);
  }

  async writeEntity(relativePath: string, meta: SecondBrainMeta, body: string): Promise<Result<true, string>> {
    const abs = this.resolvePath(relativePath);
    try {
      await mkdir(path.dirname(abs), { recursive: true });
      await writeFile(abs, serializeMarkdownEntity(meta, body), 'utf8');
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      return err(`write failed: ${detail}`);
    }
    return ok(true);
  }

  /**
   * Move within workspace (rename). Stable `meta.id` unchanged — update slug/title in meta before calling if needed.
   */
  async moveEntity(fromRelative: string, toRelative: string): Promise<Result<true, string>> {
    const fromAbs = this.resolvePath(fromRelative);
    const toAbs = this.resolvePath(toRelative);
    try {
      await mkdir(path.dirname(toAbs), { recursive: true });
      await rename(fromAbs, toAbs);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      return err(`move failed: ${detail}`);
    }
    return ok(true);
  }

  /** Copy then optionally remove source — safer for some cross-device edge cases. */
  async copyEntity(fromRelative: string, toRelative: string): Promise<Result<true, string>> {
    const fromAbs = this.resolvePath(fromRelative);
    const toAbs = this.resolvePath(toRelative);
    try {
      await mkdir(path.dirname(toAbs), { recursive: true });
      await copyFile(fromAbs, toAbs);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      return err(`copy failed: ${detail}`);
    }
    return ok(true);
  }

  /**
   * Move active entity into archive folder, mark `archived: true` (+ optional reason) in front matter.
   */
  async archiveEntity(
    relativePath: string,
    kind: Exclude<CoreEntityKind, 'archive_record'>,
    options?: { readonly reason?: string | undefined },
  ): Promise<Result<{ readonly newRelativePath: string }, string>> {
    const read = await this.readEntity(relativePath);
    if (!read.ok) {
      return err(read.error);
    }
    const base = path.basename(relativePath);
    const destDir = ARCHIVE_FOLDER_BY_KIND[kind];
    const newRelative = path.join(destDir, base).replace(/\\/g, '/');
    const nextMeta: SecondBrainMeta = {
      ...read.value.meta,
      archived: true,
      archived_at: new Date().toISOString(),
      archive_reason: options?.reason ?? null,
    };
    const written = await this.writeEntity(newRelative, nextMeta, read.value.body);
    if (!written.ok) {
      return written;
    }
    try {
      await rm(this.resolvePath(relativePath));
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      return err(`archived copy ok but could not remove source: ${detail}`);
    }
    return ok({ newRelativePath: newRelative });
  }

  /**
   * Move an archived entity from `99-archive/...` back to its active folder; clears archive flags in front matter.
   */
  async restoreEntity(archiveRelativePath: string): Promise<Result<{ readonly newRelativePath: string }, string>> {
    const read = await this.readEntity(archiveRelativePath);
    if (!read.ok) {
      return read;
    }
    const { meta, body } = read.value;
    if (meta.kind === 'archive_record') {
      return err('Cannot restore archive_record rows via this path');
    }
    if (!meta.archived) {
      return err('Entity is not marked archived in front matter');
    }
    const kind = meta.kind;
    const expectPrefix = ARCHIVE_FOLDER_BY_KIND[kind];
    const norm = archiveRelativePath.replace(/\\/g, '/');
    if (!norm.startsWith(expectPrefix)) {
      return err(`Expected file under ${expectPrefix}, got ${archiveRelativePath}`);
    }

    const base = path.basename(archiveRelativePath);
    const parsed = parseEntityFilename(base);
    if ('error' in parsed) {
      return err(`Bad archive filename: ${parsed.error}`);
    }
    if (parsed.kind !== kind) {
      return err(`Filename kind ${parsed.kind} does not match metadata kind ${kind}`);
    }

    let newRelative: string;
    if (kind === 'inbox_item') {
      if (parsed.kind === 'inbox_item' && parsed.inboxDate !== undefined) {
        newRelative = this.activeEntityPath('inbox_item', meta.slug, parsed.inboxDate);
      } else {
        newRelative = this.activeEntityPath('inbox_item', meta.slug);
      }
    } else {
      newRelative = this.activeEntityPath(kind, meta.slug);
    }

    const nextMeta: SecondBrainMeta = {
      ...meta,
      archived: false,
      archived_at: null,
      archive_reason: null,
    };

    const w = await this.writeEntity(newRelative, nextMeta, body);
    if (!w.ok) {
      return w;
    }
    try {
      await rm(this.resolvePath(archiveRelativePath));
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      return err(`Wrote active file but could not remove archive copy: ${detail}`);
    }
    return ok({ newRelativePath: newRelative });
  }

  /** Build default relative path for a new active entity. */
  activeEntityPath(
    kind: Exclude<CoreEntityKind, 'archive_record'>,
    slug: string,
    inboxDate?: string,
  ): string {
    const folder = ACTIVE_FOLDER_BY_KIND[kind];
    const name =
      kind === 'inbox_item' && inboxDate !== undefined
        ? buildEntityFilename(kind, slug, { inboxDate })
        : buildEntityFilename(kind, slug);
    return path.join(folder, name).replace(/\\/g, '/');
  }
}

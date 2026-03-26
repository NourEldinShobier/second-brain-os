import { copyFile, cp, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CoreEntityKind } from '../../domain/entity-kind.js';
import { ARCHIVE_FOLDER_BY_KIND } from '../../domain/markdown/folders.js';
import { parseEntityDocumentRelativePath } from '../../domain/markdown/filename.js';
import type { SecondBrainMeta } from '../../domain/markdown/second-brain-meta.js';
import type { Result } from '../../domain/result.js';
import { err, ok } from '../../domain/result.js';
import {
  activeEntityDocumentPath,
  archivedEntityDocumentPath,
  archivedEntityPackageDir,
  ENTITY_INDEX_DOCUMENT,
} from '../workspace/canonical-layout.js';
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
   * Move a package directory within the workspace (entity folder containing `index.md`).
   */
  async moveEntityPackage(fromRelativeDir: string, toRelativeDir: string): Promise<Result<true, string>> {
    const fromAbs = this.resolvePath(fromRelativeDir);
    const toAbs = this.resolvePath(toRelativeDir);
    try {
      await mkdir(path.dirname(toAbs), { recursive: true });
      await rename(fromAbs, toAbs);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      return err(`move failed: ${detail}`);
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
   * Moves the whole package directory when the source is `.../<slug>/index.md`.
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
    const nextMeta: SecondBrainMeta = {
      ...read.value.meta,
      archived: true,
      archived_at: new Date().toISOString(),
      archive_reason: options?.reason ?? null,
    };
    const { body } = read.value;
    const slug = nextMeta.slug;
    const destDir = archivedEntityPackageDir(kind, slug);
    const newRelative = archivedEntityDocumentPath(kind, slug);
    const norm = relativePath.replace(/\\/g, '/');
    const isPackage = norm.endsWith(`/${ENTITY_INDEX_DOCUMENT}`);

    if (isPackage) {
      const srcPkg = path.dirname(norm);
      const fromAbs = this.resolvePath(srcPkg);
      const toAbs = this.resolvePath(destDir);
      try {
        await mkdir(path.dirname(toAbs), { recursive: true });
        await cp(fromAbs, toAbs, { recursive: true, force: true });
        await writeFile(this.resolvePath(newRelative), serializeMarkdownEntity(nextMeta, body), 'utf8');
        await rm(fromAbs, { recursive: true, force: true });
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        return err(`archive failed: ${detail}`);
      }
      return ok({ newRelativePath: newRelative });
    }

    const written = await this.writeEntity(newRelative, nextMeta, body);
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

    const parsed = parseEntityDocumentRelativePath(archiveRelativePath);
    if ('error' in parsed) {
      return err(parsed.error);
    }
    if (parsed.kind !== kind) {
      return err(`Path kind ${parsed.kind} does not match metadata kind ${kind}`);
    }

    const inboxDate = parsed.kind === 'inbox_item' ? parsed.inboxDate : undefined;
    const newRelative = activeEntityDocumentPath(kind, meta.slug, inboxDate);
    const nextMeta: SecondBrainMeta = {
      ...meta,
      archived: false,
      archived_at: null,
      archive_reason: null,
    };

    const isPackage = norm.endsWith(`/${ENTITY_INDEX_DOCUMENT}`);

    if (isPackage) {
      const srcPkg = path.dirname(norm);
      const destDir = path.dirname(newRelative);
      const fromAbs = this.resolvePath(srcPkg);
      const toAbs = this.resolvePath(destDir);
      try {
        await mkdir(path.dirname(toAbs), { recursive: true });
        await cp(fromAbs, toAbs, { recursive: true, force: true });
        await writeFile(this.resolvePath(newRelative), serializeMarkdownEntity(nextMeta, body), 'utf8');
        await rm(fromAbs, { recursive: true, force: true });
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        return err(`restore failed: ${detail}`);
      }
      return ok({ newRelativePath: newRelative });
    }

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

  /** Build default relative path to the canonical Markdown file for a new active entity. */
  activeEntityPath(
    kind: Exclude<CoreEntityKind, 'archive_record'>,
    slug: string,
    inboxDate?: string,
  ): string {
    return activeEntityDocumentPath(kind, slug, inboxDate);
  }
}

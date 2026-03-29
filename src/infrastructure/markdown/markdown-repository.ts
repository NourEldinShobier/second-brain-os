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



  /** Build default relative path to the canonical Markdown file for a new active entity. */
  activeEntityPath(
    kind: CoreEntityKind,
    slug: string,
    inboxDate?: string,
  ): string {
    return activeEntityDocumentPath(kind, slug, inboxDate);
  }
}

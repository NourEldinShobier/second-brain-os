import type { EntityAssetManifestEntry } from '../domain/markdown/second-brain-meta.js';
import type { Result } from '../domain/result.js';
import { err, ok } from '../domain/result.js';
import type { SecondBrainDb } from '../infrastructure/db/open-database.js';
import type { MarkdownWorkspaceRepository } from '../infrastructure/markdown/markdown-repository.js';
import { findEntityByIdOrSlug, type FoundEntityRow } from '../infrastructure/query/find-entity.js';
import { listBacklinks, listForwardLinks, type EntityLinkRow } from '../infrastructure/relationships/entity-link-queries.js';

export interface ShowDetail {
  readonly row: FoundEntityRow;
  readonly body: string;
  readonly forward: readonly EntityLinkRow[];
  readonly backlinks: readonly EntityLinkRow[];
  /** From front matter manifest (PRD §7.3). */
  readonly assets: readonly EntityAssetManifestEntry[];
}

export async function loadShowDetail(
  db: SecondBrainDb,
  repo: MarkdownWorkspaceRepository,
  ref: string,
  includeArchived: boolean,
): Promise<Result<ShowDetail, string>> {
  const found = findEntityByIdOrSlug(db, ref);
  if (!found.ok) {
    return found;
  }
  if (!includeArchived && found.value.archived) {
    return err('Entity is archived. Pass --include-archived to inspect it.');
  }
  const read = await repo.readEntity(found.value.file_path);
  if (!read.ok) {
    return read;
  }
  return ok({
    row: found.value,
    body: read.value.body,
    forward: listForwardLinks(db, found.value.kind, found.value.id),
    backlinks: listBacklinks(db, found.value.kind, found.value.id),
    assets: read.value.meta.assets ?? [],
  });
}

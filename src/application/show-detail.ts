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
}

export async function loadShowDetail(
  db: SecondBrainDb,
  repo: MarkdownWorkspaceRepository,
  ref: string,
): Promise<Result<ShowDetail, string>> {
  const found = findEntityByIdOrSlug(db, ref);
  if (!found.ok) {
    return found;
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
  });
}

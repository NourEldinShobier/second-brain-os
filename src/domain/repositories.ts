import type { CoreEntityKind } from './entity-kind.js';
import type { CoreEntity } from './core-entities.js';
import type { EntityId, EntitySlug } from './ids.js';
import type { EntityLink } from './relationship.js';
import type { Result } from './result.js';

export interface MarkdownReadResult {
  readonly relativePath: string;
  readonly contents: string;
}

export interface MarkdownRepository {
  /** Read file contents relative to workspace root, if present. */
  readEntityFile(relativePath: string): Promise<Result<MarkdownReadResult, { message: string }>>;

  /** List relative paths under a folder (e.g. `00-inbox/`). */
  listMarkdownUnder(prefix: string): Promise<readonly string[]>;
}

export interface EntityIndexState {
  readonly id: EntityId;
  readonly kind: CoreEntityKind;
  readonly slug: EntitySlug;
  readonly relativePath: string;
  readonly stale: boolean;
}

export interface EntityIndexRepository {
  getById(id: EntityId): Promise<EntityIndexState | null>;
  findBySlug(kind: CoreEntityKind, slug: EntitySlug): Promise<EntityIndexState | null>;
  listByKind(kind: CoreEntityKind): Promise<readonly EntityIndexState[]>;
}

export interface LinkIndexRepository {
  outgoing(id: EntityId): Promise<readonly EntityLink[]>;
  incoming(id: EntityId): Promise<readonly EntityLink[]>;
}

export interface HydratedEntityRepository {
  loadCoreEntity(kind: CoreEntityKind, id: EntityId): Promise<Result<CoreEntity, { message: string }>>;
}

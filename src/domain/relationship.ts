import type { CoreEntityKind } from './entity-kind.js';
import type { EntityId } from './ids.js';

export interface EntityLink {
  readonly id: string;
  readonly fromKind: CoreEntityKind;
  readonly fromId: EntityId;
  readonly toKind: CoreEntityKind;
  readonly toId: EntityId;
  readonly role?: string;
}

import type { CoreEntityKind } from './entity-kind.js';

/** Entity kinds that can be listed from the SQLite index (excludes archive records). */
export type ListableEntityKind = Exclude<CoreEntityKind, 'archive_record'>;

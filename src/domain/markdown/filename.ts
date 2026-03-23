import type { CoreEntityKind } from '../entity-kind.js';

/** Filename prefix segment (before first hyphen of slug segment). */
export const KIND_FILE_PREFIX: Record<Exclude<CoreEntityKind, 'archive_record'>, string> = {
  inbox_item: 'inbox',
  area: 'area',
  goal: 'goal',
  project: 'project',
  task: 'task',
  resource: 'resource',
  note: 'note',
};

const PREFIX_TO_KIND = Object.fromEntries(
  Object.entries(KIND_FILE_PREFIX).map(([k, v]) => [v, k as CoreEntityKind]),
) as Record<string, CoreEntityKind>;

const DATED_INBOX = /^(\d{4}-\d{2}-\d{2})-(.+)\.md$/;
const STANDARD = /^(area|goal|project|task|resource|note|inbox)-(.+)\.md$/;

export type ParsedFilename =
  | {
      readonly kind: CoreEntityKind;
      readonly slug: string;
      readonly inboxDate?: string;
    }
  | { readonly error: string };

/** Build default active filename for an entity (not for archive paths). */
export function buildEntityFilename(
  kind: Exclude<CoreEntityKind, 'archive_record'>,
  slug: string,
  options?: { readonly inboxDate?: string },
): string {
  const prefix = KIND_FILE_PREFIX[kind];
  if (kind === 'inbox_item' && options?.inboxDate !== undefined) {
    return `${options.inboxDate}-${slug}.md`;
  }
  return `${prefix}-${slug}.md`;
}

/** Infer kind + slug from a basename like `area-personal.md`. */
export function parseEntityFilename(basename: string): ParsedFilename {
  const mDate = DATED_INBOX.exec(basename);
  if (mDate?.[1] !== undefined && mDate[2] !== undefined) {
    return { kind: 'inbox_item', slug: mDate[2], inboxDate: mDate[1] };
  }
  const m = STANDARD.exec(basename);
  if (m?.[1] !== undefined && m[2] !== undefined) {
    const prefix = m[1];
    const kind = PREFIX_TO_KIND[prefix];
    if (kind === undefined) {
      return { error: `Unknown prefix: ${prefix}` };
    }
    return { kind, slug: m[2] };
  }
  return { error: `Unrecognized filename pattern: ${basename}` };
}

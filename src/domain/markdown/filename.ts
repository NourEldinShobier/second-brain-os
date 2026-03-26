import type { CoreEntityKind } from '../entity-kind.js';
import { ACTIVE_FOLDER_BY_KIND, ARCHIVE_FOLDER_BY_KIND } from './folders.js';

const ACTIVE_KIND_ROOT_TO_KIND: Record<string, Exclude<CoreEntityKind, 'archive_record'>> = (() => {
  const out: Record<string, Exclude<CoreEntityKind, 'archive_record'>> = {};
  for (const [k, v] of Object.entries(ACTIVE_FOLDER_BY_KIND)) {
    if (k === 'archive_record') continue;
    out[v] = k as Exclude<CoreEntityKind, 'archive_record'>;
  }
  return out;
})();

const ARCHIVE_ROOT_TO_KIND: Record<string, Exclude<CoreEntityKind, 'archive_record'>> = Object.fromEntries(
  Object.entries(ARCHIVE_FOLDER_BY_KIND).map(([k, v]) => [v, k as Exclude<CoreEntityKind, 'archive_record'>]),
) as Record<string, Exclude<CoreEntityKind, 'archive_record'>>;

const INBOX_FOLDER_SEGMENT_DATED = /^(\d{4}-\d{2}-\d{2})-(.+)$/;
const ENTITY_INDEX_DOCUMENT = 'index.md';

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

/**
 * Parse workspace-relative paths for core entities: package `.../<slug>/index.md`, dated inbox folders,
 * or legacy single-file `prefix-slug.md` layouts.
 */
export function parseEntityDocumentRelativePath(relPath: string): ParsedFilename | { readonly error: string } {
  const norm = relPath.replace(/\\/g, '/');
  const parts = norm.split('/').filter(Boolean);
  if (parts.length < 2) {
    return { error: 'Path too short' };
  }
  const last = parts[parts.length - 1] ?? '';

  if (last === ENTITY_INDEX_DOCUMENT) {
    if (parts.length < 3) {
      return { error: 'Invalid entity package path' };
    }
    const segment = parts[parts.length - 2];
    if (segment === undefined) {
      return { error: 'Invalid entity package path' };
    }
    const head = parts[0];
    if (head === '99-archive') {
      if (parts.length < 4) {
        return { error: 'Archive package path too short' };
      }
      const arc0 = parts[0];
      const arc1 = parts[1];
      if (arc0 === undefined || arc1 === undefined) {
        return { error: 'Archive package path too short' };
      }
      const archiveRoot = `${arc0}/${arc1}`;
      const kind = ARCHIVE_ROOT_TO_KIND[archiveRoot];
      if (kind === undefined) {
        return { error: `Unknown archive root: ${archiveRoot}` };
      }
      if (kind === 'inbox_item') {
        const m = INBOX_FOLDER_SEGMENT_DATED.exec(segment);
        if (m?.[1] !== undefined && m[2] !== undefined) {
          return { kind: 'inbox_item', slug: m[2], inboxDate: m[1] };
        }
        if (segment.startsWith('inbox-')) {
          return { kind: 'inbox_item', slug: segment.slice('inbox-'.length) };
        }
        return { kind: 'inbox_item', slug: segment };
      }
      return { kind, slug: segment };
    }
    if (head === undefined) {
      return { error: 'Invalid path' };
    }
    const kindRoot = head;
    const kind = ACTIVE_KIND_ROOT_TO_KIND[kindRoot];
    if (kind === undefined) {
      return { error: `Unknown active root: ${kindRoot}` };
    }
    if (kind === 'inbox_item') {
      const m = INBOX_FOLDER_SEGMENT_DATED.exec(segment);
      if (m?.[1] !== undefined && m[2] !== undefined) {
        return { kind: 'inbox_item', slug: m[2], inboxDate: m[1] };
      }
      if (segment.startsWith('inbox-')) {
        return { kind: 'inbox_item', slug: segment.slice('inbox-'.length) };
      }
      return { kind: 'inbox_item', slug: segment };
    }
    return { kind, slug: segment };
  }

  const parsed = parseEntityFilename(last);
  if ('error' in parsed) {
    return parsed;
  }
  if (parts.length === 2) {
    const kindRoot = parts[0];
    if (kindRoot === undefined) {
      return { error: 'Invalid path' };
    }
    const expectedKind = ACTIVE_KIND_ROOT_TO_KIND[kindRoot];
    if (expectedKind === undefined || expectedKind !== parsed.kind) {
      const gotKind: CoreEntityKind = parsed.kind;
      return { error: `Kind root ${kindRoot} does not match file kind ${gotKind}` };
    }
    return parsed;
  }
  if (parts.length === 3 && parts[0] === '99-archive') {
    const ar1 = parts[1];
    if (ar1 === undefined) {
      return { error: 'Invalid archive path' };
    }
    const archiveRoot = `99-archive/${ar1}`;
    const expectedKind = ARCHIVE_ROOT_TO_KIND[archiveRoot];
    if (expectedKind === undefined || expectedKind !== parsed.kind) {
      return { error: `Archive path kind mismatch for ${archiveRoot}` };
    }
    return parsed;
  }
  return { error: `Unrecognized entity path shape: ${relPath}` };
}

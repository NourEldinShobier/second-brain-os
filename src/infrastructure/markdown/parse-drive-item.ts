import matter from 'gray-matter';
import type { Result } from '../../domain/result.js';
import { err, ok } from '../../domain/result.js';
import {
  DRIVE_FRONTMATTER_ROOT_KEY,
  type DriveItemMeta,
  driveItemMetaSchema,
} from '../../domain/drive/drive-item-meta.js';

export interface ParsedDriveItem {
  readonly meta: DriveItemMeta;
  readonly body: string;
}

export function parseDriveItemDocument(raw: string): Result<ParsedDriveItem, string> {
  const m = matter(raw);
  const body = m.content.replace(/^\n+/, '');
  const root = m.data as Record<string, unknown> | undefined;
  const di = root?.[DRIVE_FRONTMATTER_ROOT_KEY];
  const parsed = driveItemMetaSchema.safeParse(di);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'drive_item'}: ${i.message}`).join('; ');
    return err(`Invalid drive item front matter: ${msg}`);
  }
  return ok({ meta: parsed.data, body });
}

function stripUndefinedRecord<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as T;
}

export function serializeDriveItem(meta: DriveItemMeta, body: string): string {
  const trimmedBody = body.replace(/\s+$/u, '');
  const data = stripUndefinedRecord({ ...meta }) as DriveItemMeta;
  return matter.stringify(trimmedBody, { [DRIVE_FRONTMATTER_ROOT_KEY]: data });
}

import matter from 'gray-matter';
import type { Result } from '../../domain/result.js';
import { err, ok } from '../../domain/result.js';
import {
  FRONTMATTER_ROOT_KEY,
  type SecondBrainMeta,
  secondBrainMetaSchema,
} from '../../domain/markdown/second-brain-meta.js';

export interface ParsedMarkdownEntity {
  readonly meta: SecondBrainMeta;
  readonly body: string;
}

export function parseMarkdownEntity(raw: string): Result<ParsedMarkdownEntity, string> {
  const m = matter(raw);
  const body = m.content.replace(/^\n+/, '');
  const root = m.data as Record<string, unknown> | undefined;
  const sb = root?.[FRONTMATTER_ROOT_KEY];
  const parsed = secondBrainMetaSchema.safeParse(sb);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'second_brain'}: ${i.message}`).join('; ');
    return err(`Invalid front matter: ${msg}`);
  }
  return ok({ meta: parsed.data, body });
}

export function serializeMarkdownEntity(meta: SecondBrainMeta, body: string): string {
  const trimmedBody = body.replace(/\s+$/u, '');
  return matter.stringify(trimmedBody, { [FRONTMATTER_ROOT_KEY]: meta });
}

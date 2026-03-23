import { randomUUID } from 'node:crypto';
import type { CaptureService, CaptureReceipt, CaptureError } from '../domain/services.js';
import type { Result } from '../domain/result.js';
import { err, ok } from '../domain/result.js';
import { isValidSlug, slugifyTitle } from '../domain/markdown/slug.js';
import { EntityCrudService } from './entity-crud-service.js';

function deriveCaptureTitle(text: string): string {
  const line = text.split(/\r?\n/u)[0]?.trim() ?? '';
  if (line.length === 0) {
    return 'Inbox capture';
  }
  return line.length > 120 ? `${line.slice(0, 117)}...` : line;
}

/** Fast path: freeform text → inbox Markdown + SQLite index (no classification required). */
export class MarkdownCaptureService implements CaptureService {
  constructor(private readonly entities: EntityCrudService) {}

  async captureRaw(input: { readonly text: string }): Promise<Result<CaptureReceipt, CaptureError>> {
    const text = input.text.trim();
    if (text.length === 0) {
      return err({ message: 'Capture text cannot be empty' });
    }
    const title = deriveCaptureTitle(text);
    const slug = `${slugifyTitle(title)}-${randomUUID().slice(0, 8)}`;
    if (!isValidSlug(slug)) {
      return err({ message: `Invalid derived slug: ${slug}` });
    }
    const r = await this.entities.createInboxItem({
      title,
      slug,
      body: text,
    });
    if (!r.ok) {
      return err({ message: r.error });
    }
    return ok({
      inboxItemId: r.value.meta.id,
      slug: r.value.meta.slug,
      relativePath: r.value.path,
      title: r.value.meta.title,
    });
  }
}

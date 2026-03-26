import { describe, expect, it } from 'vitest';
import { parseMarkdownEntity, serializeMarkdownEntity } from './parse-document.js';

const sample = `---
second_brain:
  id: "11111111-1111-4111-8111-111111111111"
  kind: area
  version: 1
  slug: personal
  title: Personal
  status: active
  archived: false
---

Hello **world**.
`;

describe('parseMarkdownEntity', () => {
  it('parses and round-trips', () => {
    const a = parseMarkdownEntity(sample);
    expect(a.ok).toBe(true);
    if (!a.ok) {
      return;
    }
    expect(a.value.meta.slug).toBe('personal');
    expect(a.value.body.trim()).toBe('Hello **world**.');
    const out = serializeMarkdownEntity(a.value.meta, a.value.body);
    const b = parseMarkdownEntity(out);
    expect(b.ok).toBe(true);
    if (b.ok) {
      expect(b.value.meta.id).toBe(a.value.meta.id);
      expect(b.value.meta.slug).toBe(a.value.meta.slug);
    }
  });

  it('round-trips entity asset manifest entries', () => {
    const raw = `---
second_brain:
  id: "22222222-2222-4222-8222-222222222222"
  kind: task
  version: 1
  slug: demo
  title: Demo
  status: next
  archived: false
  assets:
    - id: "33333333-3333-4333-8333-333333333333"
      path: "assets/a.png"
      original_filename: "a.png"
      mime_type: "image/png"
      imported_at: "2026-01-01T00:00:00.000Z"
      title: "Screenshot"
      sha256: "abc"
---

Body.
`;
    const a = parseMarkdownEntity(raw);
    expect(a.ok).toBe(true);
    if (!a.ok) return;
    expect(a.value.meta.assets?.length).toBe(1);
    expect(a.value.meta.assets?.[0]?.path).toBe('assets/a.png');
    const out = serializeMarkdownEntity(a.value.meta, a.value.body);
    const b = parseMarkdownEntity(out);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.value.meta.assets?.length).toBe(1);
    expect(b.value.meta.assets?.[0]?.id).toBe('33333333-3333-4333-8333-333333333333');
  });
});

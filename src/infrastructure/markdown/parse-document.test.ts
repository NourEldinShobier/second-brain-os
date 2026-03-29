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


});

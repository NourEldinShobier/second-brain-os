import { describe, expect, it } from 'vitest';
import { analyzeInboxText } from './inbox-heuristics.js';

describe('analyzeInboxText', () => {
  it('treats http(s) URLs as resource', () => {
    const r = analyzeInboxText('Read https://example.com/doc');
    expect(r.likelyKind).toBe('resource');
    expect(r.confidence).toBe('high');
  });

  it('treats action-prefixed lines as task', () => {
    const r = analyzeInboxText('call dentist about cleaning');
    expect(r.likelyKind).toBe('task');
    expect(r.confidence).toBe('medium');
  });

  it('treats short single-line text as note', () => {
    const r = analyzeInboxText('Quick idea for later');
    expect(r.likelyKind).toBe('note');
  });

  it('keeps ambiguous multi-line content in inbox', () => {
    const r = analyzeInboxText('Line one\nLine two\nLine three');
    expect(r.likelyKind).toBe('inbox_item');
  });
});

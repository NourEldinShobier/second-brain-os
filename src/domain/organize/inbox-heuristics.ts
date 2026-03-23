export type HeuristicConfidence = 'high' | 'medium' | 'low';

/** Likely promotion target from raw inbox text (no AI). */
export type LikelyPromotedKind = 'task' | 'resource' | 'note' | 'inbox_item';

export interface InboxHeuristicResult {
  readonly likelyKind: LikelyPromotedKind;
  readonly confidence: HeuristicConfidence;
  readonly reasons: readonly string[];
}

/**
 * Deterministic inbox triage: URLs → resource, action verbs → task, short lines → note,
 * otherwise stay in inbox with low confidence.
 */
export function analyzeInboxText(text: string): InboxHeuristicResult {
  const t = text.trim();
  const lower = t.toLowerCase();
  const firstLine = t.split(/\r?\n/u)[0]?.trim() ?? '';

  if (/https?:\/\//u.test(t)) {
    return {
      likelyKind: 'resource',
      confidence: 'high',
      reasons: ['Contains an http(s) URL — likely a bookmark or reference'],
    };
  }

  if (/^(todo|fix|call|buy|email|schedule|remind|pay|order)\b/iu.test(lower)) {
    return {
      likelyKind: 'task',
      confidence: 'medium',
      reasons: ['Starts with a common action verb'],
    };
  }

  if (firstLine.length > 0 && firstLine.length <= 80 && !t.includes('\n')) {
    return {
      likelyKind: 'note',
      confidence: 'low',
      reasons: ['Short single-line capture — could be a quick note'],
    };
  }

  return {
    likelyKind: 'inbox_item',
    confidence: 'low',
    reasons: ['No strong pattern — keep in inbox until you decide'],
  };
}

import type { SecondBrainMeta } from '../markdown/second-brain-meta.js';
import type { Result } from '../result.js';
import { err, ok } from '../result.js';

/** PRD: goals and projects must be anchored to at least one area. */
export function validateRelationshipInvariants(meta: SecondBrainMeta): Result<true, string> {
  if (meta.kind === 'goal') {
    const n = meta.area_ids?.length ?? 0;
    if (n < 1) {
      return err('goal requires at least one area in area_ids');
    }
  }
  if (meta.kind === 'project') {
    const n = meta.area_ids?.length ?? 0;
    if (n < 1) {
      return err('project requires at least one area in area_ids');
    }
  }
  return ok(true);
}

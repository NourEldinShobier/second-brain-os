/** Categories used by reindex/doctor (PRD-aligned, additive). */
export type DriftCategory =
  | 'unreadable_frontmatter'
  | 'duplicate_stable_id'
  | 'missing_file'
  | 'orphan_file'
  | 'invalid_reference';

export interface DriftItem {
  readonly category: DriftCategory;
  readonly path?: string;
  readonly id?: string;
  readonly message: string;
  readonly detail?: Readonly<Record<string, unknown>>;
}

export interface ReindexResult {
  readonly indexedFiles: number;
  readonly drift: readonly DriftItem[];
}

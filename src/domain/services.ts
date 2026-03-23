import type { AiProviderId } from './ai-provider.js';
import type { CoreEntityKind } from './entity-kind.js';
import type { EntityId, EntitySlug } from './ids.js';
import type { Result } from './result.js';
import type { WorkspacePaths } from './workspace.js';

export type WorkspaceResolveError =
  | { readonly kind: 'missing_workspace'; readonly message: string }
  | { readonly kind: 'missing_db'; readonly message: string };

export interface WorkspaceService {
  resolveWorkspace(): Promise<Result<WorkspacePaths, WorkspaceResolveError>>;
}

export interface CaptureReceipt {
  readonly inboxItemId: EntityId;
  readonly slug: EntitySlug;
  /** Workspace-relative path to the Markdown file. */
  readonly relativePath: string;
  readonly title: string;
}

export type CaptureError = { readonly message: string };

export interface CaptureService {
  captureRaw(input: { readonly text: string }): Promise<Result<CaptureReceipt, CaptureError>>;
}

export interface OrganizeService {
  promoteInboxItem(id: EntityId): Promise<Result<{ entityId: EntityId; kind: CoreEntityKind }, { message: string }>>;
}

export interface TodaySurface {
  readonly generatedAt: string;
  readonly summary: string;
}

export interface DashboardService {
  buildToday(): Promise<Result<TodaySurface, { message: string }>>;
  buildDashboardHome(): Promise<Result<{ readonly markdown: string }, { message: string }>>;
}

export interface ListQuery {
  readonly kind: CoreEntityKind;
  readonly status?: string;
  readonly limit?: number;
  /** When false/undefined, exclude archived entities (default for CLI list). */
  readonly includeArchived?: boolean;
}

export interface QueryService {
  listEntities(q: ListQuery): Promise<Result<readonly EntityId[], { message: string }>>;
  showEntity(kind: CoreEntityKind, slug: EntitySlug): Promise<Result<unknown, { message: string }>>;
  search(q: { readonly text: string }): Promise<Result<readonly EntityId[], { message: string }>>;
}

export interface ReviewService {
  runWeekly(): Promise<Result<{ readonly artifactPath: string }, { message: string }>>;
}

export interface ArchiveService {
  archive(kind: CoreEntityKind, slug: EntitySlug): Promise<Result<true, { message: string }>>;
  restore(archiveId: EntityId): Promise<Result<true, { message: string }>>;
}

export interface DoctorReport {
  readonly checks: readonly { readonly name: string; readonly ok: boolean; readonly detail?: string }[];
}

export interface DoctorService {
  runDoctor(): Promise<Result<DoctorReport, { message: string }>>;
}

/** Result of an AI-assisted explanation (provider-agnostic). */
export interface AiExplainResult {
  readonly text: string;
  readonly confidence?: number;
  readonly rationale?: string;
}

/**
 * Provider-agnostic AI boundary. Core flows must not require a live model; use
 * `createAiService` from infrastructure for concrete implementations.
 */
export interface AiService {
  /** `disabled` — no provider configured. `stub` — placeholder adapter. `degraded` — provider error / fallback. */
  readonly mode: 'disabled' | 'stub' | 'degraded';
  readonly providerId: AiProviderId | null;
  explain(input: { readonly text: string }): Promise<Result<AiExplainResult, { message: string }>>;
}

export interface ConfigSnapshot {
  readonly raw: string;
}

export interface ConfigService {
  read(): Promise<Result<ConfigSnapshot, { message: string }>>;
  update(patch: Record<string, unknown>): Promise<Result<ConfigSnapshot, { message: string }>>;
}

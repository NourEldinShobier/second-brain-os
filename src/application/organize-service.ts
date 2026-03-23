import { unlink } from 'node:fs/promises';
import { desc, eq } from 'drizzle-orm';
import { analyzeInboxText } from '../domain/organize/inbox-heuristics.js';
import type { SecondBrainMeta } from '../domain/markdown/second-brain-meta.js';
import type { Result } from '../domain/result.js';
import { err, ok } from '../domain/result.js';
import type { SecondBrainDb } from '../infrastructure/db/open-database.js';
import * as schema from '../infrastructure/db/schema.js';
import type { MarkdownWorkspaceRepository } from '../infrastructure/markdown/markdown-repository.js';
import { resolveAreaIds, resolveProjectIds } from '../infrastructure/relationships/resolve-entity-ref.js';
import type { EntityCrudService } from './entity-crud-service.js';

export type PromoteTargetKind = 'area' | 'task' | 'note' | 'resource' | 'goal' | 'project';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function isUuid(s: string): boolean {
  return UUID_RE.test(s.trim());
}

export function findInboxRow(db: SecondBrainDb, ref: string): Result<typeof schema.inboxItems.$inferSelect, string> {
  const r = ref.trim();
  if (r.length === 0) {
    return err('Empty inbox reference');
  }
  if (isUuid(r)) {
    const row = db.select().from(schema.inboxItems).where(eq(schema.inboxItems.id, r)).get();
    return row ? ok(row) : err(`Inbox item not found: ${r}`);
  }
  const rows = db.select().from(schema.inboxItems).where(eq(schema.inboxItems.slug, r)).all();
  if (rows.length === 0) {
    return err(`Inbox item not found: ${r}`);
  }
  if (rows.length > 1) {
    return err(`Ambiguous inbox slug "${r}" — use the stable id from \`second-brain-os list inbox\`.`);
  }
  const row = rows[0];
  if (row === undefined) {
    return err(`Inbox item not found: ${r}`);
  }
  return ok(row);
}

export async function analyzeInboxItems(
  db: SecondBrainDb,
  repo: MarkdownWorkspaceRepository,
  limit: number,
): Promise<
  readonly {
    readonly id: string;
    readonly slug: string;
    readonly file_path: string;
    readonly title: string;
    readonly heuristic: ReturnType<typeof analyzeInboxText>;
  }[]
> {
  const cap = Math.min(Math.max(limit, 1), 200);
  const rows = db
    .select()
    .from(schema.inboxItems)
    .orderBy(desc(schema.inboxItems.updated_at))
    .limit(cap)
    .all();
  const out: {
    id: string;
    slug: string;
    file_path: string;
    title: string;
    heuristic: ReturnType<typeof analyzeInboxText>;
  }[] = [];
  for (const row of rows) {
    const read = await repo.readEntity(row.file_path);
    const text = read.ok ? `${read.value.meta.title}\n${read.value.body}` : row.title;
    out.push({
      id: row.id,
      slug: row.slug,
      file_path: row.file_path,
      title: row.title,
      heuristic: analyzeInboxText(text),
    });
  }
  return out;
}

export async function promoteInboxItem(
  db: SecondBrainDb,
  repo: MarkdownWorkspaceRepository,
  entities: EntityCrudService,
  input: {
    readonly fromRef: string;
    readonly toKind: PromoteTargetKind;
    readonly areaRefs?: readonly string[];
    readonly projectRefs?: readonly string[];
  },
): Promise<Result<{ readonly path: string; readonly id: string; readonly kind: string }, string>> {
  const inboxRow = findInboxRow(db, input.fromRef);
  if (!inboxRow.ok) {
    return inboxRow;
  }
  const parsed = await repo.readEntity(inboxRow.value.file_path);
  if (!parsed.ok) {
    return parsed;
  }
  const { meta, body } = parsed.value;
  const title = meta.title;
  const to = input.toKind;

  let created: Result<{ readonly path: string; readonly meta: SecondBrainMeta }, string>;

  if (to === 'area') {
    created = await entities.createArea({ title, ...(body ? { body } : {}) });
  } else if (to === 'note') {
    created = await entities.createNote({ title, ...(body ? { body } : {}) });
  } else if (to === 'resource') {
    const urlMatch = body.match(/https?:\/\/\S+/u);
    created = await entities.createResource({
      title,
      ...(body ? { body } : {}),
      ...(urlMatch ? { sourceUrl: urlMatch[0] } : {}),
    });
  } else if (to === 'task') {
    const areaIds =
      input.areaRefs !== undefined && input.areaRefs.length > 0
        ? resolveAreaIds(db, input.areaRefs)
        : ok([] as readonly string[]);
    if (!areaIds.ok) {
      return err(areaIds.error);
    }
    const projectIds =
      input.projectRefs !== undefined && input.projectRefs.length > 0
        ? resolveProjectIds(db, input.projectRefs)
        : ok([] as readonly string[]);
    if (!projectIds.ok) {
      return err(projectIds.error);
    }
    created = await entities.createTask({
      title,
      ...(body ? { body } : {}),
      ...(areaIds.value.length > 0 ? { areaIds: areaIds.value } : {}),
      ...(projectIds.value.length > 0 ? { projectIds: projectIds.value } : {}),
    });
  } else if (to === 'goal') {
    const areas = resolveAreaIds(db, input.areaRefs ?? []);
    if (!areas.ok) {
      return err(areas.error);
    }
    if (areas.value.length < 1) {
      return err('goal promotion requires at least one --area');
    }
    created = await entities.createGoal({ title, areaIds: areas.value, ...(body ? { body } : {}) });
  } else {
    const areas = resolveAreaIds(db, input.areaRefs ?? []);
    if (!areas.ok) {
      return err(areas.error);
    }
    if (areas.value.length < 1) {
      return err('project promotion requires at least one --area');
    }
    created = await entities.createProject({ title, areaIds: areas.value, ...(body ? { body } : {}) });
  }

  if (!created.ok) {
    return created;
  }

  try {
    await unlink(repo.resolvePath(inboxRow.value.file_path));
  } catch (e) {
    return err(`Created entity but could not remove inbox file: ${e instanceof Error ? e.message : String(e)}`);
  }

  db.delete(schema.inboxItems).where(eq(schema.inboxItems.id, inboxRow.value.id)).run();

  return ok({
    path: created.value.path,
    id: created.value.meta.id,
    kind: created.value.meta.kind,
  });
}

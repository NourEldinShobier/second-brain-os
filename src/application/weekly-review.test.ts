import { readFile } from 'node:fs/promises';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { openAndMigrate } from '../infrastructure/db/open-database.js';
import * as schema from '../infrastructure/db/schema.js';
import { ensureCanonicalLayout } from '../infrastructure/workspace/create-layout.js';
import { buildWeeklyReviewReport, persistWeeklyReview, renderWeeklyReviewMarkdown } from './weekly-review.js';

describe('weekly review', () => {
  it('renderWeeklyReviewMarkdown includes heading for the report date', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-wr-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);

    const model = buildWeeklyReviewReport(db, new Date(2026, 5, 1));
    const md = renderWeeklyReviewMarkdown(model);
    expect(md).toContain('# Weekly review (2026-06-01)');
  });

  it('persistWeeklyReview writes artifact and inserts a reviews row', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'sb-wr-save-'));
    await ensureCanonicalLayout(root);
    const dbPath = path.join(root, '.second-brain', 'second-brain.db');
    await mkdir(path.dirname(dbPath), { recursive: true });
    const db = openAndMigrate(dbPath);

    const saved = await persistWeeklyReview(root, db, { asOf: new Date(2026, 7, 10) });
    expect(saved.ok).toBe(true);
    if (!saved.ok) {
      return;
    }

    expect(saved.value.artifactRelativePath).toMatch(/^07-reviews\/weekly\/2026-08-10-weekly-review\.md$/u);

    const text = await readFile(path.join(root, saved.value.artifactRelativePath), 'utf8');
    expect(text).toContain('# Weekly review (2026-08-10)');

    const rows = db.select().from(schema.reviews).where(eq(schema.reviews.id, saved.value.reviewId)).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.review_kind).toBe('weekly');
  });
});

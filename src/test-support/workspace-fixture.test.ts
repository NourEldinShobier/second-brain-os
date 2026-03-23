import { describe, expect, it } from 'vitest';
import * as schema from '../infrastructure/db/schema.js';
import { createTestWorkspace } from './workspace-fixture.js';

describe('createTestWorkspace', () => {
  it('produces independent roots and queryable databases', async () => {
    const a = await createTestWorkspace();
    const b = await createTestWorkspace();
    try {
      expect(a.root).not.toBe(b.root);
      a.db.insert(schema.workspaceKv).values({ key: 'a', value: '1' }).run();
      b.db.insert(schema.workspaceKv).values({ key: 'a', value: '2' }).run();
      expect(a.db.select().from(schema.workspaceKv).get()?.value).toBe('1');
      expect(b.db.select().from(schema.workspaceKv).get()?.value).toBe('2');
    } finally {
      await a.cleanup();
      await b.cleanup();
    }
  });
});

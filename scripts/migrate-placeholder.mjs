#!/usr/bin/env node
/**
 * CLI migrations run via Drizzle when the workspace DB is bootstrapped (`init`, `bootstrapWorkspaceDatabase`).
 * Keeps `npm run migrate` as a discoverable script.
 */
console.log(
  '[second-brain] migrate: Drizzle migrations apply on workspace DB bootstrap.',
  '\n',
  'Regenerate SQL from schema: npm run db:generate',
  '\n',
);

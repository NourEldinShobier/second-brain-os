#!/usr/bin/env node
/**
 * Build then run the CLI with forwarded args (cross-platform).
 * Usage: npm run dev:run -- --help
 *        npm run dev:run -- doctor --format json --workspace ./tmp-vault
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'dist', 'cli', 'index.js');
const userArgs = process.argv.slice(2);

const build = spawnSync('npm', ['run', 'build'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});
if (build.status !== 0) {
  process.exit(build.status ?? 1);
}
if (build.error) {
  console.error(build.error);
  process.exit(1);
}

const run = spawnSync(process.execPath, [cli, ...userArgs], {
  cwd: root,
  stdio: 'inherit',
});
process.exit(run.status ?? (run.error ? 1 : 0));

#!/usr/bin/env node
/**
 * Build then run the CLI with forwarded args (cross-platform).
 * Usage: npm run dev:run -- --help
 *        npm run dev:run -- doctor --format json --workspace ./tmp-vault
 *
 * Skip build (use existing dist/): --no-build as first arg, or SECOND_BRAIN_DEV_SKIP_BUILD=1
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, 'dist', 'cli', 'index.js');
let userArgs = process.argv.slice(2);

let skipBuild = process.env.SECOND_BRAIN_DEV_SKIP_BUILD === '1';
if (userArgs[0] === '--no-build') {
  skipBuild = true;
  userArgs = userArgs.slice(1);
}

if (!skipBuild) {
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
} else if (!existsSync(cli)) {
  console.error(
    'dist/cli/index.js not found. Run `npm run build` once, or run without --no-build / SECOND_BRAIN_DEV_SKIP_BUILD.',
  );
  process.exit(1);
}

const run = spawnSync(process.execPath, [cli, ...userArgs], {
  cwd: root,
  stdio: 'inherit',
});
process.exit(run.status ?? (run.error ? 1 : 0));

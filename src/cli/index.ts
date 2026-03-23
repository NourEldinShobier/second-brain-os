#!/usr/bin/env node
import { runCli } from './run.js';

runCli(process.argv).catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});

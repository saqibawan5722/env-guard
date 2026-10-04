#!/usr/bin/env node

const { runCli } = require('../src/cli/index');

runCli().then(exitCode => {
  if (typeof exitCode === 'number' && exitCode !== 0) {
    process.exit(exitCode);
  }
}).catch(err => {
  console.error('\x1b[31mUnexpected Error in Env-Guard:\x1b[0m', err);
  process.exit(1);
});

const path = require('path');
const fs = require('fs');

const testFiles = [
  './env-parser.test.js',
  './scanner.test.js',
  './drift.test.js',
  './secrets.test.js',
  './server.test.js'
];

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

global.assert = {
  strictEqual(actual, expected, msg) {
    if (actual !== expected) {
      throw new Error(msg || `Assertion failed: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
  },
  deepStrictEqual(actual, expected, msg) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) {
      throw new Error(msg || `Deep assertion failed: expected ${e}, got ${a}`);
    }
  },
  ok(val, msg) {
    if (!val) throw new Error(msg || `Expected truthy value, got ${val}`);
  }
};

global.test = async function(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err) {
    failedTests++;
    console.log(`  \x1b[31m✕\x1b[0m ${name}`);
    console.error(`    \x1b[31m${err.message}\x1b[0m`);
  }
};

global.describe = async function(suiteName, fn) {
  console.log(`\n\x1b[1m\x1b[36m▶ ${suiteName}\x1b[0m`);
  await fn();
};

async function run() {
  console.log('\x1b[1m🛡️  Running Env-Guard Test Suite...\x1b[0m');

  for (const file of testFiles) {
    require(path.join(__dirname, file));
  }

  // Small delay for async test logs
  setTimeout(() => {
    console.log('\n----------------------------------------');
    console.log(`Total:  ${totalTests}`);
    console.log(`Passed: \x1b[32m${passedTests}\x1b[0m`);
    console.log(`Failed: ${failedTests > 0 ? `\x1b[31m${failedTests}\x1b[0m` : '0'}`);
    console.log('----------------------------------------\n');

    if (failedTests > 0) {
      process.exit(1);
    }
  }, 100);
}

run();

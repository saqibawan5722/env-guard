const fs = require('fs');
const path = require('path');
const { colors } = require('./logger');

/**
 * Install Git pre-commit hook in the current repository.
 */
function installPreCommitHook(targetDir = process.cwd()) {
  const gitDir = path.join(targetDir, '.git');
  if (!fs.existsSync(gitDir)) {
    return {
      success: false,
      message: 'No .git directory found. Please run "git init" first.'
    };
  }

  const hooksDir = path.join(gitDir, 'hooks');
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  const hookPath = path.join(hooksDir, 'pre-commit');
  const hookScript = `#!/bin/sh
# Env-Guard Pre-Commit Hook
# Prevents committing code with missing environment variables or exposed secrets

echo "🛡️  Running Env-Guard pre-commit check..."
npx env-guard check --strict

if [ $? -ne 0 ]; then
  echo "❌ Env-Guard audit failed! Fix missing env vars or secret leaks before committing."
  echo "💡 Tip: Run 'npx env-guard sync' to fix missing variables or 'npx env-guard ui' for dashboard."
  exit 1
fi

echo "✅ Env-Guard check passed!"
exit 0
`;

  try {
    fs.writeFileSync(hookPath, hookScript, { mode: 0o755 });
    return {
      success: true,
      hookPath,
      message: 'Successfully installed Env-Guard pre-commit hook into .git/hooks/pre-commit'
    };
  } catch (err) {
    return {
      success: false,
      message: `Failed to write pre-commit hook: ${err.message}`
    };
  }
}

module.exports = {
  installPreCommitHook
};

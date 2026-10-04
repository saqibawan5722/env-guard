const fs = require('fs');
const path = require('path');
const { parseEnv, serializeEnv } = require('./env-parser');
const { inferVariableType } = require('./type-inferrer');

/**
 * Synchronize missing variables into a target env file.
 * @param {string} targetFilePath - Absolute or relative path to target .env file
 * @param {Array<string>} keysToAdd - Array of variable keys to add
 * @param {Object} options - { mode: 'example'|'target', dryRun: boolean, customValues: Record<string, string> }
 */
function syncEnvFile(targetFilePath, keysToAdd, options = {}) {
  const isExample = options.mode === 'example' || path.basename(targetFilePath).includes('.example');
  const dryRun = !!options.dryRun;
  const customValues = options.customValues || {};

  let fileContent = '';
  let exists = false;

  if (fs.existsSync(targetFilePath)) {
    fileContent = fs.readFileSync(targetFilePath, 'utf8');
    exists = true;
  }

  const parsed = parseEnv(fileContent);
  const existingKeys = new Set(Object.keys(parsed.values));

  const additions = [];
  for (const key of keysToAdd) {
    if (existingKeys.has(key)) continue;

    const inferred = inferVariableType(key);
    let valueToSet = '';

    if (customValues[key] !== undefined) {
      valueToSet = customValues[key];
    } else if (isExample) {
      valueToSet = inferred.example || inferred.default;
    } else {
      valueToSet = inferred.default;
    }

    additions.push({
      key,
      value: valueToSet,
      comment: `Added by Env-Guard (${inferred.description})`
    });
  }

  if (additions.length === 0) {
    return {
      filePath: targetFilePath,
      addedKeys: [],
      updatedContent: fileContent,
      changed: false
    };
  }

  let updatedContent = fileContent;
  if (updatedContent && !updatedContent.endsWith('\n')) {
    updatedContent += '\n';
  }

  if (updatedContent.length > 0 && !updatedContent.endsWith('\n\n')) {
    updatedContent += '\n';
  }

  updatedContent += `# --- Added by Env-Guard on ${new Date().toLocaleDateString()} ---\n`;
  for (const item of additions) {
    const formattedVal = item.value.includes(' ') || item.value.includes('#') ? `"${item.value}"` : item.value;
    updatedContent += `${item.key}=${formattedVal} # ${item.comment}\n`;
  }

  if (!dryRun) {
    fs.writeFileSync(targetFilePath, updatedContent, 'utf8');
  }

  return {
    filePath: targetFilePath,
    addedKeys: additions.map(a => a.key),
    additions,
    updatedContent,
    changed: true,
    created: !exists
  };
}

module.exports = {
  syncEnvFile
};

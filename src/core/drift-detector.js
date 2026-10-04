const fs = require('fs');
const path = require('path');
const { scanDirectory } = require('./scanner');
const { readEnvFile } = require('./env-parser');
const { checkSecret } = require('./secret-checker');
const { inferVariableType } = require('./type-inferrer');

/**
 * Discover all .env* files in target directory.
 */
function findEnvFiles(dirPath) {
  try {
    const files = fs.readdirSync(dirPath);
    return files
      .filter(f => f === '.env' || (f.startsWith('.env.') && !f.endsWith('.swp') && !f.endsWith('~')))
      .map(f => path.join(dirPath, f));
  } catch {
    return [];
  }
}

/**
 * Main Audit & Drift Detection Function.
 * @param {string} projectDir - Project root folder
 * @param {Object} options - { targetEnvFile, exampleFile, ignoreKeys }
 */
function auditProject(projectDir = process.cwd(), options = {}) {
  const dir = path.resolve(projectDir);
  const targetEnvName = options.targetEnvFile || '.env';
  const exampleEnvName = options.exampleFile || '.env.example';
  const ignoreKeys = new Set(options.ignoreKeys || ['NODE_ENV']);

  // 1. Scan Code AST
  const scanResult = scanDirectory(dir, options);
  const codeKeys = scanResult.uniqueKeys.filter(k => !ignoreKeys.has(k));

  // 2. Discover & parse all .env* files
  const envFilePaths = findEnvFiles(dir);
  const envFiles = {}; // Record<fileName, { filePath, entries, values, fileName }>

  for (const envPath of envFilePaths) {
    const parsed = readEnvFile(envPath);
    if (parsed) {
      envFiles[parsed.fileName] = parsed;
    }
  }

  // Identify specific key files
  const mainEnv = envFiles[targetEnvName] || null;
  const exampleEnv = envFiles[exampleEnvName] || null;

  const mainEnvKeys = mainEnv ? Object.keys(mainEnv.values).filter(k => !ignoreKeys.has(k)) : [];
  const exampleEnvKeys = exampleEnv ? Object.keys(exampleEnv.values).filter(k => !ignoreKeys.has(k)) : [];

  const mainEnvKeySet = new Set(mainEnvKeys);
  const exampleEnvKeySet = new Set(exampleEnvKeys);
  const codeKeySet = new Set(codeKeys);

  // 3. Detect Missing in .env (Used in code or in example, but not in target .env)
  const missingInEnv = [];
  for (const key of codeKeys) {
    if (!mainEnvKeySet.has(key)) {
      const typeInfo = inferVariableType(key);
      missingInEnv.push({
        key,
        type: typeInfo.type,
        defaultPlaceholder: typeInfo.default,
        description: typeInfo.description,
        occurrences: scanResult.keyOccurrences[key] || [],
        inExample: exampleEnvKeySet.has(key)
      });
    }
  }

  // 4. Detect Missing in .env.example (Used in code or in target .env, but absent from .env.example)
  const missingInExample = [];
  const allKnownKeys = new Set([...codeKeys, ...mainEnvKeys]);
  if (exampleEnv) {
    for (const key of allKnownKeys) {
      if (!exampleEnvKeySet.has(key)) {
        const typeInfo = inferVariableType(key);
        missingInExample.push({
          key,
          type: typeInfo.type,
          defaultPlaceholder: typeInfo.default,
          description: typeInfo.description,
          inCode: codeKeySet.has(key),
          inMainEnv: mainEnvKeySet.has(key),
          occurrences: scanResult.keyOccurrences[key] || []
        });
      }
    }
  }

  // 5. Detect Dead / Zombie variables in .env (In .env, but NOT used in code and NOT in .env.example)
  const deadInEnv = [];
  for (const key of mainEnvKeys) {
    if (!codeKeySet.has(key) && !exampleEnvKeySet.has(key)) {
      deadInEnv.push({
        key,
        value: mainEnv ? mainEnv.values[key] : '',
        line: mainEnv ? (mainEnv.entries.find(e => e.key === key)?.line || 0) : 0
      });
    }
  }

  // 6. Check for Secret Leaks across all .env* files
  const secrets = [];
  for (const [fName, fData] of Object.entries(envFiles)) {
    for (const entry of fData.entries) {
      if (entry.key && entry.value) {
        const secretHit = checkSecret(entry.key, entry.value, fName);
        if (secretHit) {
          secrets.push({
            ...secretHit,
            line: entry.line
          });
        }
      }
    }
  }

  // 7. Build Cross-Environment Comparison Matrix
  const allDistinctKeys = Array.from(new Set([
    ...codeKeys,
    ...Object.values(envFiles).flatMap(f => Object.keys(f.values))
  ])).sort();

  const envFileNames = Object.keys(envFiles);
  const matrix = allDistinctKeys.map(key => {
    const row = {
      key,
      inCode: codeKeySet.has(key),
      codeOccurrencesCount: scanResult.keyOccurrences[key]?.length || 0,
      envPresence: {}
    };

    for (const fName of envFileNames) {
      const hasKey = Object.prototype.hasOwnProperty.call(envFiles[fName].values, key);
      const val = hasKey ? envFiles[fName].values[key] : null;
      row.envPresence[fName] = {
        present: hasKey,
        isSet: val !== '' && val !== null,
        valuePreview: val ? (val.length > 20 ? val.slice(0, 17) + '...' : val) : ''
      };
    }
    return row;
  });

  // 8. Calculate Health Score (0 - 100)
  let penalty = 0;
  penalty += missingInEnv.length * 15;
  penalty += secrets.filter(s => s.severity === 'CRITICAL').length * 25;
  penalty += secrets.filter(s => s.severity === 'WARNING').length * 10;
  penalty += missingInExample.length * 5;
  penalty += deadInEnv.length * 2;

  const healthScore = Math.max(0, Math.min(100, 100 - penalty));

  const isPassing = missingInEnv.length === 0 && secrets.filter(s => s.severity === 'CRITICAL').length === 0;

  return {
    projectDir: dir,
    scannedAt: new Date().toISOString(),
    isPassing,
    healthScore,
    summary: {
      totalFilesScanned: scanResult.totalFilesScanned,
      codeKeysCount: codeKeys.length,
      envFilesFound: envFileNames.length,
      missingInEnvCount: missingInEnv.length,
      missingInExampleCount: missingInExample.length,
      deadInEnvCount: deadInEnv.length,
      secretsCount: secrets.length,
      criticalSecretsCount: secrets.filter(s => s.severity === 'CRITICAL').length
    },
    codeScan: scanResult,
    envFiles: Object.keys(envFiles).map(name => ({
      name,
      filePath: envFiles[name].filePath,
      keysCount: Object.keys(envFiles[name].values).length
    })),
    missingInEnv,
    missingInExample,
    deadInEnv,
    secrets,
    matrix
  };
}

module.exports = {
  auditProject,
  findEnvFiles
};

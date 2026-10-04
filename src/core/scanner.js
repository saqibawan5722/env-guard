const fs = require('fs');
const path = require('path');

// Default directories to ignore during scan
const DEFAULT_IGNORES = [
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.output',
  'coverage',
  '.vscode',
  '.idea',
  'vendor',
  'target',
  '__pycache__',
  '.pytest_cache',
  '.venv',
  'venv',
  'env',
  '.terraform'
];

// Patterns for detecting environment variables in various languages
const LANGUAGE_RULES = [
  {
    name: 'JavaScript/TypeScript (process.env.VAR)',
    extensions: ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.jsx', '.tsx', '.vue', '.svelte', '.astro'],
    regexes: [
      // process.env.KEY or process.env?.KEY
      /\bprocess\.env\??\.([a-zA-Z_][a-zA-Z0-9_]*)/g,
      // process.env['KEY'] or process.env["KEY"]
      /\bprocess\.env\??\[['"`]([a-zA-Z_][a-zA-Z0-9_]*)['"`]\]/g,
      // import.meta.env.KEY or import.meta.env?.KEY
      /\bimport\.meta\.env\??\.([a-zA-Z_][a-zA-Z0-9_]*)/g,
      // import.meta.env['KEY']
      /\bimport\.meta\.env\??\[['"`]([a-zA-Z_][a-zA-Z0-9_]*)['"`]\]/g
    ]
  },
  {
    name: 'JavaScript/TypeScript (Destructuring: const { A, B } = process.env)',
    extensions: ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.jsx', '.tsx', '.vue', '.svelte'],
    // Specialized parser for destructuring handled via extractDestructuredKeys
    isDestructuring: true
  },
  {
    name: 'Python (os.environ, os.getenv)',
    extensions: ['.py'],
    regexes: [
      /\bos\.(?:environ\.get|getenv)\s*\(\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]/g,
      /\bos\.environ\s*\[\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]\s*\]/g
    ]
  },
  {
    name: 'Go (os.Getenv, os.LookupEnv)',
    extensions: ['.go'],
    regexes: [
      /\bos\.(?:Getenv|LookupEnv)\s*\(\s*["']([a-zA-Z_][a-zA-Z0-9_]*)["']\s*\)/g
    ]
  },
  {
    name: 'Rust (std::env::var)',
    extensions: ['.rs'],
    regexes: [
      /\b(?:std::)?env::(?:var|var_os)\s*\(\s*["']([a-zA-Z_][a-zA-Z0-9_]*)["']\s*\)/g
    ]
  },
  {
    name: 'PHP ($_ENV, getenv)',
    extensions: ['.php'],
    regexes: [
      /\$(?:_ENV|_SERVER)\s*\[\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]\s*\]/g,
      /\bgetenv\s*\(\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]\s*\)/g
    ]
  },
  {
    name: 'Ruby (ENV)',
    extensions: ['.rb', '.erb'],
    regexes: [
      /\bENV\s*\[\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]\s*\]/g,
      /\bENV\.fetch\s*\(\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]/g
    ]
  },
  {
    name: 'Dockerfile / Docker Compose / Shell',
    extensions: ['Dockerfile', '.dockerfile', '.sh', '.bash', '.zsh', '.yml', '.yaml'],
    regexes: [
      /\$\{([A-Z_][A-Z0-9_]*)(?::-[^}]*)?\}/g, // ${VAR} or ${VAR:-default}
      /\bENV\s+([A-Z_][A-Z0-9_]*)=/g // ENV VAR=value in Dockerfile
    ]
  }
];

// Helper to extract destructuring: const { DB_PORT, DB_HOST = 'localhost' } = process.env;
function extractDestructuredKeys(content, filePath) {
  const results = [];
  const lines = content.split(/\r?\n/);
  
  const destructureRegex = /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*(?:process\.env|import\.meta\.env)/g;
  
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    let match;
    while ((match = destructureRegex.exec(line)) !== null) {
      const innerProps = match[1].split(',');
      for (const prop of innerProps) {
        const clean = prop.trim();
        if (!clean) continue;
        // Handle alias or default: DB_PORT = 3000 or DB_HOST: host
        let key = clean.split('=')[0].split(':')[0].trim();
        if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
          const col = line.indexOf(key) + 1;
          results.push({
            key,
            file: filePath,
            line: lineIdx + 1,
            column: col > 0 ? col : 1,
            snippet: getSnippet(lines, lineIdx),
            language: 'JavaScript/TypeScript (Destructured)'
          });
        }
      }
    }
  }
  return results;
}

function getSnippet(lines, lineIdx, context = 1) {
  const start = Math.max(0, lineIdx - context);
  const end = Math.min(lines.length - 1, lineIdx + context);
  return lines.slice(start, end + 1).map((l, i) => {
    const currLine = start + i + 1;
    const marker = currLine === (lineIdx + 1) ? '>' : ' ';
    return `${marker} ${currLine.toString().padStart(4, ' ')} | ${l}`;
  }).join('\n');
}

function stripCommentsPreservingLines(content, ext) {
  if (['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts', '.jsx', '.tsx', '.vue', '.svelte'].includes(ext)) {
    // Replace block comments /* ... */ with newlines to preserve line numbering
    let stripped = content.replace(/\/\*[\s\S]*?\*\//g, (match) => {
      const lineCount = (match.match(/\n/g) || []).length;
      return '\n'.repeat(lineCount);
    });
    // Replace single line comments // ... with whitespace
    stripped = stripped.replace(/\/\/.*$/gm, '');
    return stripped;
  }

  if (ext === '.py' || ext === '.sh' || ext === '.bash' || ext === '.zsh') {
    return content.replace(/#.*$/gm, '');
  }

  return content;
}

/**
 * Scan a single file for env var occurrences
 */
function scanFile(filePath, rootDir = process.cwd()) {
  const occurrences = [];
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  let rawContent;
  try {
    rawContent = fs.readFileSync(filePath, 'utf8');
  } catch {
    return occurrences;
  }

  // Check if binary or minified/huge
  if (rawContent.length > 2 * 1024 * 1024) return occurrences; // Skip files > 2MB
  const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');

  const content = stripCommentsPreservingLines(rawContent, ext);
  const lines = content.split(/\r?\n/);
  const originalLines = rawContent.split(/\r?\n/);

  for (const rule of LANGUAGE_RULES) {
    const matchesExt = rule.extensions.some(e => 
      e.startsWith('.') ? ext === e : fileName.toLowerCase() === e.toLowerCase() || fileName.toLowerCase().endsWith(e.toLowerCase())
    );

    if (!matchesExt) continue;

    if (rule.isDestructuring) {
      const destructured = extractDestructuredKeys(content, relativePath);
      occurrences.push(...destructured);
      continue;
    }

    for (const regex of rule.regexes) {
      regex.lastIndex = 0;
      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];
        let match;
        // Clone regex with sticky or loop
        const lineRegex = new RegExp(regex.source, regex.flags);
        while ((match = lineRegex.exec(line)) !== null) {
          const key = match[1];
          // Filter out common non-env matches like 'NODE_ENV' if desired, but we want all valid env keys
          if (key && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
            // Ignore trivial JS props like prototype, length, etc.
            if (['length', 'prototype', 'name', 'constructor'].includes(key)) continue;

            const col = match.index + 1;
            occurrences.push({
              key,
              file: relativePath,
              line: lineIdx + 1,
              column: col,
              snippet: getSnippet(originalLines, lineIdx),
              language: rule.name
            });
          }
        }
      }
    }
  }

  return occurrences;
}

/**
 * Recursively crawl a directory and scan all files.
 */
function scanDirectory(dirPath, options = {}) {
  const {
    ignoreDirs = DEFAULT_IGNORES,
    ignoreFiles = [],
    customExtensions = []
  } = options;

  const results = {
    totalFilesScanned: 0,
    uniqueKeys: new Set(),
    keyOccurrences: {}, // Record<key, Array<{ file, line, column, snippet, language }>>
    fileOccurrences: {}, // Record<file, Array<{ key, line, column }>>
    allOccurrences: [],
    scannedFiles: []
  };

  function crawl(currentDir) {
    let list;
    try {
      list = fs.readdirSync(currentDir);
    } catch {
      return;
    }

    for (const item of list) {
      const fullPath = path.join(currentDir, item);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        if (ignoreDirs.includes(item) || item.startsWith('.')) {
          // Ignore hidden or standard ignore dirs, but allow current project root
          if (item !== '.' && item !== './') continue;
        }
        crawl(fullPath);
      } else if (stat.isFile()) {
        // Skip .env files themselves from code AST scan
        if (item.startsWith('.env') || ignoreFiles.includes(item)) {
          continue;
        }

        results.totalFilesScanned++;
        const fileOccurrences = scanFile(fullPath, dirPath);

        if (fileOccurrences.length > 0) {
          const relPath = path.relative(dirPath, fullPath).replace(/\\/g, '/');
          results.scannedFiles.push(relPath);
          results.fileOccurrences[relPath] = fileOccurrences;

          for (const occ of fileOccurrences) {
            results.uniqueKeys.add(occ.key);
            if (!results.keyOccurrences[occ.key]) {
              results.keyOccurrences[occ.key] = [];
            }
            results.keyOccurrences[occ.key].push(occ);
            results.allOccurrences.push(occ);
          }
        }
      }
    }
  }

  crawl(dirPath);

  return {
    totalFilesScanned: results.totalFilesScanned,
    uniqueKeys: Array.from(results.uniqueKeys).sort(),
    keyOccurrences: results.keyOccurrences,
    fileOccurrences: results.fileOccurrences,
    allOccurrences: results.allOccurrences,
    scannedFiles: results.scannedFiles
  };
}

module.exports = {
  scanFile,
  scanDirectory,
  DEFAULT_IGNORES
};

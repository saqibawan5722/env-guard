const fs = require('fs');
const path = require('path');

/**
 * Parse an environment string into a structured object & metadata.
 * @param {string} content - Raw .env file content
 * @returns {Object} { entries: Array<{ key, value, raw, comment, line, type }>, values: Record<string, string> }
 */
function parseEnv(content) {
  const lines = content.split(/\r?\n/);
  const entries = [];
  const values = {};

  let currentMultiLineKey = null;
  let currentMultiLineVal = '';
  let quoteChar = null;
  let startLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const lineNum = i + 1;

    // Handle multiline string continuation
    if (currentMultiLineKey !== null) {
      if (rawLine.includes(quoteChar) && !rawLine.endsWith('\\' + quoteChar)) {
        const endIdx = rawLine.indexOf(quoteChar);
        currentMultiLineVal += '\n' + rawLine.slice(0, endIdx);
        const comment = rawLine.slice(endIdx + 1).replace(/^[\s#]+/, '').trim() || null;
        
        values[currentMultiLineKey] = currentMultiLineVal;
        entries.push({
          key: currentMultiLineKey,
          value: currentMultiLineVal,
          comment,
          line: startLine,
          endLine: lineNum,
          raw: `${currentMultiLineKey}="..."`
        });

        currentMultiLineKey = null;
        currentMultiLineVal = '';
        quoteChar = null;
      } else {
        currentMultiLineVal += '\n' + rawLine;
      }
      continue;
    }

    const trimmed = rawLine.trim();

    // Skip empty lines
    if (!trimmed) {
      entries.push({ type: 'empty', line: lineNum, raw: rawLine });
      continue;
    }

    // Comment line
    if (trimmed.startsWith('#')) {
      entries.push({
        type: 'comment',
        comment: trimmed.replace(/^#+\s*/, ''),
        line: lineNum,
        raw: rawLine
      });
      continue;
    }

    // Export prefix
    let cleanLine = trimmed;
    if (cleanLine.startsWith('export ')) {
      cleanLine = cleanLine.slice(7).trim();
    }

    // Match KEY=VALUE
    const equalIdx = cleanLine.indexOf('=');
    if (equalIdx === -1) {
      // Key with no equals (e.g. boolean flag or bare name)
      const key = cleanLine.trim();
      if (isValidEnvKey(key)) {
        values[key] = '';
        entries.push({
          key,
          value: '',
          comment: null,
          line: lineNum,
          raw: rawLine
        });
      }
      continue;
    }

    const key = cleanLine.slice(0, equalIdx).trim();
    let valPart = cleanLine.slice(equalIdx + 1).trim();

    if (!isValidEnvKey(key)) {
      continue;
    }

    let comment = null;
    let finalVal = valPart;

    // Check for quotes
    if (valPart.startsWith('"') || valPart.startsWith("'") || valPart.startsWith('`')) {
      const q = valPart[0];
      const rest = valPart.slice(1);
      const closeIdx = findClosingQuote(rest, q);

      if (closeIdx === -1) {
        // Multi-line quote starting
        currentMultiLineKey = key;
        currentMultiLineVal = rest;
        quoteChar = q;
        startLine = lineNum;
        continue;
      } else {
        finalVal = rest.slice(0, closeIdx);
        const afterQuote = rest.slice(closeIdx + 1).trim();
        if (afterQuote.startsWith('#')) {
          comment = afterQuote.replace(/^#+\s*/, '');
        }
      }
    } else {
      // Unquoted value, check for inline comment
      const commentIdx = valPart.indexOf('#');
      if (commentIdx !== -1) {
        // Only treat as comment if preceded by space or is well-formed
        comment = valPart.slice(commentIdx + 1).trim();
        finalVal = valPart.slice(0, commentIdx).trim();
      }
    }

    values[key] = finalVal;
    entries.push({
      key,
      value: finalVal,
      comment,
      line: lineNum,
      raw: rawLine
    });
  }

  return { entries, values };
}

function isValidEnvKey(key) {
  return /^[a-zA-Z_][a-zA-Z0-9_.-]*$/.test(key);
}

function findClosingQuote(str, q) {
  for (let i = 0; i < str.length; i++) {
    if (str[i] === q && (i === 0 || str[i - 1] !== '\\')) {
      return i;
    }
  }
  return -1;
}

/**
 * Read and parse .env file from disk.
 * @param {string} filePath 
 * @returns {Object|null}
 */
function readEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = parseEnv(content);
    return {
      filePath,
      fileName: path.basename(filePath),
      ...parsed
    };
  } catch (err) {
    return {
      filePath,
      fileName: path.basename(filePath),
      error: err.message,
      entries: [],
      values: {}
    };
  }
}

/**
 * Serialize key-value entries or object into .env format.
 * @param {Array<Object>|Record<string, string>} data 
 * @returns {string}
 */
function serializeEnv(data) {
  if (Array.isArray(data)) {
    return data.map(item => {
      if (item.type === 'empty') return '';
      if (item.type === 'comment') return `# ${item.comment}`;
      const val = item.value !== undefined ? item.value : '';
      const formattedVal = val.includes(' ') || val.includes('\n') || val.includes('#') ? `"${val}"` : val;
      const commentPart = item.comment ? ` # ${item.comment}` : '';
      return `${item.key}=${formattedVal}${commentPart}`;
    }).join('\n') + '\n';
  }

  return Object.entries(data)
    .map(([key, val]) => {
      const v = String(val || '');
      const formatted = v.includes(' ') || v.includes('\n') || v.includes('#') ? `"${v}"` : v;
      return `${key}=${formatted}`;
    })
    .join('\n') + '\n';
}

module.exports = {
  parseEnv,
  readEnvFile,
  serializeEnv,
  isValidEnvKey
};

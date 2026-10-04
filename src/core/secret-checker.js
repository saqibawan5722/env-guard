/**
 * Secret leak detection rules and entropy analyzer
 */

const SECRET_PATTERNS = [
  {
    name: 'AWS Access Key ID',
    regex: /\bAKIA[0-9A-Z]{16}\b/,
    severity: 'CRITICAL'
  },
  {
    name: 'AWS Secret Access Key',
    regex: /\b[0-9a-zA-Z/+]{40}\b/,
    keyHint: /aws.*secret|secret.*access/i,
    severity: 'CRITICAL'
  },
  {
    name: 'Stripe Live Secret Key',
    regex: /\bsk_live_[0-9a-zA-Z]{24,99}\b/,
    severity: 'CRITICAL'
  },
  {
    name: 'Stripe Live Publishable Key',
    regex: /\bpk_live_[0-9a-zA-Z]{24,99}\b/,
    severity: 'WARNING'
  },
  {
    name: 'GitHub Personal Access Token',
    regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[0-9a-zA-Z]{36,255}\b/,
    severity: 'CRITICAL'
  },
  {
    name: 'OpenAI / Anthropic API Key',
    regex: /\b(?:sk-ant-|sk-proj-|sk-)[0-9a-zA-Z_-]{20,90}\b/,
    severity: 'CRITICAL'
  },
  {
    name: 'Slack Bot Token / Webhook',
    regex: /\bxox[baprs]-[0-9a-zA-Z]{10,48}\b|https:\/\/hooks\.slack\.com\/services\/T[0-9A-Z]+\/B[0-9A-Z]+\/[0-9a-zA-Z]+/i,
    severity: 'CRITICAL'
  },
  {
    name: 'Private Key Block',
    regex: /-----BEGIN\s+(?:RSA|OPENSSH|DSA|EC|PGP)?\s*PRIVATE KEY-----/,
    severity: 'CRITICAL'
  },
  {
    name: 'JWT Token (Full signature)',
    regex: /\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/,
    severity: 'WARNING'
  },
  {
    name: 'Database URL with Credentials',
    regex: /\b(?:postgres|postgresql|mysql|mongodb(?:\+srv)?|redis):\/\/[^:\s]+:[^@\s]+@[^\s/]+/i,
    severity: 'CRITICAL',
    // Ignore obvious placeholders like user:pass or root:password on localhost
    isPlaceholder: (val) => {
      const lower = val.toLowerCase();
      return lower.includes('user:password') || 
             lower.includes('user:pass') || 
             lower.includes('root:root') || 
             lower.includes('placeholder') ||
             lower.includes('username:password');
    }
  }
];

const KNOWN_PLACEHOLDERS = [
  'your_',
  'change_me',
  'changeme',
  'placeholder',
  'secret_here',
  'dummy_key',
  'my_secret',
  '<your-',
  '${',
  'none'
];

/**
 * Calculate Shannon entropy of a string (higher = more random/like a secret hash)
 */
function calculateEntropy(str) {
  if (!str || str.length === 0) return 0;
  const len = str.length;
  const frequencies = {};
  for (let i = 0; i < len; i++) {
    const char = str[i];
    frequencies[char] = (frequencies[char] || 0) + 1;
  }
  let entropy = 0;
  for (const char in frequencies) {
    const p = frequencies[char] / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Checks if a value looks like a placeholder vs real sensitive secret
 */
function isPlaceholder(value) {
  if (!value) return true;
  const lower = value.trim().toLowerCase();
  if (KNOWN_PLACEHOLDERS.some(p => lower.startsWith(p) || lower === p)) return true;
  if (/^<.*>$/.test(lower) || /^{{.*}}$/.test(lower) || /^\[.*\]$/.test(lower)) return true;
  return false;
}

/**
 * Scan a key-value entry for secrets
 */
function checkSecret(key, value, fileName = '.env') {
  if (!value) return null;
  if (isPlaceholder(value)) return null;

  for (const rule of SECRET_PATTERNS) {
    if (rule.keyHint && !rule.keyHint.test(key)) continue;
    if (rule.isPlaceholder && rule.isPlaceholder(value)) continue;

    if (rule.regex.test(value)) {
      return {
        key,
        ruleName: rule.name,
        severity: rule.severity,
        maskedValue: maskValue(value),
        reason: `Matches pattern for ${rule.name}`,
        file: fileName
      };
    }
  }

  // Generic check for sensitive variable names having high entropy real values in committed files
  const isSensitiveKey = /(secret|password|passwd|private_key|api_key|auth_token|access_token|client_secret|jwt_secret)/i.test(key);
  if (isSensitiveKey && value.length >= 16) {
    const entropy = calculateEntropy(value);
    // If entropy is > 3.8 and not placeholder, it's likely a real generated secret!
    if (entropy > 3.8 && !isPlaceholder(value)) {
      return {
        key,
        ruleName: 'High-Entropy Secret String',
        severity: fileName.includes('.example') ? 'CRITICAL' : 'WARNING',
        maskedValue: maskValue(value),
        reason: `Key "${key}" contains high-entropy string (${entropy.toFixed(2)} bits)`,
        file: fileName
      };
    }
  }

  return null;
}

function maskValue(val) {
  if (!val || val.length <= 6) return '******';
  return val.slice(0, 3) + '...' + val.slice(-3);
}

module.exports = {
  checkSecret,
  isPlaceholder,
  calculateEntropy,
  maskValue
};

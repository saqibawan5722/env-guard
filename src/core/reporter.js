const fs = require('fs');
const path = require('path');

/**
 * Generate Markdown audit report (ideal for CI GitHub Actions Job Summary).
 */
function generateMarkdownReport(auditResult) {
  const { summary, healthScore, missingInEnv, missingInExample, deadInEnv, secrets, matrix } = auditResult;

  let md = `# 🛡️ Env-Guard Audit Report\n\n`;
  md += `**Health Score:** ${healthScore}% ${healthScore >= 90 ? '🟢 Excellent' : healthScore >= 70 ? '🟡 Warning' : '🔴 Critical'}\n`;
  md += `**Scanned At:** \`${auditResult.scannedAt}\`\n\n`;

  md += `### 📊 Summary\n\n`;
  md += `| Metric | Count |\n`;
  md += `| :--- | :---: |\n`;
  md += `| Total Files Scanned | ${summary.totalFilesScanned} |\n`;
  md += `| Code Env Variables | ${summary.codeKeysCount} |\n`;
  md += `| Discovered .env Files | ${summary.envFilesFound} |\n`;
  md += `| ❌ Missing in .env | **${summary.missingInEnvCount}** |\n`;
  md += `| ⚠️ Missing in .env.example | ${summary.missingInExampleCount} |\n`;
  md += `| 🧟 Dead / Unused in .env | ${summary.deadInEnvCount} |\n`;
  md += `| 🔒 Secrets Detected | ${summary.secretsCount} (${summary.criticalSecretsCount} Critical) |\n\n`;

  if (missingInEnv.length > 0) {
    md += `### ❌ Missing Variables in \`.env\`\n\n`;
    md += `| Variable | Type | Inferred Default | Usages in Code |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    for (const item of missingInEnv) {
      const files = item.occurrences.map(o => `\`${o.file}:${o.line}\``).slice(0, 3).join(', ');
      md += `| **\`${item.key}\`** | \`${item.type}\` | \`${item.defaultPlaceholder}\` | ${files || '1+'} |\n`;
    }
    md += `\n`;
  }

  if (secrets.length > 0) {
    md += `### 🔒 Sensitive Secrets & Tokens Detected\n\n`;
    md += `| File | Line | Key | Rule | Severity |\n`;
    md += `| :--- | :---: | :--- | :--- | :---: |\n`;
    for (const sec of secrets) {
      md += `| \`${sec.file}\` | ${sec.line || '-'} | **\`${sec.key}\`** | ${sec.ruleName} | **${sec.severity}** |\n`;
    }
    md += `\n`;
  }

  if (deadInEnv.length > 0) {
    md += `### 🧟 Dead / Zombie Variables (Never Used in Code)\n\n`;
    md += `| Variable | Line in .env |\n`;
    md += `| :--- | :---: |\n`;
    for (const d of deadInEnv) {
      md += `| \`${d.key}\` | ${d.line || '-'} |\n`;
    }
    md += `\n`;
  }

  return md;
}

/**
 * Generate a standalone, single-file HTML audit report.
 */
function generateHtmlReport(auditResult) {
  const jsonData = JSON.stringify(auditResult).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Env-Guard Audit Report</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: rgba(18, 24, 38, 0.75);
      --card-border: rgba(255, 255, 255, 0.08);
      --primary: #6366f1;
      --primary-glow: rgba(99, 102, 241, 0.35);
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --success: #10b981;
      --warning: #f59e0b;
      --danger: #ef4444;
      --accent: #8b5cf6;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background-color: var(--bg);
      background-image: 
        radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.15) 0px, transparent 50%),
        radial-gradient(at 100% 100%, rgba(139, 92, 246, 0.12) 0px, transparent 50%);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', sans-serif;
      min-height: 100vh;
      padding: 2.5rem 1.5rem;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      padding-bottom: 1.5rem;
      border-bottom: 1px solid var(--card-border);
    }
    .logo-area { display: flex; align-items: center; gap: 1rem; }
    .shield-icon {
      width: 48px; height: 48px;
      background: linear-gradient(135deg, #6366f1, #a855f7);
      border-radius: 14px;
      display: flex; align-items: center; justify-content: center;
      font-size: 26px;
      box-shadow: 0 0 25px var(--primary-glow);
    }
    h1 { font-size: 1.8rem; font-weight: 800; letter-spacing: -0.5px; }
    .subtitle { color: var(--text-muted); font-size: 0.9rem; margin-top: 2px; }
    .badge {
      padding: 0.4rem 0.9rem;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 700;
      display: inline-flex; align-items: center; gap: 0.4rem;
    }
    .badge-pass { background: rgba(16, 185, 129, 0.15); color: var(--success); border: 1px solid rgba(16, 185, 129, 0.3); }
    .badge-fail { background: rgba(239, 68, 68, 0.15); color: var(--danger); border: 1px solid rgba(239, 68, 68, 0.3); }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1.25rem;
      margin-bottom: 2.5rem;
    }
    .stat-card {
      background: var(--card-bg);
      backdrop-filter: blur(12px);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 1.4rem;
      transition: transform 0.2s, border-color 0.2s;
    }
    .stat-card:hover { transform: translateY(-3px); border-color: rgba(99, 102, 241, 0.3); }
    .stat-title { font-size: 0.82rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); }
    .stat-val { font-size: 2.2rem; font-weight: 800; margin-top: 0.4rem; }
    .stat-meta { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem; }
    
    .section-card {
      background: var(--card-bg);
      backdrop-filter: blur(12px);
      border: 1px solid var(--card-border);
      border-radius: 18px;
      padding: 1.75rem;
      margin-bottom: 2rem;
    }
    .section-header {
      display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;
    }
    .section-title { font-size: 1.2rem; font-weight: 700; display: flex; align-items: center; gap: 0.6rem; }

    table { width: 100%; border-collapse: collapse; text-align: left; }
    th {
      padding: 0.85rem 1rem;
      background: rgba(255, 255, 255, 0.03);
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid var(--card-border);
    }
    td {
      padding: 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      font-size: 0.9rem;
    }
    tr:hover td { background: rgba(255, 255, 255, 0.02); }
    .mono { font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; }
    .key-badge {
      background: rgba(99, 102, 241, 0.12);
      color: #a5b4fc;
      padding: 0.25rem 0.5rem;
      border-radius: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 600;
    }
    .status-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
    .dot-yes { background: var(--success); box-shadow: 0 0 8px rgba(16, 185, 129, 0.6); }
    .dot-no { background: var(--danger); opacity: 0.4; }
    .code-box {
      background: #0d111a;
      border-radius: 8px;
      padding: 0.6rem 0.8rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      color: #94a3b8;
      max-height: 120px;
      overflow-y: auto;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo-area">
        <div class="shield-icon">🛡️</div>
        <div>
          <h1>Env-Guard Audit Report</h1>
          <div class="subtitle" id="scanInfo">Project Environment Drift & Health Audit</div>
        </div>
      </div>
      <div id="statusBadge"></div>
    </header>

    <div class="stats-grid" id="statsGrid"></div>

    <div class="section-card" id="missingSection">
      <div class="section-header">
        <div class="section-title">❌ Missing in .env (Used in Code)</div>
      </div>
      <div style="overflow-x: auto;">
        <table id="missingTable">
          <thead>
            <tr>
              <th>Variable Key</th>
              <th>Type</th>
              <th>Suggested Default</th>
              <th>Code Occurrences</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>

    <div class="section-card" id="secretsSection">
      <div class="section-header">
        <div class="section-title">🔒 Secret Leaks & High Risk Keys</div>
      </div>
      <div style="overflow-x: auto;">
        <table id="secretsTable">
          <thead>
            <tr>
              <th>File</th>
              <th>Line</th>
              <th>Variable</th>
              <th>Detected Pattern</th>
              <th>Severity</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>

    <div class="section-card">
      <div class="section-header">
        <div class="section-title">🌐 Multi-Environment Drift Matrix</div>
      </div>
      <div style="overflow-x: auto;">
        <table id="matrixTable">
          <thead></thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    const reportData = ${jsonData};

    document.getElementById('scanInfo').innerText = 'Scanned: ' + new Date(reportData.scannedAt).toLocaleString() + ' • ' + reportData.projectDir;

    // Status Badge
    const badgeEl = document.getElementById('statusBadge');
    if (reportData.isPassing) {
      badgeEl.innerHTML = '<span class="badge badge-pass">✓ HEALTHY (' + reportData.healthScore + '%)</span>';
    } else {
      badgeEl.innerHTML = '<span class="badge badge-fail">⚠ DRIFT DETECTED (' + reportData.healthScore + '%)</span>';
    }

    // Stats Grid
    const s = reportData.summary;
    document.getElementById('statsGrid').innerHTML = \`
      <div class="stat-card">
        <div class="stat-title">Health Score</div>
        <div class="stat-val" style="color: \${reportData.healthScore >= 80 ? 'var(--success)' : 'var(--danger)'}">\${reportData.healthScore}%</div>
        <div class="stat-meta">\${reportData.isPassing ? 'All critical checks pass' : 'Action required'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Code Variables</div>
        <div class="stat-val">\${s.codeKeysCount}</div>
        <div class="stat-meta">In \${s.totalFilesScanned} scanned files</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Missing in .env</div>
        <div class="stat-val" style="color: \${s.missingInEnvCount > 0 ? 'var(--danger)' : 'var(--success)'}">\${s.missingInEnvCount}</div>
        <div class="stat-meta">\${s.missingInEnvCount > 0 ? 'Will crash at runtime' : 'None missing'}</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Leaked Secrets</div>
        <div class="stat-val" style="color: \${s.secretsCount > 0 ? 'var(--danger)' : 'var(--success)'}">\${s.secretsCount}</div>
        <div class="stat-meta">\${s.criticalSecretsCount} critical security tokens</div>
      </div>
    \`;

    // Missing Table
    const missingTbody = document.querySelector('#missingTable tbody');
    if (reportData.missingInEnv.length === 0) {
      missingTbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--success); padding: 1.5rem;">🎉 Zero missing environment variables in .env!</td></tr>';
    } else {
      missingTbody.innerHTML = reportData.missingInEnv.map(m => \`
        <tr>
          <td><span class="key-badge">\${m.key}</span></td>
          <td><span class="mono" style="color: var(--text-muted)">\${m.type}</span></td>
          <td><span class="mono" style="color: #6ee7b7">\${m.defaultPlaceholder}</span></td>
          <td>
            <div class="code-box">\${m.occurrences.map(o => \`\${o.file}:\${o.line}\`).join('\\n') || 'Found in code'}</div>
          </td>
        </tr>
      \`).join('');
    }

    // Secrets Table
    const secretsTbody = document.querySelector('#secretsTable tbody');
    if (reportData.secrets.length === 0) {
      secretsTbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--success); padding: 1.5rem;">🔒 No leaked secrets or exposed credentials detected.</td></tr>';
    } else {
      secretsTbody.innerHTML = reportData.secrets.map(sec => \`
        <tr>
          <td><span class="mono">\${sec.file}</span></td>
          <td><span class="mono">\${sec.line || '-'}</span></td>
          <td><span class="key-badge">\${sec.key}</span></td>
          <td>\${sec.ruleName}</td>
          <td><span class="badge \${sec.severity === 'CRITICAL' ? 'badge-fail' : 'badge-pass'}">\${sec.severity}</span></td>
        </tr>
      \`).join('');
    }

    // Matrix Table
    const matrixHead = document.querySelector('#matrixTable thead');
    const matrixTbody = document.querySelector('#matrixTable tbody');
    const envFiles = reportData.envFiles.map(e => e.name);

    matrixHead.innerHTML = \`
      <tr>
        <th>Variable Key</th>
        <th>Code AST</th>
        \${envFiles.map(f => \`<th>\${f}</th>\`).join('')}
      </tr>
    \`;

    matrixTbody.innerHTML = reportData.matrix.map(row => \`
      <tr>
        <td><span class="key-badge">\${row.key}</span></td>
        <td>
          <span class="status-dot \${row.inCode ? 'dot-yes' : 'dot-no'}"></span>
          <span style="font-size: 0.8rem; margin-left: 6px; color: var(--text-muted)">\${row.codeOccurrencesCount}x</span>
        </td>
        \${envFiles.map(f => {
          const p = row.envPresence[f];
          const has = p && p.present;
          return \`<td><span class="status-dot \${has ? 'dot-yes' : 'dot-no'}"></span> <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 4px;">\${has ? (p.isSet ? 'Set' : 'Empty') : 'Missing'}</span></td>\`;
        }).join('')}
      </tr>
    \`).join('');
  </script>
</body>
</html>`;
}

module.exports = {
  generateMarkdownReport,
  generateHtmlReport
};

/**
 * Env-Guard Dashboard Reactive Client Application
 */

let auditState = null;
let envFilesState = [];
let activeEditorFile = null;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initEventListeners();
  loadAuditData();
  loadEnvFiles();
});

// Toast notification helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerText = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Tab Switching
function initTabs() {
  const tabButtons = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');

      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const pane = document.getElementById(`pane-${targetTab}`);
      if (pane) pane.classList.add('active');

      if (targetTab === 'editor' && envFilesState.length > 0 && !activeEditorFile) {
        selectEditorTab(envFilesState[0].fileName);
      }
    });
  });
}

// Event Listeners
function initEventListeners() {
  document.getElementById('refreshAuditBtn').addEventListener('click', () => {
    showToast('Re-scanning codebase & environment files...', 'info');
    loadAuditData();
    loadEnvFiles();
  });

  document.getElementById('exportMdBtn').addEventListener('click', () => {
    window.open('/api/export?format=markdown', '_blank');
  });

  document.getElementById('exportJsonBtn').addEventListener('click', () => {
    window.open('/api/export?format=json', '_blank');
  });

  // Search in Matrix
  document.getElementById('matrixSearchInput').addEventListener('input', (e) => {
    renderMatrixTable(e.target.value.trim().toLowerCase());
  });

  // Search in AST
  document.getElementById('astSearchInput').addEventListener('input', (e) => {
    renderAstList(e.target.value.trim().toLowerCase());
  });

  // Modal Open/Close
  const syncModal = document.getElementById('syncModal');
  document.getElementById('openSyncModalBtn').addEventListener('click', () => openSyncModal());
  document.getElementById('closeSyncModalBtn').addEventListener('click', () => syncModal.classList.remove('open'));
  document.getElementById('cancelSyncBtn').addEventListener('click', () => syncModal.classList.remove('open'));
  document.getElementById('fixAllMissingBtn').addEventListener('click', () => openSyncModal('.env'));

  // Confirm Sync
  document.getElementById('confirmSyncBtn').addEventListener('click', handleConfirmSync);

  // Save Editor
  document.getElementById('saveEditorBtn').addEventListener('click', handleSaveEditor);
}

// Fetch Audit Data
async function loadAuditData() {
  try {
    const res = await fetch('/api/audit');
    const json = await res.json();
    if (json.success) {
      auditState = json.data;
      renderOverview();
      renderMatrixTable();
      renderMissingTable();
      renderSecretsTable();
      renderAstList();
    } else {
      showToast('Audit failed: ' + json.error, 'error');
    }
  } catch (err) {
    showToast('Failed to connect to Env-Guard server', 'error');
  }
}

// Fetch Env Files for Editor
async function loadEnvFiles() {
  try {
    const res = await fetch('/api/environments');
    const json = await res.json();
    if (json.success) {
      envFilesState = json.data;
      renderEditorTabs();
    }
  } catch (err) {
    console.error(err);
  }
}

// Render Overview Pane
function renderOverview() {
  if (!auditState) return;

  document.getElementById('currentDirPath').innerText = auditState.projectDir;
  document.getElementById('lastScannedTime').innerText = `Last scanned: ${new Date(auditState.scannedAt).toLocaleTimeString()}`;

  // Health Score Circular Progress
  const score = auditState.healthScore;
  const scoreProgress = document.getElementById('scoreProgress');
  const healthScoreNum = document.getElementById('healthScoreNum');

  healthScoreNum.innerText = `${score}%`;
  scoreProgress.setAttribute('stroke-dasharray', `${score}, 100`);

  if (score >= 80) {
    scoreProgress.style.stroke = 'var(--success)';
    healthScoreNum.style.color = 'var(--success)';
  } else if (score >= 50) {
    scoreProgress.style.stroke = 'var(--warning)';
    healthScoreNum.style.color = 'var(--warning)';
  } else {
    scoreProgress.style.stroke = 'var(--danger)';
    healthScoreNum.style.color = 'var(--danger)';
  }

  // Stats Counters
  document.getElementById('statCodeKeys').innerText = auditState.summary.codeKeysCount;
  document.getElementById('statMissing').innerText = auditState.summary.missingInEnvCount;
  document.getElementById('statSecrets').innerText = auditState.summary.secretsCount;
  document.getElementById('statEnvFiles').innerText = auditState.summary.envFilesFound;

  // Sidebar counters
  document.getElementById('matrixCount').innerText = auditState.matrix.length;
  document.getElementById('missingCount').innerText = auditState.summary.missingInEnvCount;
  document.getElementById('secretsCount').innerText = auditState.summary.secretsCount;
  document.getElementById('astCount').innerText = auditState.codeScan.allOccurrences.length;

  // Urgent Issues List
  const urgentList = document.getElementById('urgentIssuesList');
  urgentList.innerHTML = '';

  if (auditState.missingInEnv.length === 0 && auditState.secrets.length === 0) {
    urgentList.innerHTML = `
      <div style="padding: 1rem; text-align: center; color: var(--success);">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">🎉</div>
        <div style="font-weight: 700;">Zero Critical Environment Issues!</div>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px;">All referenced variables exist and no leaked secrets detected.</div>
      </div>
    `;
  } else {
    // Show top missing
    auditState.missingInEnv.slice(0, 4).forEach(m => {
      const item = document.createElement('div');
      item.className = 'sync-item-row';
      item.innerHTML = `
        <span class="key-badge">${m.key}</span>
        <span style="font-size: 0.8rem; color: var(--danger); font-weight: 600;">Missing in .env</span>
        <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: auto;">${m.occurrences.length}x in code</span>
      `;
      urgentList.appendChild(item);
    });

    // Show top secrets
    auditState.secrets.slice(0, 2).forEach(s => {
      const item = document.createElement('div');
      item.className = 'sync-item-row';
      item.innerHTML = `
        <span class="key-badge">${s.key}</span>
        <span class="status-pill pill-danger">${s.ruleName}</span>
        <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: auto;">${s.file}</span>
      `;
      urgentList.appendChild(item);
    });
  }

  // Discovered Env Files list
  const envFilesList = document.getElementById('envFilesList');
  envFilesList.innerHTML = '';
  auditState.envFiles.forEach(f => {
    const item = document.createElement('div');
    item.className = 'sync-item-row';
    item.innerHTML = `
      <span style="font-family: 'JetBrains Mono'; font-weight: 600; color: #38bdf8;">📄 ${f.name}</span>
      <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: auto;">${f.keysCount} keys configured</span>
    `;
    envFilesList.appendChild(item);
  });
}

// Render Drift Matrix Table
function renderMatrixTable(filterQuery = '') {
  if (!auditState) return;

  const table = document.getElementById('matrixFullTable');
  const thead = table.querySelector('thead');
  const tbody = table.querySelector('tbody');

  const envFileNames = auditState.envFiles.map(e => e.name);

  thead.innerHTML = `
    <tr>
      <th>Variable Key</th>
      <th>Code Usage</th>
      ${envFileNames.map(name => `<th>${name}</th>`).join('')}
    </tr>
  `;

  tbody.innerHTML = '';

  const rows = auditState.matrix.filter(row => {
    if (!filterQuery) return true;
    return row.key.toLowerCase().includes(filterQuery);
  });

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${envFileNames.length + 2}" style="text-align: center; color: var(--text-muted); padding: 2rem;">No variables match filter.</td></tr>`;
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement('tr');
    let envColsHtml = '';

    envFileNames.forEach(fName => {
      const presence = row.envPresence[fName];
      if (presence && presence.present) {
        if (presence.isSet) {
          envColsHtml += `<td><span class="status-pill pill-success">✓ Set</span></td>`;
        } else {
          envColsHtml += `<td><span class="status-pill pill-warning">Empty</span></td>`;
        }
      } else {
        envColsHtml += `<td><span class="status-pill pill-danger">✕ Missing</span></td>`;
      }
    });

    tr.innerHTML = `
      <td><span class="key-badge">${row.key}</span></td>
      <td>
        <span class="status-pill ${row.inCode ? 'pill-success' : 'pill-neutral'}">
          ${row.inCode ? `Used (${row.codeOccurrencesCount}x)` : 'Unused in AST'}
        </span>
      </td>
      ${envColsHtml}
    `;
    tbody.appendChild(tr);
  });
}

// Render Missing & Dead Tables
function renderMissingTable() {
  if (!auditState) return;

  const missingTbody = document.querySelector('#missingTableFull tbody');
  missingTbody.innerHTML = '';

  if (auditState.missingInEnv.length === 0) {
    missingTbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--success); padding: 1.5rem;">🎉 Zero missing variables in .env!</td></tr>';
  } else {
    auditState.missingInEnv.forEach(m => {
      const tr = document.createElement('tr');
      const filesPreview = m.occurrences.map(o => `${o.file}:${o.line}`).slice(0, 3).join('<br>');

      tr.innerHTML = `
        <td><span class="key-badge">${m.key}</span></td>
        <td><span style="font-size: 0.8rem; color: #a5b4fc; font-weight: 600;">${m.type}</span></td>
        <td><code style="color: #6ee7b7; font-size: 0.8rem;">${m.defaultPlaceholder}</code></td>
        <td style="font-family: 'JetBrains Mono'; font-size: 0.75rem; color: var(--text-muted);">${filesPreview || 'Found in AST'}</td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="quickAddSingleVar('${m.key}', '${m.defaultPlaceholder}')">⚡ Add to .env</button>
        </td>
      `;
      missingTbody.appendChild(tr);
    });
  }

  // Dead Variables
  const deadTbody = document.querySelector('#deadTableFull tbody');
  deadTbody.innerHTML = '';
  if (auditState.deadInEnv.length === 0) {
    deadTbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--success); padding: 1.5rem;">No dead / zombie variables detected.</td></tr>';
  } else {
    auditState.deadInEnv.forEach(d => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="key-badge" style="background: rgba(148, 163, 184, 0.12); color: var(--text-muted);">${d.key}</span></td>
        <td><code>Line ${d.line || '-'}</code></td>
        <td style="font-family: 'JetBrains Mono'; font-size: 0.8rem; color: var(--text-muted);">${d.value || '""'}</td>
      `;
      deadTbody.appendChild(tr);
    });
  }
}

// Render Secrets Table
function renderSecretsTable() {
  if (!auditState) return;

  const tbody = document.querySelector('#secretsTableFull tbody');
  tbody.innerHTML = '';

  if (auditState.secrets.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--success); padding: 1.5rem;">🔒 No secret leaks or unencrypted tokens found!</td></tr>';
  } else {
    auditState.secrets.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-family: 'JetBrains Mono'; color: #38bdf8;">${s.file}</td>
        <td><code>${s.line || '-'}</code></td>
        <td><span class="key-badge">${s.key}</span></td>
        <td>${s.ruleName}</td>
        <td><span class="status-pill ${s.severity === 'CRITICAL' ? 'pill-danger' : 'pill-warning'}">${s.severity}</span></td>
        <td><code style="color: var(--text-dim);">${s.maskedValue}</code></td>
      `;
      tbody.appendChild(tr);
    });
  }
}

// Render AST Occurrences
function renderAstList(filter = '') {
  if (!auditState) return;

  const container = document.getElementById('astExplorerList');
  container.innerHTML = '';

  const occurrences = auditState.codeScan.allOccurrences.filter(occ => {
    if (!filter) return true;
    return occ.key.toLowerCase().includes(filter) || occ.file.toLowerCase().includes(filter);
  });

  if (occurrences.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding: 2rem; text-align: center; color: var(--text-muted);">No AST references found matching query.</div>';
    return;
  }

  occurrences.forEach(occ => {
    const card = document.createElement('div');
    card.className = 'ast-card';
    card.innerHTML = `
      <div class="ast-card-header">
        <div>
          <span class="key-badge">${occ.key}</span>
          <span class="ast-file-badge" style="margin-left: 0.5rem;">📁 ${occ.file}:${occ.line}:${occ.column}</span>
        </div>
        <span style="font-size: 0.75rem; color: var(--text-dim);">${occ.language}</span>
      </div>
      <div class="code-snippet">${escapeHtml(occ.snippet)}</div>
    `;
    container.appendChild(card);
  });
}

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Quick add single var
window.quickAddSingleVar = async function(key, defaultValue) {
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetFile: '.env',
        keys: [key],
        customValues: { [key]: defaultValue }
      })
    });
    const json = await res.json();
    if (json.success) {
      showToast(`Added ${key} to .env!`, 'success');
      loadAuditData();
      loadEnvFiles();
    }
  } catch (err) {
    showToast('Failed to add variable', 'error');
  }
};

// Sync Modal Logic
function openSyncModal(target = '.env') {
  if (!auditState) return;

  const modal = document.getElementById('syncModal');
  const targetSelect = document.getElementById('modalTargetFileSelect');
  targetSelect.value = target;

  const listContainer = document.getElementById('modalSyncList');
  listContainer.innerHTML = '';

  const missingList = target === '.env.example' ? auditState.missingInExample : auditState.missingInEnv;

  if (missingList.length === 0) {
    listContainer.innerHTML = '<div style="padding: 1.5rem; text-align: center; color: var(--success);">No missing variables to sync!</div>';
  } else {
    missingList.forEach(m => {
      const row = document.createElement('div');
      row.className = 'sync-item-row';
      row.innerHTML = `
        <div style="flex: 1;">
          <div style="font-weight: 700; font-family: 'JetBrains Mono'; font-size: 0.9rem;">${m.key}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">${m.description}</div>
        </div>
        <div style="flex: 1.2;">
          <input type="text" class="form-input sync-val-input" data-key="${m.key}" value="${m.defaultPlaceholder}" />
        </div>
      `;
      listContainer.appendChild(row);
    });
  }

  modal.classList.add('open');
}

async function handleConfirmSync() {
  const targetFile = document.getElementById('modalTargetFileSelect').value;
  const inputs = document.querySelectorAll('.sync-val-input');

  const customValues = {};
  const keys = [];

  inputs.forEach(input => {
    const k = input.getAttribute('data-key');
    const v = input.value.trim();
    keys.push(k);
    customValues[k] = v;
  });

  if (keys.length === 0) {
    document.getElementById('syncModal').classList.remove('open');
    return;
  }

  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetFile, keys, customValues })
    });
    const json = await res.json();
    if (json.success) {
      showToast(`Successfully synced ${json.data.addedKeys.length} variables to ${targetFile}!`, 'success');
      document.getElementById('syncModal').classList.remove('open');
      loadAuditData();
      loadEnvFiles();
    } else {
      showToast('Sync error: ' + json.error, 'error');
    }
  } catch (err) {
    showToast('Failed to execute sync', 'error');
  }
}

// Env File Editor Tabs & Logic
function renderEditorTabs() {
  const container = document.getElementById('editorTabsBar');
  container.innerHTML = '';

  if (envFilesState.length === 0) {
    container.innerHTML = '<span style="color: var(--text-muted); font-size: 0.85rem;">No .env files found</span>';
    return;
  }

  envFilesState.forEach(f => {
    const btn = document.createElement('button');
    btn.className = `file-tab-btn ${activeEditorFile === f.fileName ? 'active' : ''}`;
    btn.innerText = `📄 ${f.fileName}`;
    btn.addEventListener('click', () => selectEditorTab(f.fileName));
    container.appendChild(btn);
  });
}

function selectEditorTab(fileName) {
  activeEditorFile = fileName;
  renderEditorTabs();

  const fileData = envFilesState.find(f => f.fileName === fileName);
  if (fileData) {
    document.getElementById('envCodeEditor').value = fileData.raw;
  }
}

async function handleSaveEditor() {
  if (!activeEditorFile) {
    showToast('No active file selected to save', 'warning');
    return;
  }

  const content = document.getElementById('envCodeEditor').value;

  try {
    const res = await fetch('/api/save-env', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: activeEditorFile, content })
    });
    const json = await res.json();
    if (json.success) {
      showToast(json.message, 'success');
      loadAuditData();
      loadEnvFiles();
    } else {
      showToast('Save error: ' + json.error, 'error');
    }
  } catch (err) {
    showToast('Failed to save file', 'error');
  }
}

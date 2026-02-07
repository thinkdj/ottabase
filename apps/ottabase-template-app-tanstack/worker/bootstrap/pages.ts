// ============================================================
// Ottabase Bootstrap - HTML Pages
// ============================================================
//
// Self-contained HTML pages served directly from the worker.
// No external dependencies — everything inline.
// ============================================================

import type { PlatformStateResult } from './types';

const BRAND = 'Ottabase';

// ============================================================
// Shared styles and layout
// ============================================================

function baseLayout(title: string, body: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — ${BRAND}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #09090b;
    --bg-card: #18181b;
    --bg-card-hover: #1f1f23;
    --border: #27272a;
    --border-accent: #3f3f46;
    --text: #fafafa;
    --text-muted: #a1a1aa;
    --text-dim: #71717a;
    --accent: #6d28d9;
    --accent-light: #8b5cf6;
    --accent-glow: rgba(139, 92, 246, 0.15);
    --success: #22c55e;
    --success-bg: rgba(34, 197, 94, 0.1);
    --warning: #eab308;
    --warning-bg: rgba(234, 179, 8, 0.1);
    --error: #ef4444;
    --error-bg: rgba(239, 68, 68, 0.1);
    --radius: 12px;
    --radius-sm: 8px;
    --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    --font-mono: 'SF Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace;
  }
  body {
    font-family: var(--font);
    background: var(--bg);
    color: var(--text);
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    line-height: 1.6;
  }
  .container {
    max-width: 680px;
    width: 100%;
  }
  .logo {
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--text);
    margin-bottom: 0.25rem;
  }
  .logo span { color: var(--accent-light); }
  .subtitle {
    color: var(--text-muted);
    font-size: 0.875rem;
    margin-bottom: 2rem;
  }
  .card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.75rem;
    margin-bottom: 1rem;
  }
  .card h2 {
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
  }
  .card p {
    color: var(--text-muted);
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .badge-success { background: var(--success-bg); color: var(--success); }
  .badge-warning { background: var(--warning-bg); color: var(--warning); }
  .badge-error { background: var(--error-bg); color: var(--error); }
  .badge-muted { background: rgba(161, 161, 170, 0.1); color: var(--text-muted); }
  .dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    display: inline-block;
  }
  .dot-success { background: var(--success); }
  .dot-warning { background: var(--warning); }
  .dot-error { background: var(--error); }
  .dot-muted { background: var(--text-dim); }
  .binding-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    margin: 1rem 0;
  }
  .binding-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    font-size: 0.8125rem;
    font-family: var(--font-mono);
  }
  .binding-item.ok { border-color: rgba(34, 197, 94, 0.3); }
  .binding-item.missing { border-color: rgba(239, 68, 68, 0.3); opacity: 0.7; }
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: var(--font);
    width: 100%;
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .btn-primary {
    background: var(--accent);
    color: white;
  }
  .btn-primary:hover:not(:disabled) {
    background: var(--accent-light);
    box-shadow: 0 0 20px var(--accent-glow);
  }
  .btn-outline {
    background: transparent;
    color: var(--text);
    border: 1px solid var(--border);
  }
  .btn-outline:hover:not(:disabled) {
    background: var(--bg-card-hover);
    border-color: var(--border-accent);
  }
  .step-list {
    list-style: none;
    padding: 0;
    margin: 1rem 0;
  }
  .step-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--border);
    font-size: 0.875rem;
  }
  .step-item:last-child { border-bottom: none; }
  .step-icon {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
    flex-shrink: 0;
  }
  .step-pending .step-icon { background: rgba(161, 161, 170, 0.1); color: var(--text-dim); }
  .step-running .step-icon { background: var(--accent-glow); color: var(--accent-light); animation: pulse 1.5s infinite; }
  .step-done .step-icon { background: var(--success-bg); color: var(--success); }
  .step-error .step-icon { background: var(--error-bg); color: var(--error); }
  .step-label { flex: 1; }
  .step-status { font-size: 0.75rem; color: var(--text-dim); }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  .spinner {
    width: 16px; height: 16px;
    border: 2px solid var(--border);
    border-top-color: var(--accent-light);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    display: inline-block;
  }
  .log-area {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 1rem;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--text-muted);
    max-height: 200px;
    overflow-y: auto;
    margin-top: 1rem;
    display: none;
  }
  .log-area.visible { display: block; }
  .log-line { padding: 0.125rem 0; }
  .log-line.log-success { color: var(--success); }
  .log-line.log-error { color: var(--error); }
  .log-line.log-info { color: var(--accent-light); }
  .footer {
    margin-top: 2rem;
    text-align: center;
    font-size: 0.75rem;
    color: var(--text-dim);
  }
  .footer a { color: var(--accent-light); text-decoration: none; }
  .footer a:hover { text-decoration: underline; }
  .alert {
    padding: 1rem 1.25rem;
    border-radius: var(--radius-sm);
    font-size: 0.875rem;
    margin-bottom: 1rem;
  }
  .alert-error {
    background: var(--error-bg);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: var(--error);
  }
  .alert-warning {
    background: var(--warning-bg);
    border: 1px solid rgba(234, 179, 8, 0.3);
    color: var(--warning);
  }
  pre.code-block {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 1rem;
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    overflow-x: auto;
    margin: 0.75rem 0;
    color: var(--text-muted);
    white-space: pre;
  }
  .progress-bar {
    width: 100%;
    height: 4px;
    background: var(--border);
    border-radius: 2px;
    margin: 1rem 0;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: var(--accent-light);
    border-radius: 2px;
    transition: width 0.3s ease;
    width: 0%;
  }
</style>
</head>
<body>
<div class="container">
  <div class="logo"><span>&#9670;</span> ${BRAND}</div>
  ${body}
  <div class="footer">
    ${BRAND} Platform &middot; <a href="https://ottabase.com">Documentation</a>
  </div>
</div>
</body>
</html>`;
}

// ============================================================
// Wizard page — the main setup flow
// ============================================================

export function renderWizardPage(state: PlatformStateResult): string {
    const bindingsHtml = Object.entries(state.bindings)
        .map(([name, ok]) => {
            const bindingName = BINDING_LABELS[name] || name;
            const cssClass = ok ? 'ok' : 'missing';
            const dotClass = ok ? 'dot-success' : 'dot-error';
            const statusText = ok ? 'Connected' : 'Not configured';
            return `<div class="binding-item ${cssClass}"><span class="dot ${dotClass}"></span>${bindingName}<span style="margin-left:auto;font-size:0.7rem;color:var(--text-dim)">${statusText}</span></div>`;
        })
        .join('\n');

    const stateClass =
        state.state === 'READY'
            ? 'badge-success'
            : state.state === 'BOOTSTRAPPING'
              ? 'badge-warning'
              : 'badge-muted';

    return baseLayout(
        'Setup',
        `
  <p class="subtitle">First-time setup wizard</p>

  <div class="card">
    <h2>Platform Status</h2>
    <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem">
      <span class="badge ${stateClass}">
        <span class="dot ${state.state === 'READY' ? 'dot-success' : state.state === 'BOOTSTRAPPING' ? 'dot-warning' : 'dot-muted'}"></span>
        ${state.state}
      </span>
      <span style="font-size:0.75rem;color:var(--text-dim)">${escapeHtml(state.reason)}</span>
    </div>
    <p>Cloudflare Bindings</p>
    <div class="binding-grid">
      ${bindingsHtml}
    </div>
  </div>

  ${!state.bindings.d1 ? `
  <div class="alert alert-error">
    <strong>D1 Database Required</strong><br>
    The OBCF_D1 binding is not configured. Add the following to your <code>wrangler.jsonc</code>:
  </div>
  <pre class="code-block">"d1_databases": [
  {
    "binding": "OBCF_D1",
    "database_name": "ottabase-db",
    "database_id": "YOUR_D1_DATABASE_ID"
  }
]</pre>
  <p style="font-size:0.8125rem;color:var(--text-dim);margin-bottom:1.5rem">
    Create a D1 database: <code style="color:var(--accent-light)">wrangler d1 create ottabase-db</code>
  </p>
  ` : ''}

  ${!state.bindings.kv ? `
  <div class="alert alert-warning">
    <strong>KV Namespace Recommended</strong><br>
    OBCF_KV is not configured. KV is used to cache platform state for faster cold starts.
  </div>
  ` : ''}

  <div class="card" id="setup-card">
    <h2>Database Setup</h2>
    <p>This will create all required tables, run migrations, and set up RBAC, audit logging, and multi-tenant support.</p>

    <ul class="step-list" id="step-list">
      <li class="step-item step-pending" data-step="meta">
        <div class="step-icon">1</div>
        <span class="step-label">Create platform meta table</span>
        <span class="step-status">Waiting</span>
      </li>
      <li class="step-item step-pending" data-step="schema">
        <div class="step-icon">2</div>
        <span class="step-label">Create schema tables (users, sessions, roles...)</span>
        <span class="step-status">Waiting</span>
      </li>
      <li class="step-item step-pending" data-step="migrations">
        <div class="step-icon">3</div>
        <span class="step-label">Run core migrations (RBAC, audit, indexes)</span>
        <span class="step-status">Waiting</span>
      </li>
      <li class="step-item step-pending" data-step="finalize">
        <div class="step-icon">4</div>
        <span class="step-label">Finalize and mark platform ready</span>
        <span class="step-status">Waiting</span>
      </li>
    </ul>

    <div class="progress-bar"><div class="progress-fill" id="progress-fill"></div></div>

    <button class="btn btn-primary" id="btn-init" ${!state.bindings.d1 ? 'disabled' : ''}>
      Initialize Database
    </button>

    <div id="btn-finalize-wrap" style="display:none;margin-top:0.75rem">
      <button class="btn btn-primary" id="btn-finalize">
        Finalize Setup
      </button>
    </div>

    <div id="btn-go-wrap" style="display:none;margin-top:0.75rem">
      <a href="/" class="btn btn-primary" style="text-decoration:none">
        Go to Application
      </a>
    </div>

    <div class="log-area" id="log-area"></div>
  </div>

  <script>
  (function() {
    const btnInit = document.getElementById('btn-init');
    const btnFinalize = document.getElementById('btn-finalize');
    const btnFinalizeWrap = document.getElementById('btn-finalize-wrap');
    const btnGoWrap = document.getElementById('btn-go-wrap');
    const logArea = document.getElementById('log-area');
    const progressFill = document.getElementById('progress-fill');
    const steps = document.querySelectorAll('.step-item');

    function log(msg, type) {
      logArea.classList.add('visible');
      const line = document.createElement('div');
      line.className = 'log-line' + (type ? ' log-' + type : '');
      line.textContent = msg;
      logArea.appendChild(line);
      logArea.scrollTop = logArea.scrollHeight;
    }

    function setStep(stepId, status, statusText) {
      const el = document.querySelector('[data-step="' + stepId + '"]');
      if (!el) return;
      el.className = 'step-item step-' + status;
      const statusEl = el.querySelector('.step-status');
      if (statusEl) statusEl.textContent = statusText || status;
      if (status === 'running') {
        el.querySelector('.step-icon').innerHTML = '<span class="spinner"></span>';
      } else if (status === 'done') {
        el.querySelector('.step-icon').textContent = '\\u2713';
      } else if (status === 'error') {
        el.querySelector('.step-icon').textContent = '\\u2717';
      }
    }

    function setProgress(pct) {
      progressFill.style.width = pct + '%';
    }

    btnInit.addEventListener('click', async function() {
      btnInit.disabled = true;
      btnInit.innerHTML = '<span class="spinner"></span> Initializing...';

      log('Starting database initialization...', 'info');

      // Step 1: Meta table
      setStep('meta', 'running', 'Creating...');
      setProgress(10);
      log('Creating _ottabase_meta table...', 'info');

      // Step 2+3: Run init (autoInit + core SQL migrations)
      try {
        setStep('meta', 'done', 'Done');
        setStep('schema', 'running', 'Creating...');
        setProgress(25);
        log('Running autoInit (schema tables + migrations)...', 'info');

        const initRes = await fetch('/__bootstrap__/api/init', { method: 'POST' });
        const initData = await initRes.json();

        if (!initRes.ok || !initData.success) {
          throw new Error(initData.error || initData.message || 'Initialization failed');
        }

        // Log autoInit results
        const ai = initData.autoInit;
        if (ai) {
          if (ai.tablesCreated && ai.tablesCreated.length > 0) {
            log('Tables created: ' + ai.tablesCreated.join(', '), 'success');
          }
          if (ai.tablesSkipped && ai.tablesSkipped.length > 0) {
            log('Tables already existed: ' + ai.tablesSkipped.join(', '), '');
          }
          if (ai.columnsAdded && ai.columnsAdded.length > 0) {
            log('Columns added: ' + ai.columnsAdded.join(', '), 'success');
          }
          if (ai.customMigrationsRun && ai.customMigrationsRun.length > 0) {
            log('Custom migrations: ' + ai.customMigrationsRun.join(', '), 'success');
          }
          if (ai.errors && ai.errors.length > 0) {
            ai.errors.forEach(function(e) { log('Warning: ' + e, 'error'); });
          }
        }

        setStep('schema', 'done', 'Done');
        setProgress(50);

        // Log SQL migration results
        setStep('migrations', 'running', 'Running...');
        setProgress(65);
        const sql = initData.sqlMigrations;
        if (sql) {
          if (sql.executed && sql.executed.length > 0) {
            log('SQL migrations executed: ' + sql.executed.join(', '), 'success');
          }
          if (sql.skipped && sql.skipped.length > 0) {
            log('SQL migrations skipped: ' + sql.skipped.join(', '), '');
          }
          if (sql.errors && sql.errors.length > 0) {
            sql.errors.forEach(function(e) { log('SQL error: ' + e, 'error'); });
          }
        }

        setStep('migrations', 'done', 'Done');
        setProgress(80);
        log('Database initialization complete.', 'success');

        // Show finalize button
        setStep('finalize', 'pending', 'Ready');
        btnFinalizeWrap.style.display = 'block';
        btnInit.innerHTML = 'Initialization Complete';

      } catch (err) {
        log('Error: ' + err.message, 'error');
        setStep('schema', 'error', 'Failed');
        btnInit.innerHTML = 'Retry Initialization';
        btnInit.disabled = false;
      }
    });

    btnFinalize.addEventListener('click', async function() {
      btnFinalize.disabled = true;
      btnFinalize.innerHTML = '<span class="spinner"></span> Finalizing...';
      setStep('finalize', 'running', 'Finalizing...');
      setProgress(90);
      log('Verifying core tables and finalizing...', 'info');

      try {
        const res = await fetch('/__bootstrap__/api/finalize', { method: 'POST' });
        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Finalization failed');
        }

        setStep('finalize', 'done', 'Done');
        setProgress(100);
        log('Platform state set to READY.', 'success');
        log('Setup complete! Redirecting...', 'success');

        btnFinalizeWrap.style.display = 'none';
        btnGoWrap.style.display = 'block';

        // Auto-redirect after 2 seconds
        setTimeout(function() { window.location.href = '/'; }, 2000);
      } catch (err) {
        log('Finalize error: ' + err.message, 'error');
        setStep('finalize', 'error', 'Failed');
        btnFinalize.innerHTML = 'Retry Finalize';
        btnFinalize.disabled = false;
      }
    });

    // Auto-refresh status on load
    ${state.state === 'READY' ? `
    setStep('meta', 'done', 'Done');
    setStep('schema', 'done', 'Done');
    setStep('migrations', 'done', 'Done');
    setStep('finalize', 'done', 'Done');
    setProgress(100);
    btnInit.style.display = 'none';
    btnGoWrap.style.display = 'block';
    log('Platform is already initialized and ready.', 'success');
    ` : ''}
  })();
  </script>
  `,
    );
}

// ============================================================
// Maintenance page — panic mode
// ============================================================

export function renderMaintenancePage(state: PlatformStateResult): string {
    return baseLayout(
        'Maintenance',
        `
  <p class="subtitle">Platform Maintenance</p>
  <div class="card">
    <h2>Database Unreachable</h2>
    <div class="alert alert-error">
      <strong>Service Degraded</strong><br>
      The KV cache indicates the platform was previously running, but the D1 database probe has failed.
      This usually indicates a temporary Cloudflare issue or a misconfigured binding.
    </div>
    <p>${escapeHtml(state.reason)}</p>
    <p style="margin-top:1rem;font-size:0.8125rem;color:var(--text-dim)">
      The platform will automatically recover when D1 becomes reachable again.
      This page will refresh automatically.
    </p>
  </div>
  <script>setTimeout(function(){ location.reload(); }, 15000);</script>
  `,
    );
}

// ============================================================
// Locked page — ENV override
// ============================================================

export function renderLockedPage(state: PlatformStateResult): string {
    return baseLayout(
        'Locked',
        `
  <p class="subtitle">Platform Locked</p>
  <div class="card">
    <h2>Administrative Lock Active</h2>
    <div class="alert alert-warning">
      <strong>Platform Halted</strong><br>
      The environment variable <code>OTTABASE_LOCKED</code> is set. All requests are being blocked.
    </div>
    <p>To unlock the platform, remove the <code>OTTABASE_LOCKED</code> environment variable
    from your wrangler configuration or Cloudflare dashboard, then redeploy.</p>
    <pre class="code-block"># In wrangler.jsonc → vars:
# Remove or set to "false":
"OTTABASE_LOCKED": "false"</pre>
  </div>
  `,
    );
}

// ============================================================
// Bindings error page — missing critical bindings
// ============================================================

export function renderBindingsErrorPage(state: PlatformStateResult): string {
    const missingBindings = Object.entries(state.bindings)
        .filter(([_, ok]) => !ok)
        .map(([name]) => BINDING_LABELS[name] || name);

    return baseLayout(
        'Configuration Required',
        `
  <p class="subtitle">Cloudflare bindings not configured</p>
  <div class="card">
    <h2>Missing Bindings</h2>
    <div class="alert alert-error">
      <strong>Required Configuration Missing</strong><br>
      The following Cloudflare bindings need to be configured in your <code>wrangler.jsonc</code>
      before ${BRAND} can start:
    </div>
    <ul style="margin:1rem 0;padding-left:1.5rem">
      ${missingBindings.map((b) => `<li style="color:var(--error);margin-bottom:0.25rem">${escapeHtml(b)}</li>`).join('\n')}
    </ul>
    <p>Minimum required binding:</p>
    <pre class="code-block">// wrangler.jsonc
{
  "d1_databases": [{
    "binding": "OBCF_D1",
    "database_name": "ottabase-db",
    "database_id": "YOUR_ID"
  }],
  "kv_namespaces": [{
    "binding": "OBCF_KV",
    "id": "YOUR_ID"
  }]
}</pre>
    <p style="font-size:0.8125rem;color:var(--text-dim)">
      Create resources with:<br>
      <code style="color:var(--accent-light)">wrangler d1 create ottabase-db</code><br>
      <code style="color:var(--accent-light)">wrangler kv namespace create OBCF_KV</code>
    </p>
  </div>
  `,
    );
}

// ============================================================
// Helpers
// ============================================================

const BINDING_LABELS: Record<string, string> = {
    d1: 'OBCF_D1 (D1 Database)',
    kv: 'OBCF_KV (KV Namespace)',
    r2: 'OBCF_R2 (R2 Bucket)',
    queue: 'OBCF_QUEUE (Queue)',
    assets: 'OBCF_ASSETS (Static Assets)',
};

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

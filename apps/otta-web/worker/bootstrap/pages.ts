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
    padding: 2rem 1rem;
    line-height: 1.6;
  }
  .container { max-width: 680px; width: 100%; }
  .header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.25rem; }
  .logo { font-size: 1.25rem; font-weight: 700; letter-spacing: -0.02em; }
  .logo span { color: var(--accent-light); }
  .version { font-size: 0.7rem; color: var(--text-dim); background: var(--bg-card); padding: 0.125rem 0.5rem; border-radius: 9999px; border: 1px solid var(--border); }
  .subtitle { color: var(--text-muted); font-size: 0.875rem; margin-bottom: 2rem; }
  .card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.5rem; margin-bottom: 1rem; }
  .card h2 { font-size: 1rem; font-weight: 600; margin-bottom: 0.5rem; }
  .card p { color: var(--text-muted); font-size: 0.8125rem; margin-bottom: 0.75rem; }
  .card h3 { font-size: 0.875rem; font-weight: 600; margin-bottom: 0.5rem; color: var(--text-muted); }
  .badge { display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.2rem 0.625rem; border-radius: 9999px; font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  .badge-success { background: var(--success-bg); color: var(--success); }
  .badge-warning { background: var(--warning-bg); color: var(--warning); }
  .badge-error { background: var(--error-bg); color: var(--error); }
  .badge-muted { background: rgba(161, 161, 170, 0.1); color: var(--text-muted); }
  .dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
  .dot-success { background: var(--success); }
  .dot-warning { background: var(--warning); }
  .dot-error { background: var(--error); }
  .dot-muted { background: var(--text-dim); }
  .binding-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.375rem; margin: 0.75rem 0; }
  .binding-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.375rem 0.625rem; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 0.75rem; font-family: var(--font-mono); }
  .binding-item.ok { border-color: rgba(34, 197, 94, 0.25); }
  .binding-item.missing { border-color: rgba(239, 68, 68, 0.25); opacity: 0.65; }
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.625rem 1.25rem; border: none; border-radius: var(--radius-sm); font-size: 0.8125rem; font-weight: 600; cursor: pointer; transition: all 0.15s ease; font-family: var(--font); width: 100%; }
  .btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .btn-primary { background: var(--accent); color: white; }
  .btn-primary:hover:not(:disabled) { background: var(--accent-light); box-shadow: 0 0 24px var(--accent-glow); }
  .btn-outline { background: transparent; color: var(--text); border: 1px solid var(--border); }
  .btn-outline:hover:not(:disabled) { background: var(--bg-card-hover); border-color: var(--border-accent); }
  .btn-sm { padding: 0.375rem 0.75rem; font-size: 0.75rem; }

  /* Steps */
  .steps { display: flex; gap: 0; margin-bottom: 1.5rem; position: relative; }
  .step-tab { flex: 1; text-align: center; padding: 0.75rem 0.25rem; font-size: 0.6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-dim); border-bottom: 2px solid var(--border); cursor: default; transition: all 0.2s; }
  .step-tab.active { color: var(--accent-light); border-bottom-color: var(--accent-light); }
  .step-tab.done { color: var(--success); border-bottom-color: var(--success); }
  .step-tab.error { color: var(--error); border-bottom-color: var(--error); }
  .step-panel { display: none; }
  .step-panel.active { display: block; }

  /* Forms */
  .form-group { margin-bottom: 0.75rem; }
  .form-label { display: block; font-size: 0.75rem; font-weight: 600; color: var(--text-muted); margin-bottom: 0.25rem; }
  .form-input { width: 100%; padding: 0.5rem 0.75rem; background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-size: 0.8125rem; font-family: var(--font); outline: none; transition: border-color 0.15s; }
  .form-input:focus { border-color: var(--accent-light); }
  .form-input::placeholder { color: var(--text-dim); }
  .form-hint { font-size: 0.6875rem; color: var(--text-dim); margin-top: 0.25rem; }
  .form-error { font-size: 0.6875rem; color: var(--error); margin-top: 0.25rem; }

  /* Misc */
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner { width: 14px; height: 14px; border: 2px solid var(--border); border-top-color: var(--accent-light); border-radius: 50%; animation: spin 0.6s linear infinite; display: inline-block; }
  .log-area { background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.75rem; font-family: var(--font-mono); font-size: 0.6875rem; color: var(--text-muted); max-height: 180px; overflow-y: auto; margin-top: 0.75rem; display: none; }
  .log-area.visible { display: block; }
  .log-line { padding: 0.0625rem 0; }
  .log-success { color: var(--success); }
  .log-error { color: var(--error); }
  .log-info { color: var(--accent-light); }
  .alert { padding: 0.75rem 1rem; border-radius: var(--radius-sm); font-size: 0.8125rem; margin-bottom: 0.75rem; }
  .alert-error { background: var(--error-bg); border: 1px solid rgba(239, 68, 68, 0.25); color: var(--error); }
  .alert-warning { background: var(--warning-bg); border: 1px solid rgba(234, 179, 8, 0.25); color: var(--warning); }
  .alert-success { background: var(--success-bg); border: 1px solid rgba(34, 197, 94, 0.25); color: var(--success); }
  pre.code-block { background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 0.75rem; font-family: var(--font-mono); font-size: 0.75rem; overflow-x: auto; margin: 0.5rem 0; color: var(--text-muted); white-space: pre; }
  .progress-bar { width: 100%; height: 3px; background: var(--border); border-radius: 2px; margin: 1rem 0 0.5rem; overflow: hidden; }
  .progress-fill { height: 100%; background: var(--accent-light); border-radius: 2px; transition: width 0.3s ease; width: 0%; }
  .env-table { width: 100%; font-size: 0.75rem; border-collapse: collapse; }
  .env-table td { padding: 0.375rem 0.5rem; border-bottom: 1px solid var(--border); vertical-align: top; }
  .env-table td:first-child { font-family: var(--font-mono); color: var(--accent-light); white-space: nowrap; width: 1%; }
  .env-table td:last-child { color: var(--text-dim); }
  .footer { margin-top: 2rem; text-align: center; font-size: 0.6875rem; color: var(--text-dim); }
  .footer a { color: var(--accent-light); text-decoration: none; }
  .footer a:hover { text-decoration: underline; }
  .check-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.25rem 0; font-size: 0.8125rem; }
  .check-icon { font-size: 0.875rem; width: 1.25rem; text-align: center; }
  .check-ok { color: var(--success); }
  .check-fail { color: var(--error); }
  .check-warn { color: var(--warning); }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <div class="logo"><span>&#9670;</span> ${BRAND}</div>
    <span class="version">Setup Wizard</span>
  </div>
  ${body}
  <div class="footer">${BRAND} &middot; Edge-first application framework</div>
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
            const label = BINDING_LABELS[name] || name;
            return `<div class="binding-item ${ok ? 'ok' : 'missing'}"><span class="dot ${ok ? 'dot-success' : 'dot-error'}"></span>${label}<span style="margin-left:auto;font-size:0.625rem;color:var(--text-dim)">${ok ? 'OK' : 'Missing'}</span></div>`;
        })
        .join('\n');

    const isReady = state.state === 'READY';

    return baseLayout(
        'Setup',
        `
  <style>
    .nav-buttons { display: flex; align-items: center; justify-content: space-between; margin-top: 1.5rem; border-top: 1px solid var(--border); padding-top: 1rem; }
    .timer-area { font-size: 0.75rem; color: var(--text-dim); text-align: center; margin-top: 0.75rem; height: 1.25rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
    .btn-link { background: none; border: none; padding: 0; color: var(--text-muted); cursor: pointer; font-size: 0.75rem; text-decoration: underline; }
    .btn-link:hover { color: var(--text); }
  </style>

  <p class="subtitle">Set up your platform in a few steps</p>

  <!-- Step tabs -->
  <div class="steps" id="step-tabs">
    <div class="step-tab active" data-step="0">1. Database</div>
    <div class="step-tab" data-step="1">2. RBAC</div>
    <div class="step-tab" data-step="2">3. Admin</div>
    <div class="step-tab" data-step="3">4. Config</div>
    <div class="step-tab" data-step="4">5. Launch</div>
  </div>

  <div class="progress-bar"><div class="progress-fill" id="progress-fill"></div></div>

  <!-- STEP 0: Bindings + DB Init -->
  <div class="step-panel active" id="panel-0">
    <div class="card" id="cache-clear-card" style="display:none">
      <h2>Previous login in browser cache</h2>
      <p>It seems you have a previous login in browser cache. This can cause conflicts during setup. Clear it before proceeding.</p>
      <button class="btn btn-outline btn-sm" id="btn-clear-cache">Clear all ottabase.* entries</button>
    </div>
    <div class="card">

      <div class="form-group">
        <label class="form-label" for="bootstrap-secret"><h2>Bootstrap Token</h2></label>
        <input class="form-input" id="bootstrap-secret" type="text" placeholder="Secret Token" autocomplete="off">
        <div class="form-hint">Your secret token set in environment variable referenced in the apps's 'Required: Secrets' section in .env.example</div>
      </div>
    </div>
    <div class="card">
      <h2>Cloudflare Bindings</h2>
      <p>These are the Cloudflare resources attached to your worker.</p>
      <div class="binding-grid">${bindingsHtml}</div>
      ${
          !state.bindings.d1
              ? `
        <div class="alert alert-error">
          <strong>D1 Database is required.</strong> Add OBCF_D1 to your wrangler.jsonc and redeploy.
        </div>
        <pre class="code-block">wrangler d1 create ottabase-db
# Then add the database_id to wrangler.jsonc</pre>
      `
              : ''
      }
      ${!state.bindings.kv ? `<div class="alert alert-warning">KV (OBCF_KV) is recommended for state caching and session management.</div>` : ''}
    </div>
    <div class="card">
      <h2>Cloudflare API Variables</h2>
      <p>These are <em>not</em> Worker bindings - they are environment variables used by the CLI and optional analytics features.</p>
      <table class="env-table" style="margin-top:0.5rem">
        <thead>
          <tr style="font-size:0.6875rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--text-dim)">
            <td style="padding-bottom:0.5rem">Variable</td>
            <td style="padding-bottom:0.5rem">Required</td>
            <td style="padding-bottom:0.5rem">Purpose & Notes</td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CLOUDFLARE_ACCOUNT_ID</td>
            <td><span class="badge badge-warning">Prod</span></td>
            <td>Needed by <code>wrangler deploy</code>, <code>pnpm cf:setup</code>, and CI/CD. Set as a GitHub Secret (<code>CF_ACCOUNT_ID</code>) for deployments. Not required for local <code>wrangler dev</code> - Wrangler emulates all bindings locally without it.</td>
          </tr>
          <tr style="border-bottom:none">
            <td>CLOUDFLARE_ANALYTICS_API_TOKEN</td>
            <td><span class="badge badge-muted">Optional</span></td>
            <td>Enables Cloudflare Analytics Engine queries (traffic stats, custom metrics). The app works fully without it - analytics dashboards will simply show no data until it is set.</td>
          </tr>
        </tbody>
      </table>
      <div class="alert alert-warning" style="margin-top:0.75rem;font-size:0.75rem">
        <strong>Why are the bindings above green without these?</strong><br>
        Worker bindings (OBCF_D1, OBCF_KV, etc.) come from <code>wrangler.jsonc</code> and are emulated by Wrangler locally - no Cloudflare account credentials are needed. These two variables are only used by the <em>Wrangler CLI</em> and optional API calls, not by the running Worker itself.
      </div>
    </div>
    <div class="card" ${!state.bindings.d1 ? 'style="opacity:0.5;pointer-events:none"' : ''}>
      <h2>Initialize Database</h2>
      <p>Creates all schema tables and runs core auth and content migrations (users, accounts, sessions, verification tokens, authenticators, posts, tags), and sets up tracking.</p>
      <div class="log-area" id="log-init"></div>
      <button class="btn btn-primary" id="btn-init" ${!state.bindings.d1 ? 'disabled' : ''}>Create Tables & Run Migrations</button>

      <div class="timer-area" id="timer-0"></div>
      <div class="nav-buttons">
        <button class="btn btn-outline btn-sm" disabled style="opacity:0">Previous</button>
        <button class="btn btn-outline btn-sm" id="btn-next-0" disabled>Next &rarr;</button>
      </div>
    </div>
  </div>

  <!-- STEP 1: RBAC Seed -->
  <div class="step-panel" id="panel-1">
    <div class="card">
      <h2>RBAC &amp; Permissions</h2>
      <p>Seed the default roles (owner, admin, editor, viewer, member) and the default organization used for system-level operations.</p>
      <div class="log-area" id="log-seed"></div>
      <button class="btn btn-primary" id="btn-seed">Seed Roles &amp; Permissions</button>

      <div class="timer-area" id="timer-1"></div>
      <div class="nav-buttons">
        <button class="btn btn-outline btn-sm" id="btn-prev-1">Previous</button>
        <button class="btn btn-outline btn-sm" id="btn-next-1" disabled>Next &rarr;</button>
      </div>
    </div>
  </div>

  <!-- STEP 2: Create Owner -->
  <div class="step-panel" id="panel-2">
    <div class="card">
      <h2>Create Owner Account</h2>
      <p>This will be the platform owner with full administrative privileges. A personal workspace organization will be created automatically.</p>
      <div class="form-group">
        <label class="form-label" for="owner-name">Name</label>
        <input class="form-input" id="owner-name" name="name" type="text" placeholder="Jane Doe" autocomplete="name">
      </div>
      <div class="form-group">
        <label class="form-label" for="owner-email">Email <span style="color:var(--error)">*</span></label>
        <input class="form-input" id="owner-email" name="email" type="email" placeholder="you@example.com" autocomplete="email" required>
        <div class="form-error" id="err-email" style="display:none"></div>
      </div>
      <div class="form-group">
        <label class="form-label" for="owner-password">Password <span style="color:var(--error)">*</span></label>
        <input class="form-input" id="owner-password" type="password" placeholder="Min 8 characters" autocomplete="new-password" required>
        <div class="form-hint">Minimum 8 characters. Use a strong, unique password.</div>
        <div class="form-error" id="err-password" style="display:none"></div>
      </div>
      <div class="log-area" id="log-owner"></div>
      <button class="btn btn-primary" id="btn-owner">Create Owner Account</button>

      <div class="timer-area" id="timer-2"></div>
      <div class="nav-buttons">
        <button class="btn btn-outline btn-sm" id="btn-prev-2">Previous</button>
        <button class="btn btn-outline btn-sm" id="btn-next-2" disabled>Next &rarr;</button>
      </div>
    </div>
  </div>

  <!-- STEP 3: Environment Config -->
  <div class="step-panel" id="panel-3">
    <div class="card">
      <h2>Environment Configuration</h2>
      <p>These environment variables should be set in your wrangler.jsonc (under <code>vars</code>) or as Cloudflare secrets for production. Not all are required for local development.</p>
      <h3>Authentication (Required for production)</h3>
      <table class="env-table">
        <tr><td>AUTH_SECRET</td><td>Session encryption key. Generate with: <code>openssl rand -base64 32</code></td></tr>
        <tr><td>AUTH_URL</td><td>Your app's public URL (e.g. <code>https://myapp.example.com</code>)</td></tr>
      </table>
      <h3 style="margin-top:0.75rem">Email (Optional)</h3>
      <table class="env-table">
        <tr><td>EMAIL_RESEND_API_KEY</td><td>API key from <a href="https://resend.com" target="_blank" style="color:var(--accent-light)">Resend</a> (recommended)</td></tr>
        <tr><td>EMAIL_FROM</td><td>Sender address (default: noreply@example.com)</td></tr>
      </table>
      <h3 style="margin-top:0.75rem">Security (Recommended)</h3>
      <table class="env-table">
        <tr><td>MIGRATION_SECRET</td><td>Protects the <code>/api/ottaorm/init</code> endpoint in production</td></tr>
        <tr><td>BOOTSTRAP_OWNER_SECRET</td><td>Protects the <code>/api/admin/promote-owner</code> endpoint</td></tr>
      </table>
      <div class="alert alert-warning" style="margin-top:0.75rem">
        For <strong>local development</strong>, these are optional. In <strong>production</strong>, at minimum set <code>AUTH_SECRET</code>.
      </div>
      <pre class="code-block">wrangler secret put AUTH_SECRET
wrangler secret put MIGRATION_SECRET</pre>

      <div class="nav-buttons">
        <button class="btn btn-outline btn-sm" id="btn-prev-3">Previous</button>
        <button class="btn btn-primary btn-sm" id="btn-next-3">Next &rarr;</button>
      </div>
    </div>
  </div>

  <!-- STEP 4: Finalize -->
  <div class="step-panel" id="panel-4">
    <div class="card">
      <h2>Ready to Launch</h2>
      <p>Final verification before marking the platform as ready.</p>
      <div id="finalize-checks" style="margin:0.75rem 0"></div>
      <div class="log-area" id="log-finalize"></div>
      <button class="btn btn-primary" id="btn-finalize">Launch Platform</button>

      <div class="nav-buttons">
        <button class="btn btn-outline btn-sm" id="btn-prev-4">Previous</button>
        <div style="width:1px"></div>
      </div>
    </div>
    <div id="success-card" style="display:none">
      <div class="card">
        <div class="alert alert-success" style="margin-bottom:0.75rem">
          <strong>Setup complete!</strong> Your platform is live and ready to go.
        </div>
        <p style="font-size:0.8125rem;color:var(--text-muted);margin-bottom:0.75rem">Sign in with the owner account you just created to get started.</p>
        <a href="/login" class="btn btn-primary" style="text-decoration:none">Go to Login</a>
      </div>
    </div>
  </div>

  <script>
  (function() {
    var currentStep = ${isReady ? 4 : 0};
    var tabs = document.querySelectorAll('.step-tab');
    var panels = document.querySelectorAll('.step-panel');
    var progress = document.getElementById('progress-fill');
    var autoAdvanceTimer = null;
    var secret = new URLSearchParams(window.location.search).get('secret');
    var secretInput = document.getElementById('bootstrap-secret');
    if (secretInput && secret) {
      secretInput.value = secret;
    }

    /* Check for ottabase.* in localStorage — show clear section only if non-allowlisted keys exist */
    (function() {
      var allowlist = ['ottabase.sidebar-state', 'ottabase.language', 'ottabase.i18n'];
      var keys = [];
      try {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf('ottabase.') === 0 && allowlist.indexOf(k) === -1) keys.push(k);
        }
      } catch (e) { /* ignore */ }
      var card = document.getElementById('cache-clear-card');
      var btn = document.getElementById('btn-clear-cache');
      if (card && btn && keys.length > 0) {
        card.style.display = 'block';
        btn.onclick = function() {
          try {
            var toRemove = [];
            for (var j = 0; j < localStorage.length; j++) {
              var k = localStorage.key(j);
              if (k && k.indexOf('ottabase.') === 0 && allowlist.indexOf(k) === -1) toRemove.push(k);
            }
            toRemove.forEach(function(k) { localStorage.removeItem(k); });
            card.style.display = 'none';
          } catch (e) { /* ignore */ }
        };
      }
    })();

    function apiFetch(url, options) {
      options = options || {};
      options.headers = options.headers || {};
      var activeSecret = secretInput && secretInput.value ? secretInput.value.trim() : secret;
      if (activeSecret) options.headers['X-Bootstrap-Secret'] = activeSecret;
      return fetch(url, options);
    }

    function clearTimer() {
      if (autoAdvanceTimer) {
        clearInterval(autoAdvanceTimer);
        autoAdvanceTimer = null;
      }
      var timerEls = document.querySelectorAll('.timer-area');
      for (var i = 0; i < timerEls.length; i++) {
        timerEls[i].innerHTML = '';
      }
    }

    // Expose cancel globally for inline onclick
    window.cancelAutoAdvance = function() {
      clearTimer();
    };

    function startAutoAdvance(nextStep) {
      clearTimer();
      var seconds = 30;
      var timerEl = document.getElementById('timer-' + (nextStep - 1));
      if (!timerEl) return;

      function update() {
        if (seconds <= 0) {
          clearTimer();
          goToStep(nextStep);
          return;
        }
        timerEl.innerHTML = 'Auto-advancing in ' + seconds + 's&hellip; <button class="btn-link" onclick="window.cancelAutoAdvance()">Cancel</button>';
        seconds--;
      }
      update();
      autoAdvanceTimer = setInterval(update, 1000);
    }

    function goToStep(n) {
      clearTimer(); // User interaction stops any timer
      currentStep = n;
      tabs.forEach(function(t, i) {
        t.classList.remove('active');
        // Mark previous steps as done if we're ahead of them
        if (i < n) t.classList.add('done');
        if (i === n) t.classList.add('active');
      });
      panels.forEach(function(p, i) {
        p.classList.toggle('active', i === n);
      });
      progress.style.width = (n / 4 * 100) + '%';
    }

    function log(areaId, msg, type) {
      var area = document.getElementById(areaId);
      area.classList.add('visible');
      var line = document.createElement('div');
      line.className = 'log-line' + (type ? ' log-' + type : '');
      line.textContent = msg;
      area.appendChild(line);
      area.scrollTop = area.scrollHeight;
      // Ensure we see the latest log
      setTimeout(function() { area.scrollTop = area.scrollHeight; }, 10);
    }

    function setBtn(btn, loading, text) {
      btn.disabled = loading;
      btn.innerHTML = loading ? '<span class="spinner"></span> ' + text : text;
    }

    // Navigation Buttons
    function bindNav(id, step) {
      var btn = document.getElementById(id);
      if (btn) btn.onclick = function() { goToStep(step); };
    }

    bindNav('btn-next-0', 1);

    bindNav('btn-prev-1', 0);
    bindNav('btn-next-1', 2);

    bindNav('btn-prev-2', 1);
    bindNav('btn-next-2', 3);

    bindNav('btn-prev-3', 2);
    bindNav('btn-next-3', 4);

    bindNav('btn-prev-4', 3);

    // --- Step 0: Init ---
    var btnInit = document.getElementById('btn-init');
    var btnNext0 = document.getElementById('btn-next-0');

    btnInit.addEventListener('click', function() {
      setBtn(btnInit, true, 'Initializing...');
      log('log-init', 'Starting database initialization...', 'info');

      apiFetch('/__bootstrap__/api/init', { method: 'POST' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (!data.success) throw new Error(data.error || 'Init failed');

          var kv = data.kvCleared;
          if (kv) {
            if (kv.skipped) log('log-init', 'KV not bound (OBCF_KV) — skipped namespace wipe.', '');
            else log('log-init', 'KV namespace wiped (' + kv.deleted + ' keys removed).', 'success');
          }

          var ai = data.autoInit;
          if (ai) {
            if (ai.tablesCreated && ai.tablesCreated.length > 0) log('log-init', 'Tables created: ' + ai.tablesCreated.join(', '), 'success');
            if (ai.tablesSkipped && ai.tablesSkipped.length > 0) log('log-init', 'Already existed: ' + ai.tablesSkipped.join(', '), '');
            if (ai.columnsAdded && ai.columnsAdded.length > 0) log('log-init', 'Columns added: ' + ai.columnsAdded.join(', '), 'success');
            if (ai.customMigrationsRun && ai.customMigrationsRun.length > 0) log('log-init', 'Migrations run: ' + ai.customMigrationsRun.join(', '), 'success');
            if (ai.errors && ai.errors.length > 0) ai.errors.forEach(function(e) { log('log-init', 'Warning: ' + e, 'error'); });
          }
          var sql = data.sqlMigrations;
          if (sql) {
            if (sql.executed && sql.executed.length > 0) log('log-init', 'SQL migrations: ' + sql.executed.join(', '), 'success');
            if (sql.skipped && sql.skipped.length > 0) log('log-init', 'SQL skipped: ' + sql.skipped.join(', '), '');
            if (sql.errors && sql.errors.length > 0) sql.errors.forEach(function(e) { log('log-init', 'SQL error: ' + e, 'error'); });
          }
          log('log-init', 'Database initialization complete.', 'success');
          setBtn(btnInit, false, 'Done');
          btnInit.disabled = true;

          // Enable Next & Start Timer
          btnNext0.disabled = false;
          startAutoAdvance(1);
        })
        .catch(function(err) {
          log('log-init', 'Error: ' + err.message, 'error');
          setBtn(btnInit, false, 'Retry');
          tabs[0].classList.add('error');
        });
    });

    // --- Step 1: Seed ---
    var btnSeed = document.getElementById('btn-seed');
    var btnNext1 = document.getElementById('btn-next-1');

    btnSeed.addEventListener('click', function() {
      setBtn(btnSeed, true, 'Seeding...');
      log('log-seed', 'Seeding RBAC roles and default organization...', 'info');

      apiFetch('/__bootstrap__/api/seed', { method: 'POST' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (!data.success) throw new Error(data.error || 'Seed failed');

          if (data.roles) {
            if (data.roles.created && data.roles.created.length > 0) log('log-seed', 'Roles created: ' + data.roles.created.join(', '), 'success');
            if (data.roles.existing) log('log-seed', 'All roles: ' + data.roles.existing.join(', '), '');
          }
          log('log-seed', 'Default org: ' + (data.defaultOrganization || 'done'), 'success');
          log('log-seed', 'RBAC setup complete.', 'success');
          setBtn(btnSeed, false, 'Done');
          btnSeed.disabled = true;

          btnNext1.disabled = false;
          startAutoAdvance(2);
        })
        .catch(function(err) {
          log('log-seed', 'Error: ' + err.message, 'error');
          setBtn(btnSeed, false, 'Retry');
          tabs[1].classList.add('error');
        });
    });

    // --- Step 2: Create Owner ---
    var btnOwner = document.getElementById('btn-owner');
    var btnNext2 = document.getElementById('btn-next-2');
    var nameInput = document.getElementById('owner-name');
    var emailInput = document.getElementById('owner-email');
    var passInput = document.getElementById('owner-password');
    var errEmail = document.getElementById('err-email');
    var errPass = document.getElementById('err-password');

    btnOwner.addEventListener('click', function() {
      errEmail.style.display = 'none';
      errPass.style.display = 'none';

      var email = emailInput.value.trim();
      var password = passInput.value;
      var name = nameInput.value.trim();

      if (!email || email.indexOf('@') < 1) {
        errEmail.textContent = 'Enter a valid email address';
        errEmail.style.display = 'block';
        return;
      }
      var strongPasswordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/;
      if (!password || !strongPasswordRegex.test(password)) {
        errPass.textContent = 'Password must be at least 8 characters and contain at least one uppercase letter and one special character.';
        errPass.style.display = 'block';
        return;
      }

      setBtn(btnOwner, true, 'Creating...');
      log('log-owner', 'Creating owner account: ' + email, 'info');

      /* Clear ottabase.* from localStorage before autologin (fresh owner = clean client state) */
      try {
        var keys = [];
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf('ottabase.') === 0) keys.push(k);
        }
        keys.forEach(function(k) { localStorage.removeItem(k); });
      } catch (e) { /* ignore */ }

      apiFetch('/__bootstrap__/api/create-owner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: email, password: password, name: name })
      })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (!data.success) {
            if (data.errors) {
              if (data.errors.email) { errEmail.textContent = data.errors.email; errEmail.style.display = 'block'; }
              if (data.errors.password) { errPass.textContent = data.errors.password; errPass.style.display = 'block'; }
            }
            throw new Error(data.error || 'Account creation failed');
          }

          log('log-owner', 'Owner account created: ' + data.user.email + ' (role: ' + data.user.role + ')', 'success');
          if (data.organizationId) log('log-owner', 'Workspace created: ' + data.organizationId, 'success');

          /* Always clear stale auth/org bootstrap storage after owner creation */
          try {
            localStorage.removeItem('ottabase.auth-session');
            localStorage.removeItem('ottabase.current-org-id');
            localStorage.removeItem('ottabase.org-id');
          } catch (e) { /* ignore storage failures */ }

          /* Pre-hydrate localStorage so ProtectedRoute.hasValidStoredSession() passes
             and the app doesn't redirect to /login before the cookie-based session loads */
          try {
            var session = {
              user: {
                id: data.user.id,
                email: data.user.email,
                name: data.user.name || null,
                role: data.user.role,
                organizationId: data.organizationId || null,
                roles: [data.user.role],
                permissions: ['*:*']
              },
              expires: data.sessionExpires || (Date.now() + 30 * 24 * 60 * 60 * 1000)
            };
            //localStorage.setItem('ottabase.auth-session', JSON.stringify(session)); //Changed:Let user login
            if (data.organizationId) {
              //localStorage.setItem('ottabase.current-org-id', data.organizationId); //Changed:Let user login
            }
          } catch (e) { /* ignore storage failures */ }

          setBtn(btnOwner, false, 'Done');
          btnOwner.disabled = true;
          emailInput.disabled = true;
          passInput.disabled = true;
          nameInput.disabled = true;

          btnNext2.disabled = false;
          startAutoAdvance(3);
        })
        .catch(function(err) {
          log('log-owner', 'Error: ' + err.message, 'error');
          setBtn(btnOwner, false, 'Retry');
          tabs[2].classList.add('error');
        });
    });

    // --- Step 3: Config ---
    // (Handled by manual nav buttons now)

    // --- Step 4: Finalize ---
    var btnFinalize = document.getElementById('btn-finalize');
    var checksEl = document.getElementById('finalize-checks');
    var successCard = document.getElementById('success-card');

    function runChecks() {
      checksEl.innerHTML = '<div style="color:var(--text-dim);font-size:0.8125rem"><span class="spinner"></span> Running pre-flight checks...</div>';
      apiFetch('/__bootstrap__/api/status')
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var db = data.database || {};
          var env = data.envConfig || {};
          var html = '';

          function check(ok, label) {
            return '<div class="check-row"><span class="check-icon ' + (ok ? 'check-ok' : 'check-fail') + '">' + (ok ? '\\u2713' : '\\u2717') + '</span><span>' + label + '</span></div>';
          }
          function warn(ok, label) {
            return '<div class="check-row"><span class="check-icon ' + (ok ? 'check-ok' : 'check-warn') + '">' + (ok ? '\\u2713' : '!') + '</span><span>' + label + '</span></div>';
          }

          html += check(db.tableCount > 5, db.tableCount + ' tables created');
          html += check(db.roleCount >= 5, db.roleCount + ' roles seeded');
          html += check(db.userCount > 0, db.userCount + ' user(s) registered');
          html += warn(env.authSecret, 'AUTH_SECRET ' + (env.authSecret ? 'configured' : 'not set (needed for production)'));
          html += warn(env.emailProvider, 'Email provider ' + (env.emailProvider ? 'configured' : 'not configured (optional)'));
          html += check(data.bindings.d1, 'D1 database connected');
          html += warn(data.bindings.kv, 'KV namespace ' + (data.bindings.kv ? 'connected' : 'not configured'));

          checksEl.innerHTML = html;

          var canFinalize = db.tableCount > 0 && db.userCount > 0 && db.roleCount > 0;
          btnFinalize.disabled = !canFinalize;
        })
        .catch(function() {
          checksEl.innerHTML = '<div class="alert alert-error">Failed to fetch status</div>';
        });
    }

    btnFinalize.addEventListener('click', function() {
      setBtn(btnFinalize, true, 'Launching...');
      log('log-finalize', 'Verifying and finalizing...', 'info');

      apiFetch('/__bootstrap__/api/finalize', { method: 'POST' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (!data.success) throw new Error(data.error || 'Finalize failed');
          log('log-finalize', 'Platform state: READY', 'success');
          if (data.summary) log('log-finalize', 'Summary: ' + data.summary.tables + ' tables, ' + data.summary.users + ' users, ' + data.summary.roles + ' roles', 'success');
          setBtn(btnFinalize, false, 'Done');
          btnFinalize.disabled = true;
          successCard.style.display = 'block';
          progress.style.width = '100%';
          tabs[4].classList.add('done');
        })
        .catch(function(err) {
          log('log-finalize', 'Error: ' + err.message, 'error');
          setBtn(btnFinalize, false, 'Retry');
          tabs[4].classList.add('error');
        });
    });

    // On load: Check status and auto-advance if ready
    ${
        isReady
            ? `
    goToStep(4);
    tabs.forEach(function(t) { t.classList.add('done'); });
    progress.style.width = '100%';
    checksEl.innerHTML = '<div class="alert alert-success">Platform is already initialized and running.</div>';
    btnFinalize.style.display = 'none';
    successCard.style.display = 'block';
    `
            : `
    // Check status on load to see if we can jump to the end
    apiFetch('/__bootstrap__/api/status')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var db = data.database || {};
        // If we have tables, users, and roles OR if the backend explicitly says READY (minimal response)
        // we are effectively ready to launch.
        if (data.state === 'READY' || (db.tableCount > 0 && db.userCount > 0 && db.roleCount > 0)) {
           goToStep(4);
           // visual polish: mark previous steps as done
           tabs.forEach(function(t, i) { if (i < 4) t.classList.add('done'); });

           // Only run checks if we have the data, otherwise show simple message
           if (data.database) {
               runChecks();
           } else {
               // Minimal ready state (prod)
               checksEl.innerHTML = '<div class="alert alert-success">Platform is initialized and running.</div>';
               btnFinalize.style.display = 'none';
               successCard.style.display = 'block';
           }
        }
      })
      .catch(function() { /* ignore errors on auto-check */ });

    // Auto-run preflight when reaching step 4 manually
    var observer = new MutationObserver(function() {
      if (document.getElementById('panel-4').classList.contains('active')) {
        runChecks();
      }
    });
    panels.forEach(function(p) { observer.observe(p, { attributes: true, attributeFilter: ['class'] }); });
    `
    }
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
      <strong>Service Degraded</strong> &mdash; The KV cache reports the platform was running, but the D1 database is not responding.
    </div>
    <p>${escapeHtml(state.reason)}</p>
    <p style="margin-top:0.75rem;font-size:0.75rem;color:var(--text-dim)">This page auto-refreshes every 15 seconds.</p>
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
      <strong>Platform Halted</strong> &mdash; The <code>OTTABASE_LOCKED</code> environment variable is set.
    </div>
    <p>Remove the variable from wrangler.jsonc or your Cloudflare dashboard, then redeploy.</p>
    <pre class="code-block"># Remove or set to "false":
"OTTABASE_LOCKED": "false"</pre>
  </div>
  `,
    );
}

// ============================================================
// Bindings error page
// ============================================================

export function renderBindingsErrorPage(state: PlatformStateResult): string {
    const missing = Object.entries(state.bindings)
        .filter(([, ok]) => !ok)
        .map(([name]) => BINDING_LABELS[name] || name);

    return baseLayout(
        'Configuration Required',
        `
  <p class="subtitle">Cloudflare bindings not configured</p>
  <div class="card">
    <h2>Missing Bindings</h2>
    <div class="alert alert-error"><strong>Required configuration missing</strong></div>
    <ul style="margin:0.75rem 0 0.75rem 1.5rem;font-size:0.8125rem">
      ${missing.map((b) => `<li style="color:var(--error);margin-bottom:0.25rem">${escapeHtml(b)}</li>`).join('\n')}
    </ul>
    <pre class="code-block">// wrangler.jsonc — minimum required bindings:
"d1_databases": [{
  "binding": "OBCF_D1",
  "database_name": "ottabase-db",
  "database_id": "YOUR_ID"   // wrangler d1 create ottabase-db
}],
"kv_namespaces": [{
  "binding": "OBCF_KV",
  "id": "YOUR_ID"            // wrangler kv namespace create OBCF_KV
}]</pre>
  </div>
  `,
    );
}

// ============================================================
// Helpers
// ============================================================

const BINDING_LABELS: Record<string, string> = {
    d1: 'OBCF_D1 (D1)',
    kv: 'OBCF_KV (KV)',
    r2: 'OBCF_R2 (R2)',
    queue: 'OBCF_QUEUE (Queue)',
    assets: 'OBCF_ASSETS (Assets)',
};

function escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

import type { ParsedError, MetadataGroup, StackFrame } from './types.js';

// ─── IDE URL Templates ────────────────────────────────────────────────────
const IDE_URLS: Record<string, string> = {
    vscode: 'vscode://file/%f:%l:%c',
    textmate: 'txmt://open?url=file://%f&line=%l&column=%c',
    sublime: 'subl://open?url=file://%f&line=%l&column=%c',
    phpstorm: 'phpstorm://open?file=%f&line=%l&column=%c',
    atom: 'atom://core/open/file?filename=%f&line=%l&column=%c',
    emacs: 'emacs://open?url=file://%f&line=%l&column=%c',
    macvim: 'mvim://open?url=file://%f&line=%l&column=%c',
};

function editorUrl(ide: string, file: string, line?: number, column?: number): string {
    const template = IDE_URLS[ide] || ide;
    return template
        .replace(/%f/g, encodeURIComponent(file))
        .replace(/%l/g, String(line ?? 1))
        .replace(/%c/g, String(column ?? 1));
}

// ─── HTML Escaping ────────────────────────────────────────────────────────
function esc(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── JSON Serializer (safe, handles circular refs) ────────────────────────
function safeStringify(value: unknown, indent: number = 2): string {
    const seen = new WeakSet();
    return JSON.stringify(
        value,
        (_key, val) => {
            if (typeof val === 'object' && val !== null) {
                if (seen.has(val)) return '[Circular]';
                seen.add(val);
            }
            if (typeof val === 'bigint') return val.toString();
            if (typeof val === 'function') return `[Function: ${val.name || 'anonymous'}]`;
            if (typeof val === 'symbol') return val.toString();
            if (val === undefined) return '[undefined]';
            return val;
        },
        indent,
    );
}

// ─── CSS ──────────────────────────────────────────────────────────────────
function getStyles(): string {
    return `
    :root {
        --ep-bg: #fafafa;
        --ep-fg: #1a1a1a;
        --ep-muted: #6b7280;
        --ep-border: #e5e7eb;
        --ep-accent: #dc2626;
        --ep-accent-bg: #fef2f2;
        --ep-app-bg: #eff6ff;
        --ep-app-border: #3b82f6;
        --ep-frame-bg: #ffffff;
        --ep-frame-hover: #f9fafb;
        --ep-code-bg: #f3f4f6;
        --ep-code-fg: #374151;
        --ep-badge-bg: #e5e7eb;
        --ep-badge-fg: #374151;
        --ep-cause-bg: #fffbeb;
        --ep-cause-border: #f59e0b;
        --ep-meta-bg: #f0fdf4;
        --ep-meta-border: #22c55e;
        --ep-link: #2563eb;
        --ep-raw-bg: #f8fafc;
        --ep-tab-active: #2563eb;
        --ep-tab-inactive: #9ca3af;
    }
    html.dark {
        --ep-bg: #0f0f0f;
        --ep-fg: #e5e5e5;
        --ep-muted: #9ca3af;
        --ep-border: #2d2d2d;
        --ep-accent: #ef4444;
        --ep-accent-bg: #1c0d0d;
        --ep-app-bg: #0c1929;
        --ep-app-border: #3b82f6;
        --ep-frame-bg: #161616;
        --ep-frame-hover: #1e1e1e;
        --ep-code-bg: #1e1e1e;
        --ep-code-fg: #d1d5db;
        --ep-badge-bg: #2d2d2d;
        --ep-badge-fg: #d1d5db;
        --ep-cause-bg: #1a1400;
        --ep-cause-border: #d97706;
        --ep-meta-bg: #0a1a0a;
        --ep-meta-border: #16a34a;
        --ep-link: #60a5fa;
        --ep-raw-bg: #111111;
        --ep-tab-active: #60a5fa;
        --ep-tab-inactive: #6b7280;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        background: var(--ep-bg);
        color: var(--ep-fg);
        line-height: 1.6;
        -webkit-font-smoothing: antialiased;
    }
    .ep-container {
        max-width: 960px;
        margin: 0 auto;
        padding: 32px 24px;
    }
    /* ─── Header ───────────────────────────────── */
    .ep-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 24px;
    }
    .ep-logo {
        font-size: 13px;
        font-weight: 600;
        color: var(--ep-muted);
        letter-spacing: 0.5px;
        text-transform: uppercase;
    }
    .ep-theme-toggle {
        background: var(--ep-badge-bg);
        border: 1px solid var(--ep-border);
        color: var(--ep-fg);
        border-radius: 6px;
        padding: 4px 10px;
        font-size: 12px;
        cursor: pointer;
        transition: background 0.15s;
    }
    .ep-theme-toggle:hover { opacity: 0.8; }
    /* ─── Error Info ───────────────────────────── */
    .ep-error-info {
        background: var(--ep-accent-bg);
        border: 1px solid var(--ep-accent);
        border-radius: 8px;
        padding: 20px 24px;
        margin-bottom: 24px;
    }
    .ep-error-type {
        display: inline-block;
        background: var(--ep-accent);
        color: #fff;
        font-size: 12px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 4px;
        margin-bottom: 8px;
    }
    .ep-error-message {
        font-size: 18px;
        font-weight: 600;
        color: var(--ep-accent);
        word-break: break-word;
    }
    .ep-error-title {
        font-size: 13px;
        color: var(--ep-muted);
        margin-top: 4px;
    }
    /* ─── Properties ───────────────────────────── */
    .ep-props {
        margin-top: 12px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }
    .ep-prop-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        background: var(--ep-badge-bg);
        color: var(--ep-badge-fg);
        padding: 2px 8px;
        border-radius: 4px;
        font-family: 'SF Mono', Monaco, Consolas, monospace;
    }
    .ep-prop-key { font-weight: 600; }
    /* ─── Tabs ─────────────────────────────────── */
    .ep-tabs {
        display: flex;
        gap: 0;
        border-bottom: 1px solid var(--ep-border);
        margin-bottom: 16px;
    }
    .ep-tab {
        padding: 8px 16px;
        font-size: 13px;
        font-weight: 500;
        color: var(--ep-tab-inactive);
        cursor: pointer;
        border-bottom: 2px solid transparent;
        background: none;
        border-top: none;
        border-left: none;
        border-right: none;
        transition: color 0.15s, border-color 0.15s;
    }
    .ep-tab:hover { color: var(--ep-fg); }
    .ep-tab.active {
        color: var(--ep-tab-active);
        border-bottom-color: var(--ep-tab-active);
    }
    .ep-tab-panel { display: none; }
    .ep-tab-panel.active { display: block; }
    /* ─── Stack Frames ─────────────────────────── */
    .ep-frames { display: flex; flex-direction: column; gap: 2px; }
    .ep-frame {
        border: 1px solid var(--ep-border);
        border-radius: 6px;
        overflow: hidden;
        transition: border-color 0.15s;
    }
    .ep-frame.is-app {
        border-left: 3px solid var(--ep-app-border);
    }
    .ep-frame-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        background: var(--ep-frame-bg);
        cursor: pointer;
        user-select: none;
        transition: background 0.15s;
        font-size: 13px;
    }
    .ep-frame-header:hover { background: var(--ep-frame-hover); }
    .ep-frame-chevron {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
        transition: transform 0.15s;
        color: var(--ep-muted);
    }
    .ep-frame.open .ep-frame-chevron { transform: rotate(90deg); }
    .ep-frame-fn {
        font-weight: 600;
        color: var(--ep-fg);
        font-family: 'SF Mono', Monaco, Consolas, monospace;
        font-size: 12.5px;
    }
    .ep-frame-file {
        color: var(--ep-muted);
        font-size: 12px;
        margin-left: auto;
        text-align: right;
        flex-shrink: 0;
    }
    .ep-frame-file a {
        color: var(--ep-link);
        text-decoration: none;
    }
    .ep-frame-file a:hover { text-decoration: underline; }
    .ep-frame-body {
        display: none;
        padding: 0;
        background: var(--ep-code-bg);
        font-family: 'SF Mono', Monaco, Consolas, monospace;
        font-size: 12px;
        overflow-x: auto;
        border-top: 1px solid var(--ep-border);
    }
    .ep-frame.open .ep-frame-body { display: block; }
    .ep-frame-raw {
        padding: 12px 16px;
        color: var(--ep-code-fg);
        white-space: pre-wrap;
        word-break: break-all;
    }
    .ep-app-badge {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        background: var(--ep-app-border);
        color: #fff;
        padding: 1px 5px;
        border-radius: 3px;
        flex-shrink: 0;
    }
    /* ─── Raw Output ───────────────────────────── */
    .ep-raw {
        background: var(--ep-raw-bg);
        border: 1px solid var(--ep-border);
        border-radius: 6px;
        padding: 16px;
        overflow-x: auto;
    }
    .ep-raw pre {
        font-family: 'SF Mono', Monaco, Consolas, monospace;
        font-size: 12px;
        line-height: 1.5;
        color: var(--ep-code-fg);
        white-space: pre-wrap;
        word-break: break-word;
    }
    /* ─── Error Cause ──────────────────────────── */
    .ep-cause {
        background: var(--ep-cause-bg);
        border: 1px solid var(--ep-cause-border);
        border-radius: 8px;
        padding: 16px 20px;
        margin-top: 24px;
    }
    .ep-cause-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--ep-cause-border);
        margin-bottom: 8px;
    }
    .ep-cause-message {
        font-size: 14px;
        font-weight: 500;
        margin-bottom: 8px;
    }
    .ep-cause-type {
        display: inline-block;
        background: var(--ep-cause-border);
        color: #fff;
        font-size: 11px;
        font-weight: 600;
        padding: 1px 6px;
        border-radius: 3px;
        margin-right: 6px;
    }
    .ep-cause-frames {
        margin-top: 8px;
        font-family: 'SF Mono', Monaco, Consolas, monospace;
        font-size: 11px;
        color: var(--ep-muted);
        max-height: 150px;
        overflow-y: auto;
    }
    .ep-cause-frames div { padding: 1px 0; }
    /* ─── Metadata ─────────────────────────────── */
    .ep-metadata {
        margin-top: 24px;
    }
    .ep-meta-group {
        background: var(--ep-meta-bg);
        border: 1px solid var(--ep-meta-border);
        border-radius: 8px;
        margin-bottom: 12px;
        overflow: hidden;
    }
    .ep-meta-group-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--ep-meta-border);
        padding: 10px 16px;
        border-bottom: 1px solid var(--ep-meta-border);
        cursor: pointer;
        user-select: none;
    }
    .ep-meta-group-title:hover { opacity: 0.8; }
    .ep-meta-section {
        padding: 8px 16px;
    }
    .ep-meta-section-title {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--ep-muted);
        letter-spacing: 0.5px;
        padding: 4px 0;
    }
    .ep-meta-row {
        display: flex;
        gap: 12px;
        padding: 3px 0;
        font-size: 12.5px;
        border-bottom: 1px solid var(--ep-border);
    }
    .ep-meta-row:last-child { border-bottom: none; }
    .ep-meta-key {
        font-weight: 600;
        min-width: 120px;
        flex-shrink: 0;
        color: var(--ep-muted);
        font-family: 'SF Mono', Monaco, Consolas, monospace;
        font-size: 11.5px;
    }
    .ep-meta-value {
        color: var(--ep-fg);
        word-break: break-all;
        font-family: 'SF Mono', Monaco, Consolas, monospace;
        font-size: 11.5px;
    }
    /* ─── Footer ───────────────────────────────── */
    .ep-footer {
        margin-top: 32px;
        padding-top: 16px;
        border-top: 1px solid var(--ep-border);
        font-size: 12px;
        color: var(--ep-muted);
        text-align: center;
    }
    .ep-timestamp {
        font-size: 12px;
        color: var(--ep-muted);
        font-family: 'SF Mono', Monaco, Consolas, monospace;
    }
    /* ─── Copy Button ──────────────────────────── */
    .ep-copy-btn {
        background: var(--ep-badge-bg);
        border: 1px solid var(--ep-border);
        color: var(--ep-fg);
        border-radius: 6px;
        padding: 4px 12px;
        font-size: 12px;
        cursor: pointer;
        transition: background 0.15s, opacity 0.15s;
        margin-bottom: 8px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
    }
    .ep-copy-btn:hover { opacity: 0.8; }
    .ep-copy-btn.copied { background: var(--ep-meta-border); color: #fff; border-color: var(--ep-meta-border); }
    `;
}

// ─── JavaScript ───────────────────────────────────────────────────────────
function getScript(): string {
    return `
    (function() {
        // Theme toggle
        var html = document.documentElement;
        var toggle = document.getElementById('ep-theme-toggle');
        var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) html.classList.add('dark');
        if (toggle) {
            toggle.addEventListener('click', function() {
                html.classList.toggle('dark');
                toggle.textContent = html.classList.contains('dark') ? '☀ Light' : '● Dark';
            });
            toggle.textContent = html.classList.contains('dark') ? '☀ Light' : '● Dark';
        }

        // Frame accordion
        document.querySelectorAll('.ep-frame-header').forEach(function(header) {
            header.addEventListener('click', function() {
                var frame = header.parentElement;
                frame.classList.toggle('open');
            });
        });

        // Tabs
        document.querySelectorAll('.ep-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                var target = tab.getAttribute('data-tab');
                var container = tab.closest('.ep-container');
                container.querySelectorAll('.ep-tab').forEach(function(t) { t.classList.remove('active'); });
                container.querySelectorAll('.ep-tab-panel').forEach(function(p) { p.classList.remove('active'); });
                tab.classList.add('active');
                var panel = container.querySelector('[data-panel="' + target + '"]');
                if (panel) panel.classList.add('active');
            });
        });

        // Auto-open first app frame
        var firstAppFrame = document.querySelector('.ep-frame.is-app');
        if (firstAppFrame) firstAppFrame.classList.add('open');

        // Copy-to-clipboard for raw view
        var copyBtn = document.getElementById('ep-copy-raw');
        if (copyBtn) {
            copyBtn.addEventListener('click', function() {
                var raw = document.querySelector('.ep-raw pre');
                if (raw && navigator.clipboard) {
                    navigator.clipboard.writeText(raw.textContent || '').then(function() {
                        copyBtn.textContent = '✓ Copied';
                        copyBtn.classList.add('copied');
                        setTimeout(function() {
                            copyBtn.textContent = '📋 Copy';
                            copyBtn.classList.remove('copied');
                        }, 2000);
                    });
                }
            });
        }
    })();
    `;
}

// ─── Chevron SVG ──────────────────────────────────────────────────────────
const CHEVRON_SVG = `<svg class="ep-frame-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 4 10 8 6 12"/></svg>`;

// ─── Frame Rendering ──────────────────────────────────────────────────────
function renderFrame(frame: StackFrame, ide: string): string {
    const fnName = esc(frame.function || '(anonymous)');
    const appClass = frame.isApp ? ' is-app' : '';
    const appBadge = frame.isApp ? `<span class="ep-app-badge">app</span>` : '';

    let fileInfo = '';
    if (frame.file) {
        const loc = `${esc(frame.file)}:${frame.line ?? '?'}:${frame.column ?? '?'}`;
        const url = editorUrl(ide, frame.file, frame.line, frame.column);
        fileInfo = `<span class="ep-frame-file"><a href="${esc(url)}" title="Open in ${esc(ide)}">${loc}</a></span>`;
    }

    const rawContent = esc(frame.raw.trim());

    return `
    <div class="ep-frame${appClass}">
        <div class="ep-frame-header">
            ${CHEVRON_SVG}
            ${appBadge}
            <span class="ep-frame-fn">${fnName}</span>
            ${fileInfo}
        </div>
        <div class="ep-frame-body">
            <div class="ep-frame-raw">${rawContent}</div>
        </div>
    </div>`;
}

// ─── Cause Chain Rendering ────────────────────────────────────────────────
function renderCause(cause: ParsedError): string {
    let html = `
    <div class="ep-cause">
        <div class="ep-cause-title">⚡ Error Cause</div>
        <div>
            <span class="ep-cause-type">${esc(cause.type)}</span>
            <span class="ep-cause-message">${esc(cause.message)}</span>
        </div>`;

    if (cause.frames.length > 0) {
        html += `<div class="ep-cause-frames">`;
        for (const f of cause.frames.slice(0, 10)) {
            html += `<div>${esc(f.raw.trim())}</div>`;
        }
        if (cause.frames.length > 10) {
            html += `<div>... ${cause.frames.length - 10} more frames</div>`;
        }
        html += `</div>`;
    }

    // Recursive cause
    if (cause.cause) {
        html += renderCause(cause.cause);
    }

    html += `</div>`;
    return html;
}

// ─── Properties Rendering ─────────────────────────────────────────────────
function renderProperties(properties: Record<string, unknown>): string {
    const keys = Object.keys(properties);
    if (keys.length === 0) return '';

    let html = `<div class="ep-props">`;
    for (const key of keys) {
        const val = properties[key];
        const display = typeof val === 'object' ? JSON.stringify(val) : String(val);
        html += `<span class="ep-prop-badge"><span class="ep-prop-key">${esc(key)}:</span> ${esc(display)}</span>`;
    }
    html += `</div>`;
    return html;
}

// ─── Metadata Rendering ──────────────────────────────────────────────────
function renderMetadata(groups: MetadataGroup[]): string {
    if (groups.length === 0) return '';

    let html = `<div class="ep-metadata">`;
    for (const group of groups) {
        html += `<div class="ep-meta-group">`;
        html += `<div class="ep-meta-group-title">📋 ${esc(group.name)}</div>`;

        for (const [sectionName, rows] of Object.entries(group.sections)) {
            html += `<div class="ep-meta-section">`;
            html += `<div class="ep-meta-section-title">${esc(sectionName)}</div>`;
            for (const row of rows) {
                const val = typeof row.value === 'object' ? safeStringify(row.value) : esc(String(row.value ?? ''));
                html += `<div class="ep-meta-row">
                    <span class="ep-meta-key">${esc(row.key)}</span>
                    <span class="ep-meta-value">${typeof row.value === 'object' ? `<pre>${esc(safeStringify(row.value))}</pre>` : val}</span>
                </div>`;
            }
            html += `</div>`;
        }

        html += `</div>`;
    }
    html += `</div>`;
    return html;
}

// ─── Main Renderer ────────────────────────────────────────────────────────

/**
 * Render a ParsedError and metadata groups into a self-contained HTML page.
 *
 * @param error - The parsed error to render
 * @param metadata - Optional metadata groups to display
 * @param options - Rendering options (title, ide, cspNonce)
 */
export function renderHTML(
    error: ParsedError,
    metadata: MetadataGroup[] = [],
    options: {
        title?: string;
        ide?: string;
        cspNonce?: string;
    } = {},
): string {
    const title = options.title ?? 'An error has occurred';
    const ide = options.ide ?? 'vscode';
    const nonce = options.cspNonce ? ` nonce="${esc(options.cspNonce)}"` : '';

    // Error info section
    const errorInfo = `
    <div class="ep-error-info">
        <span class="ep-error-type">${esc(error.type)}</span>
        <div class="ep-error-message">${esc(error.message)}</div>
        <div class="ep-error-title">${esc(title)}</div>
        ${renderProperties(error.properties)}
    </div>`;

    // Stack tab
    const stackFrames = error.frames.map((f) => renderFrame(f, ide)).join('');
    const stackTab = `<div class="ep-frames">${stackFrames || '<p style="color:var(--ep-muted);font-size:13px;">No stack frames available.</p>'}</div>`;

    // Raw tab
    const rawContent = safeStringify(
        {
            type: error.type,
            message: error.message,
            properties: error.properties,
            stack: error.rawStack,
        },
        2,
    );
    const rawTab = `<button id="ep-copy-raw" class="ep-copy-btn">📋 Copy</button><div class="ep-raw"><pre>${esc(rawContent)}</pre></div>`;

    // Cause section
    const causeSection = error.cause ? renderCause(error.cause) : '';

    // Metadata section
    const metadataSection = renderMetadata(metadata);

    const timestamp = new Date().toISOString();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(error.type)}: ${esc(error.message)} — ${esc(title)}</title>
    <style${nonce}>${getStyles()}</style>
</head>
<body>
<div class="ep-container">
    <div class="ep-header">
        <span class="ep-logo">⚡ Error</span>
        <span class="ep-timestamp">${esc(timestamp)}</span>
        <button id="ep-theme-toggle" class="ep-theme-toggle">● Dark</button>
    </div>

    ${errorInfo}

    <div class="ep-tabs">
        <button class="ep-tab active" data-tab="stack">Stack Trace</button>
        <button class="ep-tab" data-tab="raw">Raw</button>
    </div>
    <div class="ep-tab-panel active" data-panel="stack">${stackTab}</div>
    <div class="ep-tab-panel" data-panel="raw">${rawTab}</div>

    ${causeSection}
    ${metadataSection}

    <div class="ep-footer">
        @ottabase/error-page &middot; Pretty error reporting for edge runtimes
    </div>
</div>
<script${nonce}>${getScript()}</script>
</body>
</html>`;
}

// ─── Production Error Page ────────────────────────────────────────────────

/**
 * Render a minimal, safe error page for production environments.
 * Does not expose stack traces, internal paths, or error details.
 *
 * @param status - HTTP status code
 * @param options - Optional title, message, and CSP nonce
 */
export function renderProductionHTML(
    status: number,
    options: {
        title?: string;
        message?: string;
        cspNonce?: string;
    } = {},
): string {
    const statusTitle = status >= 500 ? 'Server Error' : status === 404 ? 'Not Found' : 'Error';
    const title = options.title ?? statusTitle;
    const message = options.message ?? 'Something went wrong. Please try again later.';
    const nonce = options.cspNonce ? ` nonce="${esc(options.cspNonce)}"` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${status} — ${esc(title)}</title>
    <style${nonce}>
    :root {
        --ep-bg: #fafafa; --ep-fg: #1a1a1a; --ep-muted: #6b7280;
        --ep-border: #e5e7eb; --ep-accent: #dc2626; --ep-accent-bg: #fef2f2;
    }
    @media (prefers-color-scheme: dark) {
        :root {
            --ep-bg: #0f0f0f; --ep-fg: #e5e5e5; --ep-muted: #9ca3af;
            --ep-border: #2d2d2d; --ep-accent: #ef4444; --ep-accent-bg: #1c0d0d;
        }
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        background: var(--ep-bg); color: var(--ep-fg); line-height: 1.6;
        display: flex; align-items: center; justify-content: center; min-height: 100vh;
        -webkit-font-smoothing: antialiased;
    }
    .ep-prod { text-align: center; max-width: 480px; padding: 48px 24px; }
    .ep-prod-status {
        font-size: 72px; font-weight: 700; color: var(--ep-accent);
        line-height: 1; margin-bottom: 8px;
    }
    .ep-prod-title {
        font-size: 20px; font-weight: 600; margin-bottom: 12px; color: var(--ep-fg);
    }
    .ep-prod-message {
        font-size: 14px; color: var(--ep-muted); margin-bottom: 24px; line-height: 1.5;
    }
    .ep-prod-action {
        display: inline-block; padding: 8px 20px; font-size: 13px; font-weight: 500;
        color: var(--ep-fg); border: 1px solid var(--ep-border); border-radius: 6px;
        text-decoration: none; transition: background 0.15s;
    }
    .ep-prod-action:hover { background: var(--ep-accent-bg); }
    </style>
</head>
<body>
<div class="ep-prod">
    <div class="ep-prod-status">${status}</div>
    <div class="ep-prod-title">${esc(title)}</div>
    <div class="ep-prod-message">${esc(message)}</div>
    <a href="/" class="ep-prod-action">Go Home</a>
</div>
</body>
</html>`;
}

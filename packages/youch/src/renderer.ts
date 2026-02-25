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
        --youch-bg: #fafafa;
        --youch-fg: #1a1a1a;
        --youch-muted: #6b7280;
        --youch-border: #e5e7eb;
        --youch-accent: #dc2626;
        --youch-accent-bg: #fef2f2;
        --youch-app-bg: #eff6ff;
        --youch-app-border: #3b82f6;
        --youch-frame-bg: #ffffff;
        --youch-frame-hover: #f9fafb;
        --youch-code-bg: #f3f4f6;
        --youch-code-fg: #374151;
        --youch-badge-bg: #e5e7eb;
        --youch-badge-fg: #374151;
        --youch-cause-bg: #fffbeb;
        --youch-cause-border: #f59e0b;
        --youch-meta-bg: #f0fdf4;
        --youch-meta-border: #22c55e;
        --youch-link: #2563eb;
        --youch-raw-bg: #f8fafc;
        --youch-tab-active: #2563eb;
        --youch-tab-inactive: #9ca3af;
    }
    html.dark {
        --youch-bg: #0f0f0f;
        --youch-fg: #e5e5e5;
        --youch-muted: #9ca3af;
        --youch-border: #2d2d2d;
        --youch-accent: #ef4444;
        --youch-accent-bg: #1c0d0d;
        --youch-app-bg: #0c1929;
        --youch-app-border: #3b82f6;
        --youch-frame-bg: #161616;
        --youch-frame-hover: #1e1e1e;
        --youch-code-bg: #1e1e1e;
        --youch-code-fg: #d1d5db;
        --youch-badge-bg: #2d2d2d;
        --youch-badge-fg: #d1d5db;
        --youch-cause-bg: #1a1400;
        --youch-cause-border: #d97706;
        --youch-meta-bg: #0a1a0a;
        --youch-meta-border: #16a34a;
        --youch-link: #60a5fa;
        --youch-raw-bg: #111111;
        --youch-tab-active: #60a5fa;
        --youch-tab-inactive: #6b7280;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        background: var(--youch-bg);
        color: var(--youch-fg);
        line-height: 1.6;
        -webkit-font-smoothing: antialiased;
    }
    .youch-container {
        max-width: 960px;
        margin: 0 auto;
        padding: 32px 24px;
    }
    /* ─── Header ───────────────────────────────── */
    .youch-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 24px;
    }
    .youch-logo {
        font-size: 13px;
        font-weight: 600;
        color: var(--youch-muted);
        letter-spacing: 0.5px;
        text-transform: uppercase;
    }
    .youch-theme-toggle {
        background: var(--youch-badge-bg);
        border: 1px solid var(--youch-border);
        color: var(--youch-fg);
        border-radius: 6px;
        padding: 4px 10px;
        font-size: 12px;
        cursor: pointer;
        transition: background 0.15s;
    }
    .youch-theme-toggle:hover { opacity: 0.8; }
    /* ─── Error Info ───────────────────────────── */
    .youch-error-info {
        background: var(--youch-accent-bg);
        border: 1px solid var(--youch-accent);
        border-radius: 8px;
        padding: 20px 24px;
        margin-bottom: 24px;
    }
    .youch-error-type {
        display: inline-block;
        background: var(--youch-accent);
        color: #fff;
        font-size: 12px;
        font-weight: 600;
        padding: 2px 8px;
        border-radius: 4px;
        margin-bottom: 8px;
    }
    .youch-error-message {
        font-size: 18px;
        font-weight: 600;
        color: var(--youch-accent);
        word-break: break-word;
    }
    .youch-error-title {
        font-size: 13px;
        color: var(--youch-muted);
        margin-top: 4px;
    }
    /* ─── Properties ───────────────────────────── */
    .youch-props {
        margin-top: 12px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }
    .youch-prop-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        background: var(--youch-badge-bg);
        color: var(--youch-badge-fg);
        padding: 2px 8px;
        border-radius: 4px;
        font-family: 'SF Mono', Monaco, Consolas, monospace;
    }
    .youch-prop-key { font-weight: 600; }
    /* ─── Tabs ─────────────────────────────────── */
    .youch-tabs {
        display: flex;
        gap: 0;
        border-bottom: 1px solid var(--youch-border);
        margin-bottom: 16px;
    }
    .youch-tab {
        padding: 8px 16px;
        font-size: 13px;
        font-weight: 500;
        color: var(--youch-tab-inactive);
        cursor: pointer;
        border-bottom: 2px solid transparent;
        background: none;
        border-top: none;
        border-left: none;
        border-right: none;
        transition: color 0.15s, border-color 0.15s;
    }
    .youch-tab:hover { color: var(--youch-fg); }
    .youch-tab.active {
        color: var(--youch-tab-active);
        border-bottom-color: var(--youch-tab-active);
    }
    .youch-tab-panel { display: none; }
    .youch-tab-panel.active { display: block; }
    /* ─── Stack Frames ─────────────────────────── */
    .youch-frames { display: flex; flex-direction: column; gap: 2px; }
    .youch-frame {
        border: 1px solid var(--youch-border);
        border-radius: 6px;
        overflow: hidden;
        transition: border-color 0.15s;
    }
    .youch-frame.is-app {
        border-left: 3px solid var(--youch-app-border);
    }
    .youch-frame-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        background: var(--youch-frame-bg);
        cursor: pointer;
        user-select: none;
        transition: background 0.15s;
        font-size: 13px;
    }
    .youch-frame-header:hover { background: var(--youch-frame-hover); }
    .youch-frame-chevron {
        width: 16px;
        height: 16px;
        flex-shrink: 0;
        transition: transform 0.15s;
        color: var(--youch-muted);
    }
    .youch-frame.open .youch-frame-chevron { transform: rotate(90deg); }
    .youch-frame-fn {
        font-weight: 600;
        color: var(--youch-fg);
        font-family: 'SF Mono', Monaco, Consolas, monospace;
        font-size: 12.5px;
    }
    .youch-frame-file {
        color: var(--youch-muted);
        font-size: 12px;
        margin-left: auto;
        text-align: right;
        flex-shrink: 0;
    }
    .youch-frame-file a {
        color: var(--youch-link);
        text-decoration: none;
    }
    .youch-frame-file a:hover { text-decoration: underline; }
    .youch-frame-body {
        display: none;
        padding: 0;
        background: var(--youch-code-bg);
        font-family: 'SF Mono', Monaco, Consolas, monospace;
        font-size: 12px;
        overflow-x: auto;
        border-top: 1px solid var(--youch-border);
    }
    .youch-frame.open .youch-frame-body { display: block; }
    .youch-frame-raw {
        padding: 12px 16px;
        color: var(--youch-code-fg);
        white-space: pre-wrap;
        word-break: break-all;
    }
    .youch-app-badge {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        background: var(--youch-app-border);
        color: #fff;
        padding: 1px 5px;
        border-radius: 3px;
        flex-shrink: 0;
    }
    /* ─── Raw Output ───────────────────────────── */
    .youch-raw {
        background: var(--youch-raw-bg);
        border: 1px solid var(--youch-border);
        border-radius: 6px;
        padding: 16px;
        overflow-x: auto;
    }
    .youch-raw pre {
        font-family: 'SF Mono', Monaco, Consolas, monospace;
        font-size: 12px;
        line-height: 1.5;
        color: var(--youch-code-fg);
        white-space: pre-wrap;
        word-break: break-word;
    }
    /* ─── Error Cause ──────────────────────────── */
    .youch-cause {
        background: var(--youch-cause-bg);
        border: 1px solid var(--youch-cause-border);
        border-radius: 8px;
        padding: 16px 20px;
        margin-top: 24px;
    }
    .youch-cause-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--youch-cause-border);
        margin-bottom: 8px;
    }
    .youch-cause-message {
        font-size: 14px;
        font-weight: 500;
        margin-bottom: 8px;
    }
    .youch-cause-type {
        display: inline-block;
        background: var(--youch-cause-border);
        color: #fff;
        font-size: 11px;
        font-weight: 600;
        padding: 1px 6px;
        border-radius: 3px;
        margin-right: 6px;
    }
    .youch-cause-frames {
        margin-top: 8px;
        font-family: 'SF Mono', Monaco, Consolas, monospace;
        font-size: 11px;
        color: var(--youch-muted);
        max-height: 150px;
        overflow-y: auto;
    }
    .youch-cause-frames div { padding: 1px 0; }
    /* ─── Metadata ─────────────────────────────── */
    .youch-metadata {
        margin-top: 24px;
    }
    .youch-meta-group {
        background: var(--youch-meta-bg);
        border: 1px solid var(--youch-meta-border);
        border-radius: 8px;
        margin-bottom: 12px;
        overflow: hidden;
    }
    .youch-meta-group-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--youch-meta-border);
        padding: 10px 16px;
        border-bottom: 1px solid var(--youch-meta-border);
        cursor: pointer;
        user-select: none;
    }
    .youch-meta-group-title:hover { opacity: 0.8; }
    .youch-meta-section {
        padding: 8px 16px;
    }
    .youch-meta-section-title {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        color: var(--youch-muted);
        letter-spacing: 0.5px;
        padding: 4px 0;
    }
    .youch-meta-row {
        display: flex;
        gap: 12px;
        padding: 3px 0;
        font-size: 12.5px;
        border-bottom: 1px solid var(--youch-border);
    }
    .youch-meta-row:last-child { border-bottom: none; }
    .youch-meta-key {
        font-weight: 600;
        min-width: 120px;
        flex-shrink: 0;
        color: var(--youch-muted);
        font-family: 'SF Mono', Monaco, Consolas, monospace;
        font-size: 11.5px;
    }
    .youch-meta-value {
        color: var(--youch-fg);
        word-break: break-all;
        font-family: 'SF Mono', Monaco, Consolas, monospace;
        font-size: 11.5px;
    }
    /* ─── Footer ───────────────────────────────── */
    .youch-footer {
        margin-top: 32px;
        padding-top: 16px;
        border-top: 1px solid var(--youch-border);
        font-size: 12px;
        color: var(--youch-muted);
        text-align: center;
    }
    `;
}

// ─── JavaScript ───────────────────────────────────────────────────────────
function getScript(): string {
    return `
    (function() {
        // Theme toggle
        var html = document.documentElement;
        var toggle = document.getElementById('youch-theme-toggle');
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
        document.querySelectorAll('.youch-frame-header').forEach(function(header) {
            header.addEventListener('click', function() {
                var frame = header.parentElement;
                frame.classList.toggle('open');
            });
        });

        // Tabs
        document.querySelectorAll('.youch-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                var target = tab.getAttribute('data-tab');
                var container = tab.closest('.youch-container');
                container.querySelectorAll('.youch-tab').forEach(function(t) { t.classList.remove('active'); });
                container.querySelectorAll('.youch-tab-panel').forEach(function(p) { p.classList.remove('active'); });
                tab.classList.add('active');
                var panel = container.querySelector('[data-panel="' + target + '"]');
                if (panel) panel.classList.add('active');
            });
        });

        // Auto-open first app frame
        var firstAppFrame = document.querySelector('.youch-frame.is-app');
        if (firstAppFrame) firstAppFrame.classList.add('open');
    })();
    `;
}

// ─── Chevron SVG ──────────────────────────────────────────────────────────
const CHEVRON_SVG = `<svg class="youch-frame-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 4 10 8 6 12"/></svg>`;

// ─── Frame Rendering ──────────────────────────────────────────────────────
function renderFrame(frame: StackFrame, ide: string): string {
    const fnName = esc(frame.function || '(anonymous)');
    const appClass = frame.isApp ? ' is-app' : '';
    const appBadge = frame.isApp ? `<span class="youch-app-badge">app</span>` : '';

    let fileInfo = '';
    if (frame.file) {
        const loc = `${esc(frame.file)}:${frame.line ?? '?'}:${frame.column ?? '?'}`;
        const url = editorUrl(ide, frame.file, frame.line, frame.column);
        fileInfo = `<span class="youch-frame-file"><a href="${esc(url)}" title="Open in ${esc(ide)}">${loc}</a></span>`;
    }

    const rawContent = esc(frame.raw.trim());

    return `
    <div class="youch-frame${appClass}">
        <div class="youch-frame-header">
            ${CHEVRON_SVG}
            ${appBadge}
            <span class="youch-frame-fn">${fnName}</span>
            ${fileInfo}
        </div>
        <div class="youch-frame-body">
            <div class="youch-frame-raw">${rawContent}</div>
        </div>
    </div>`;
}

// ─── Cause Chain Rendering ────────────────────────────────────────────────
function renderCause(cause: ParsedError): string {
    let html = `
    <div class="youch-cause">
        <div class="youch-cause-title">⚡ Error Cause</div>
        <div>
            <span class="youch-cause-type">${esc(cause.type)}</span>
            <span class="youch-cause-message">${esc(cause.message)}</span>
        </div>`;

    if (cause.frames.length > 0) {
        html += `<div class="youch-cause-frames">`;
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

    let html = `<div class="youch-props">`;
    for (const key of keys) {
        const val = properties[key];
        const display = typeof val === 'object' ? JSON.stringify(val) : String(val);
        html += `<span class="youch-prop-badge"><span class="youch-prop-key">${esc(key)}:</span> ${esc(display)}</span>`;
    }
    html += `</div>`;
    return html;
}

// ─── Metadata Rendering ──────────────────────────────────────────────────
function renderMetadata(groups: MetadataGroup[]): string {
    if (groups.length === 0) return '';

    let html = `<div class="youch-metadata">`;
    for (const group of groups) {
        html += `<div class="youch-meta-group">`;
        html += `<div class="youch-meta-group-title">📋 ${esc(group.name)}</div>`;

        for (const [sectionName, rows] of Object.entries(group.sections)) {
            html += `<div class="youch-meta-section">`;
            html += `<div class="youch-meta-section-title">${esc(sectionName)}</div>`;
            for (const row of rows) {
                const val = typeof row.value === 'object' ? safeStringify(row.value) : esc(String(row.value ?? ''));
                html += `<div class="youch-meta-row">
                    <span class="youch-meta-key">${esc(row.key)}</span>
                    <span class="youch-meta-value">${typeof row.value === 'object' ? `<pre>${esc(safeStringify(row.value))}</pre>` : val}</span>
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
    <div class="youch-error-info">
        <span class="youch-error-type">${esc(error.type)}</span>
        <div class="youch-error-message">${esc(error.message)}</div>
        <div class="youch-error-title">${esc(title)}</div>
        ${renderProperties(error.properties)}
    </div>`;

    // Stack tab
    const stackFrames = error.frames.map((f) => renderFrame(f, ide)).join('');
    const stackTab = `<div class="youch-frames">${stackFrames || '<p style="color:var(--youch-muted);font-size:13px;">No stack frames available.</p>'}</div>`;

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
    const rawTab = `<div class="youch-raw"><pre>${esc(rawContent)}</pre></div>`;

    // Cause section
    const causeSection = error.cause ? renderCause(error.cause) : '';

    // Metadata section
    const metadataSection = renderMetadata(metadata);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${esc(error.type)}: ${esc(error.message)} — ${esc(title)}</title>
    <style${nonce}>${getStyles()}</style>
</head>
<body>
<div class="youch-container">
    <div class="youch-header">
        <span class="youch-logo">⚡ Youch</span>
        <button id="youch-theme-toggle" class="youch-theme-toggle">● Dark</button>
    </div>

    ${errorInfo}

    <div class="youch-tabs">
        <button class="youch-tab active" data-tab="stack">Stack Trace</button>
        <button class="youch-tab" data-tab="raw">Raw</button>
    </div>
    <div class="youch-tab-panel active" data-panel="stack">${stackTab}</div>
    <div class="youch-tab-panel" data-panel="raw">${rawTab}</div>

    ${causeSection}
    ${metadataSection}

    <div class="youch-footer">
        @ottabase/youch &middot; Pretty error reporting for edge runtimes
    </div>
</div>
<script${nonce}>${getScript()}</script>
</body>
</html>`;
}

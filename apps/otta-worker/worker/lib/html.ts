// Server-rendered HTML with no framework: a template string and an escaper. Reach for a
// renderer the day a page needs state; most operator pages never do.

export function escapeHtml(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// The operator page in Design System v1: the same tokens as the admin, system
// fallbacks for the two faces (no outbound font request), light and dark from
// the OS, one table, one footer line. Values mirror ui-shadcn/styles/shadcn.css.
const STYLES = `
:root { color-scheme: light dark;
  --bg: #f6f8f7; --surface: #ffffff; --surface-2: #eef2ef; --line: #e0e7e3; --fg: #121a15; --fg-2: #4b5a52; --muted: #5d6c64; --accent: #216a4d;
  --green: #1f6b4b; --amber: #8a5a00; --red: #b3261e; --smoke: #4f5d6d;
  --sans: "Inter", "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif;
  --mono: "JetBrains Mono", ui-monospace, "SF Mono", "Cascadia Mono", Consolas, monospace; }
@media (prefers-color-scheme: dark) { :root { --bg: #0f1512; --surface: #151d18; --surface-2: #1b251f; --line: #26312b; --fg: #e3ebe6; --fg-2: #aeb9b3; --muted: #8c9a93; --accent: #4cb384;
  --green: #7fd2a6; --amber: #f0c25c; --red: #f59b92; --smoke: #a5b3c4; } }
* { box-sizing: border-box; }
body { margin: 0; padding: 2rem 1rem 3rem; font: 14px/1.5 var(--sans); color: var(--fg); background: var(--bg); -webkit-font-smoothing: antialiased; }
main { max-width: 64rem; margin: 0 auto; }
h1 { font-size: 1.375rem; font-weight: 600; letter-spacing: -0.015em; line-height: 1.2; margin: 0 0 .25rem; }
p { margin: 0; }
p.muted, td.muted, .muted { color: var(--muted); }
table { width: 100%; border-collapse: separate; border-spacing: 0; margin: 1.5rem 0; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; font-size: 13px; }
th { text-align: left; padding: 0 .75rem; height: 36px; background: var(--surface-2); color: var(--muted); font-size: 12px; font-weight: 600; white-space: nowrap; border-bottom: 1px solid var(--line); }
td { text-align: left; padding: .5rem .75rem; border-bottom: 1px solid var(--line); vertical-align: top; }
tr:last-child td { border-bottom: 0; }
th:first-child, td:first-child { padding-left: 1rem; }
th:last-child, td:last-child { padding-right: 1rem; }
td b { font-weight: 600; }
code { font-family: var(--mono); font-size: 0.92em; overflow-wrap: anywhere; }
a { color: var(--accent); font-weight: 500; text-decoration: none; }
a:hover { text-decoration: underline; text-underline-offset: 3px; }
.state { display: inline-block; font-size: 12px; font-weight: 600; }
.state-active { color: var(--green); } .state-grace { color: var(--amber); } .state-expired, .state-invalid { color: var(--red); } .state-unlicensed, .state-disabled { color: var(--smoke); }
footer, p.foot { margin-top: 1.5rem; font-size: 13px; color: var(--muted); }
`;

export function page(options: { title: string; body: string }): string {
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.title)}</title>
<style>${STYLES}</style>
</head>
<body><main>${options.body}</main></body>
</html>
`;
}

export function html(body: string, status = 200): Response {
    return new Response(body, {
        status,
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    });
}

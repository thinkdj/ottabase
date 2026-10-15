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

const STYLES = `
:root { color-scheme: light dark; --fg: #1a1a1a; --bg: #fafafa; --muted: #666; --line: #ddd; --accent: #0b57d0; }
@media (prefers-color-scheme: dark) { :root { --fg: #eee; --bg: #121212; --muted: #999; --line: #333; --accent: #8ab4f8; } }
* { box-sizing: border-box; }
body { margin: 0; padding: 2rem 1rem; font: 16px/1.5 system-ui, sans-serif; color: var(--fg); background: var(--bg); }
main { max-width: 56rem; margin: 0 auto; }
h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
p.muted, td.muted { color: var(--muted); }
table { width: 100%; border-collapse: collapse; margin: 1.5rem 0; }
th, td { text-align: left; padding: .5rem .25rem; border-bottom: 1px solid var(--line); vertical-align: top; }
code { font: 0.9em ui-monospace, monospace; }
a { color: var(--accent); }
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

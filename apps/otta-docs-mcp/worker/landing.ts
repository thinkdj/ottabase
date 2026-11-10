// ============================================================
// The page a person sees at `/`: what this server is and how to connect to it
// ============================================================
// Doubles as the connector's public documentation. Everything on it is static except the
// endpoint, which is the origin the page was asked on, and the corpus counts.
// ============================================================

import { DOC_KINDS, KIND_LABEL, type Corpus } from './corpus';

const escape = (value: string) =>
    value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function landingPage(origin: string, corpus: Corpus): string {
    const endpoint = escape(`${origin}/mcp`);
    const counts = DOC_KINDS.map((kind) => {
        const n = corpus.docs.filter((doc) => doc.kind === kind).length;
        return `<li>${n} ${escape(KIND_LABEL[kind].toLowerCase())}</li>`;
    }).join('');
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ottabase Docs MCP server</title>
<meta name="description" content="The Ottabase documentation as a read-only MCP server: search, read and list the framework's docs from Claude and other MCP clients.">
<style>
:root { color-scheme: light dark; }
body { font: 16px/1.6 system-ui, sans-serif; max-width: 44rem; margin: 0 auto; padding: 2.5rem 1rem 4rem; }
h1 { font-size: 1.6rem; line-height: 1.25; margin: 0 0 .5rem; }
h2 { font-size: 1.1rem; margin: 2.25rem 0 .5rem; }
code, pre { font: .875rem/1.5 ui-monospace, SFMono-Regular, Consolas, monospace; }
pre { padding: .75rem 1rem; border: 1px solid color-mix(in srgb, currentColor 20%, transparent); border-radius: .5rem; overflow-x: auto; }
table { border-collapse: collapse; width: 100%; }
th, td { text-align: left; vertical-align: top; padding: .4rem .75rem .4rem 0; border-bottom: 1px solid color-mix(in srgb, currentColor 15%, transparent); }
.lede { opacity: .8; margin-top: 0; }
</style>
</head>
<body>
<h1>Ottabase Docs MCP server</h1>
<p class="lede">The documentation of <a href="https://ottabase.com">Ottabase</a>, the open source framework for building SaaS apps on Cloudflare Workers, as a Model Context Protocol server. An assistant connected to it can search and read the docs while it helps you build.</p>

<h2>Endpoint</h2>
<pre>${endpoint}</pre>
<p>Streamable HTTP. No account, no key, no sign-in.</p>

<h2>Connect</h2>
<p><strong>Claude</strong> (web, desktop, mobile): open Customize, then Connectors, add a custom connector and paste the endpoint above.</p>
<p><strong>Claude Code</strong>:</p>
<pre>claude mcp add --transport http ottabase-docs ${endpoint}</pre>
<p><strong>Any other MCP client</strong>: add a remote server with the endpoint above and the HTTP transport.</p>
<p>Then ask something the docs answer, for example "How do I add row level security to a model in Ottabase?" or "Which Ottabase package handles file uploads, and how do I wire it in?"</p>

<h2>Tools</h2>
<table>
<tr><th>Tool</th><th>What it does</th></tr>
<tr><td><code>search_docs</code></td><td>Keyword search. Returns the best-matching sections with their document id, heading, an excerpt and a source link.</td></tr>
<tr><td><code>get_doc</code></td><td>Reads one page as Markdown by its id. A long page returns an outline; ask for one section by its heading.</td></tr>
<tr><td><code>list_docs</code></td><td>Lists every page by group, with ids and titles.</td></tr>
</table>
<p>All three only read. Nothing can be written, changed or deleted through this server.</p>

<h2>What it serves</h2>
<ul>${counts}</ul>
<p>The same Markdown that is in the <a href="https://github.com/thinkdj/ottabase">public repository</a>${corpus.revision ? ` at commit <code>${escape(corpus.revision)}</code>` : ''}, built ${escape(corpus.generatedAt.slice(0, 10))}.</p>

<h2>Privacy</h2>
<p>The server holds no accounts and sets no cookies. A request carries the tool arguments your assistant sends (a search query, a document id); the server uses them to answer and does not store them. It never sees your conversation. Cloudflare, which hosts it, keeps standard request logs (time, path, status), not request bodies. See the <a href="https://ottabase.com/privacy">privacy policy</a>.</p>

<h2>Help</h2>
<p>Something wrong or missing? <a href="https://github.com/thinkdj/ottabase/issues">Open an issue</a>. The server's source is in the repository under <code>apps/otta-docs-mcp</code>.</p>
</body>
</html>
`;
}

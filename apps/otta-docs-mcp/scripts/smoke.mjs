#!/usr/bin/env node
// ============================================================
// Smoke test against a RUNNING server, local or deployed, with the official MCP client
// ============================================================
//   node scripts/smoke.mjs                              the local dev server
//   node scripts/smoke.mjs https://mcp.ottabase.com/mcp the deployed one
//
// Lists the tools, checks what the connector directory requires of each, calls every tool
// once, and speaks to the endpoint the way a 2025-era client does. Exits 1 on any failure.
// ============================================================

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';

const url = new URL(process.argv[2] ?? 'http://127.0.0.1:8790/mcp');
const check = (ok, label) => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
    if (!ok) process.exitCode = 1;
};

const health = await fetch(new URL('/health', url)).then((response) => response.json());
check(health.ok === true, `health: ${health.docs} docs, built ${health.generatedAt}, revision ${health.revision}`);

const client = new Client({ name: 'otta-docs-mcp-smoke', version: '1.0.0' });
await client.connect(new StreamableHTTPClientTransport(url));
const server = client.getServerVersion();
check(server?.name === 'ottabase-docs', `connected to ${server?.name} ${server?.version}`);

const { tools } = await client.listTools();
check(tools.length === 3, `tools: ${tools.map((tool) => tool.name).join(', ')}`);
for (const tool of tools) {
    const titled = Boolean(tool.title ?? tool.annotations?.title);
    check(titled && tool.annotations?.readOnlyHint === true, `${tool.name}: has a title and readOnlyHint`);
}

const call = async (name, args) => {
    const started = performance.now();
    const result = await client.callTool({ name, arguments: args });
    const ms = Math.round(performance.now() - started);
    const text = result.content.map((part) => part.text).join('\n');
    check(!result.isError && text.length > 0, `${name} ${JSON.stringify(args)}: ${text.length} chars, ${ms} ms`);
    return text;
};

const found = await call('search_docs', { query: 'row level security' });
check(found.includes('packages/ottaorm/README.md'), 'search_docs finds the ottaorm README');
await call('search_docs', { query: 'upload files', kind: 'skill', limit: 3 });
const long = await call('get_doc', { id: 'packages/ottaorm/README.md' });
check(long.includes('Pass `section`'), 'get_doc returns an outline for a long page');
await call('get_doc', { id: 'ottaorm', section: 'Row-Level Security' });
await call('get_doc', { id: 'QUICKSTART.md' });
await call('list_docs', {});
await call('list_docs', { kind: 'skill' });
await client.close();

// A client that has not moved to the 2026-07-28 revision opens with `initialize`.
const legacy = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'smoke', version: '1' } },
    }),
});
check(legacy.status === 200 && (await legacy.text()).includes('ottabase-docs'), '2025-era initialize is answered');

const page = await fetch(new URL('/', url));
check(page.status === 200 && (await page.text()).includes('search_docs'), 'the page for people is served');

console.log(process.exitCode ? '\nFAILED' : '\nAll checks passed.');

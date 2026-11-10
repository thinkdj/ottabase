// ============================================================
// The Worker end to end: the official MCP client talks to the app's own fetch handler, so
// the protocol, the tool list the directory reviews and every tool's answers are exercised
// the way a real client sees them.
// ============================================================

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../worker/app';
import { MAX_DOC_CHARS, SERVER_NAME, SERVER_VERSION } from '../worker/server';
import { corpus } from './fixture';

const ORIGIN = 'https://mcp.test';
const app = createApp(corpus);
const client = new Client({ name: 'otta-docs-mcp-test', version: '1.0.0' });

beforeAll(async () => {
    await client.connect(
        new StreamableHTTPClientTransport(new URL(`${ORIGIN}/mcp`), {
            fetch: (input, init) => app(new Request(input, init)),
        }),
    );
});
afterAll(() => client.close());

const textOf = (result: { content?: unknown }) =>
    (result.content as Array<{ type: string; text: string }>).map((part) => part.text).join('\n');
const call = (name: string, args: Record<string, unknown> = {}) => client.callTool({ name, arguments: args });

describe('the server', () => {
    it('names itself', () => {
        expect(client.getServerVersion()).toMatchObject({ name: SERVER_NAME, version: SERVER_VERSION });
    });

    it('lists three tools, each with what the connector directory requires', async () => {
        const { tools } = await client.listTools();
        expect(tools.map((tool) => tool.name)).toEqual(['search_docs', 'get_doc', 'list_docs']);
        for (const tool of tools) {
            expect(tool.name.length).toBeLessThanOrEqual(64);
            expect(tool.title ?? tool.annotations?.title).toBeTruthy();
            expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
            expect(tool.description!.length).toBeGreaterThan(40);
            expect(tool.inputSchema.type).toBe('object');
        }
    });
});

describe('search_docs', () => {
    it('answers with sections, ids and source links', async () => {
        const result = await call('search_docs', { query: 'row level security' });
        expect(result.isError).toBeFalsy();
        const text = textOf(result);
        expect(text).toContain('@ottabase/ottaorm > Row level security');
        expect(text).toContain('id: packages/ottaorm/README.md');
        expect(text).toContain('source: https://github.com/thinkdj/ottabase/blob/main/packages/ottaorm/README.md');
    });

    it('says what to try when nothing matches, and refuses a bad argument with a reason', async () => {
        expect(textOf(await call('search_docs', { query: 'kubernetes helm' }))).toContain('No documentation matched');
        const bad = await call('search_docs', { query: 'x' });
        expect(bad.isError).toBe(true);
        expect(textOf(bad)).toMatch(/query/i);
    });
});

describe('get_doc', () => {
    it('reads a short page whole', async () => {
        const text = textOf(await call('get_doc', { id: 'docs/TESTING.md' }));
        expect(text).toContain('id: docs/TESTING.md');
        expect(text).toContain('## Coverage');
    });

    it('returns an outline and a first part for a long page, and one section on request', async () => {
        const long = textOf(await call('get_doc', { id: 'ottaorm' }));
        expect(long).toContain('- Row level security');
        expect(long).toContain('- Reference');
        expect(long.length).toBeLessThan(MAX_DOC_CHARS + 1500);

        const section = textOf(await call('get_doc', { id: 'ottaorm', section: 'relationships' }));
        expect(section).toContain('belongsTo, hasMany');
        // A section comes with its sub-sections, and stops at the next heading of its own level.
        expect(section).toContain('### Eager loading');
        expect(section).toContain('with("author")');
        expect(section).not.toContain('## Reference');
        // The outline shows the nesting.
        expect(long).toContain('\n    - Eager loading');
        expect(section).not.toContain('initRLS');
    });

    it('names the sections, or the closest pages, when the argument is wrong', async () => {
        const noSection = await call('get_doc', { id: 'ottaorm', section: 'nope' });
        // An answer, not an error: the directory counts `isError` as a failed call in a connector's health.
        expect(noSection.isError).toBeFalsy();
        expect(textOf(noSection)).toContain('- Relationships');

        const noDoc = await call('get_doc', { id: 'packages/queues/README.md' });
        expect(noDoc.isError).toBeFalsy();
        expect(textOf(noDoc)).toContain('packages/queue/README.md');
    });
});

describe('list_docs', () => {
    it('lists every page by group, and one group with summaries', async () => {
        const all = textOf(await call('list_docs'));
        expect(all).toContain('## Packages (2)');
        expect(all).toContain('- packages/queue/README.md: @ottabase/queue');
        expect(all).not.toContain('Job queue for Cloudflare Queues');

        const skills = textOf(await call('list_docs', { kind: 'skill' }));
        expect(skills).toContain('The Ottabase way to build CRUD');
        expect(skills).not.toContain('## Packages');
    });
});

describe('a 2025-era client', () => {
    // Clients that have not moved to the 2026-07-28 revision still open with `initialize` and then
    // call without a session. The handler's stateless fallback serves them from the same tools.
    const post = async (body: unknown) => {
        const response = await app(
            new Request(`${ORIGIN}/mcp`, {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                    accept: 'application/json, text/event-stream',
                    'mcp-protocol-version': '2025-06-18',
                },
                body: JSON.stringify(body),
            }),
        );
        const raw = await response.text();
        // Either one JSON body or an event stream whose last `data:` line is the answer.
        const json = response.headers.get('content-type')?.includes('text/event-stream')
            ? raw
                  .split('\n')
                  .filter((row) => row.startsWith('data:'))
                  .at(-1)!
                  .slice(5)
            : raw;
        return { status: response.status, rpc: JSON.parse(json) as { result?: any; error?: unknown } };
    };

    it('initializes and lists the same tools', async () => {
        const init = await post({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'old', version: '1' } },
        });
        expect(init.status).toBe(200);
        expect(init.rpc.result.serverInfo).toMatchObject({ name: SERVER_NAME });

        const list = await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
        expect(list.rpc.result.tools.map((tool: { name: string }) => tool.name)).toEqual([
            'search_docs',
            'get_doc',
            'list_docs',
        ]);

        const called = await post({
            jsonrpc: '2.0',
            id: 3,
            method: 'tools/call',
            params: { name: 'search_docs', arguments: { query: 'queue retry' } },
        });
        expect(called.rpc.result.content[0].text).toContain('packages/queue/README.md');
    });
});

describe('the other routes', () => {
    const get = (path: string, init?: RequestInit) => app(new Request(`${ORIGIN}${path}`, init));

    it('serve a page for people, a health check, and nothing else', async () => {
        const page = await get('/');
        expect(page.headers.get('content-type')).toContain('text/html');
        const html = await page.text();
        expect(html).toContain(`${ORIGIN}/mcp`);
        expect(html).toContain('search_docs');

        expect(await (await get('/health')).json()).toMatchObject({ ok: true, docs: corpus.docs.length });
        expect((await get('/nope')).status).toBe(404);
        expect((await get('/', { method: 'POST' })).status).toBe(405);
    });

    it('answer a browser preflight and open every MCP response to other origins', async () => {
        const preflight = await get('/mcp', {
            method: 'OPTIONS',
            headers: { 'Access-Control-Request-Headers': 'content-type, mcp-protocol-version' },
        });
        expect(preflight.status).toBe(204);
        expect(preflight.headers.get('Access-Control-Allow-Headers')).toBe('content-type, mcp-protocol-version');
        // The stateless handler has no session to read or end.
        const sessionless = await get('/mcp');
        expect(sessionless.status).toBe(405);
        expect(sessionless.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
});

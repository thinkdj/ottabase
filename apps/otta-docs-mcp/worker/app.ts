// ============================================================
// The Worker's routes: `/mcp` (the server), `/` (the page for people), `/health`
// ============================================================
// Stateless: the SDK's handler builds a fresh server per request, over lookup
// structures an isolate opens on its first request and keeps. The corpus arrives indexed.
//
// Open on purpose. The docs are public and the tools only read, so there is no auth, no
// Origin or Host check (Claude's own requests fail a strict one) and any site may call it.
// ponytail: no rate limit either. A call is an in-memory lookup, and all of Claude's traffic
// arrives from one address range, so a per-address limit would throttle every Claude user
// together. Add a Cloudflare WAF rate rule on the zone if the endpoint is ever abused.
// ============================================================

import { createMcpHandler } from '@modelcontextprotocol/server';
import { errorResponse, redactErrorForLog } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { Corpus } from './corpus';
import { landingPage } from './landing';
import { openIndex, type DocsIndex } from './search';
import { createDocsServer } from './server';

/** Browser-based clients (the MCP Inspector, a web app) call cross-origin. Nothing here is private. */
function cors(request: Request): Record<string, string> {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') ?? '*',
        'Access-Control-Expose-Headers': 'MCP-Protocol-Version, Mcp-Session-Id',
        'Access-Control-Max-Age': '86400',
    };
}

export function createApp(corpus: Corpus): (request: Request) => Promise<Response> {
    let index: DocsIndex | undefined;
    const docs = () => (index ??= openIndex(corpus));

    const mcp = createMcpHandler(() => createDocsServer(docs()), {
        // Never the request: a tool argument is the user's words.
        onerror: (error) => console.error('otta-docs-mcp: handler error', redactErrorForLog(error)),
    });

    return async (request) => {
        const url = new URL(request.url);

        if (url.pathname === '/mcp') {
            if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
            const response = await mcp.fetch(request);
            const open = new Response(response.body, response);
            for (const [name, value] of Object.entries(cors(request))) open.headers.set(name, value);
            return open;
        }

        if (request.method !== 'GET' && request.method !== 'HEAD') {
            return errorResponse('Method not allowed', 405, { code: 'METHOD_NOT_ALLOWED' });
        }
        if (url.pathname === '/health') {
            return jsonResponse({
                ok: true,
                docs: corpus.docs.length,
                generatedAt: corpus.generatedAt,
                revision: corpus.revision,
            });
        }
        if (url.pathname === '/') {
            return new Response(landingPage(url.origin, corpus), {
                headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
            });
        }
        return errorResponse('Not found', 404, { code: 'NOT_FOUND' });
    };
}

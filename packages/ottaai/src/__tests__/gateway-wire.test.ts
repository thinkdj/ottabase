// ============================================================
// GATEWAY WIRE CONTRACT — the literal URL, headers and body.
// ============================================================
// THIS FILE EXISTS BECAUSE OF WHAT ITS ABSENCE COST.
//
// The transport shipped with a 174-test suite passing and FOUR separate wire
// faults: `/openai/v1/chat/completions` (Cloudflare documents
// `/openai/chat/completions`, so the proxied path became `/v1/v1/…` and 404'd),
// a missing `anthropic-version` header (Anthropic rejects every versionless
// request), dynamic routes built as a URL segment (Cloudflare invokes them
// through the compat endpoint with the route in `model`), and the BYOK alias sent
// as `cf-aig-provider-key` instead of `cf-aig-byok-alias`.
//
// Every one of those is a claim about a STRING that nothing asserted. Unit tests
// over scoring, crypto and resolution cannot catch any of them, because none of
// them is wrong about a decision — they are wrong about a fact.
//
// So: assert the fact. Each expectation below is transcribed from the Cloudflare
// provider page linked on its adapter entry, and a doc change should break a test
// here rather than a tenant's inference.
// ============================================================

import { describe, expect, it } from 'vitest';
import { createProviderRegistry, withTenantSelectionRemoved } from '../registry';
import { SecretValue } from '../secret';
import type { MergedTransportConfig } from '../types';
import { createGatewayTransport } from '../transports/gateway';
import { GATEWAY_PROVIDERS } from '../transports/providers';

const ACCOUNT = 'acct-123';
const GATEWAY = 'my-gateway';
const BASE = `https://gateway.ai.cloudflare.com/v1/${ACCOUNT}/${GATEWAY}`;

interface Captured {
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
}

/** A fetch stub that records the request and answers with a minimal OpenAI-shaped payload. */
function capturingFetch(captured: Captured[], response?: unknown): typeof fetch {
    return (async (url: string, init: RequestInit) => {
        const headers: Record<string, string> = {};
        new Headers(init.headers).forEach((value, key) => {
            headers[key] = value;
        });
        captured.push({ url: String(url), headers, body: JSON.parse(String(init.body)) });
        return new Response(JSON.stringify(response ?? { choices: [{ message: { content: 'ok' } }] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }) as unknown as typeof fetch;
}

function configFor(overrides: Partial<MergedTransportConfig> = {}): MergedTransportConfig {
    return {
        provider: 'openai',
        model: 'openai/gpt-4o-mini',
        secret: new SecretValue('sk-tenant-key'),
        alias: null,
        accountId: ACCOUNT,
        gateway: GATEWAY,
        gatewayToken: undefined,
        transportConfig: {},
        provenance: {
            source: 'byok',
            credentialId: 'cred-1',
            taskKey: 'assist',
            appId: 'app-1',
            organizationId: null,
            userId: 'user-1',
        },
        ...overrides,
    };
}

async function callOnce(
    config: Partial<MergedTransportConfig>,
    options: Parameters<ReturnType<typeof makeClient>['complete']>[0] = { messages: [{ role: 'user', content: 'hi' }] },
    response?: unknown,
): Promise<Captured> {
    const captured: Captured[] = [];
    const client = makeClient({ ...config, fetch: capturingFetch(captured, response) });
    await client.complete(options);
    expect(captured).toHaveLength(1);
    return captured[0]!;
}

function makeClient(overrides: Partial<MergedTransportConfig>) {
    const transport = createGatewayTransport({ registry: createProviderRegistry() });
    return transport.createClient(configFor(overrides));
}

// ---------------------------------------------------------------------------
// URLs — one per supported provider, quoted from the Cloudflare docs
// ---------------------------------------------------------------------------

describe('provider URLs are the documented ones, and they are NOT uniform', () => {
    it.each([
        // provider            model                    expected path after the gateway base
        ['openai', 'gpt-4o-mini', '/openai/chat/completions'],
        ['anthropic', 'claude-sonnet-4-5', '/anthropic/v1/messages'],
        ['groq', 'llama-3.3-70b', '/groq/chat/completions'],
        ['deepseek', 'deepseek-chat', '/deepseek/chat/completions'],
        ['perplexity', 'sonar', '/perplexity-ai/chat/completions'],
        // WITH `/v1` — the gateway proxies to api.mistral.ai, which is versionless.
        ['mistral', 'mistral-small-latest', '/mistral/v1/chat/completions'],
    ])('%s → %s', async (provider, model, path) => {
        const captured = await callOnce({ provider, model: `${provider}/${model}` });
        expect(captured.url).toBe(`${BASE}${path}`);
    });

    it('never emits the `/v1` that used to be appended to every OpenAI-shaped provider', async () => {
        // The regression, named: `/openai/v1/chat/completions` proxies to
        // `api.openai.com/v1/v1/chat/completions`, which 404s — and a 404 from this transport
        // is classified MODEL_NOT_FOUND, so it reads to the tenant as a bad model name.
        const captured = await callOnce({ provider: 'openai', model: 'openai/gpt-4o-mini' });
        expect(captured.url).not.toContain('/openai/v1/');
    });

    it('puts the Gemini model in the PATH and keeps it out of the body', async () => {
        const captured = await callOnce(
            { provider: 'google-ai-studio', model: 'google-ai-studio/gemini-2.5-flash' },
            { messages: [{ role: 'user', content: 'hi' }] },
            { candidates: [{ content: { parts: [{ text: 'ok' }] } }] },
        );
        expect(captured.url).toBe(`${BASE}/google-ai-studio/v1/models/gemini-2.5-flash:generateContent`);
        expect(captured.body).not.toHaveProperty('model');
    });

    it('builds the Azure resource/deployment path from OPERATOR transport config', async () => {
        const captured = await callOnce({
            provider: 'azure',
            model: 'azure/gpt-4o',
            transportConfig: { resourceName: 'my-res', deploymentName: 'my-dep', apiVersion: '2024-10-21' },
        });
        expect(captured.url).toBe(`${BASE}/azure-openai/my-res/my-dep/chat/completions?api-version=2024-10-21`);
    });

    it('refuses Azure with a NAMED error rather than building a URL that 404s', async () => {
        const client = makeClient({ provider: 'azure', model: 'azure/gpt-4o', fetch: capturingFetch([]) });
        const result = await client.complete({ messages: [{ role: 'user', content: 'hi' }] });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.message).toMatch(/resourceName/);
            expect(result.error.retryable).toBe(false);
        }
    });
});

// ---------------------------------------------------------------------------
// Headers
// ---------------------------------------------------------------------------

describe('auth and provider-mandated headers', () => {
    it('sends Anthropic the REQUIRED anthropic-version header', async () => {
        // Its absence fails 100% of Anthropic calls, with a message about the header rather
        // than about the key — so it is debugged as a credential problem.
        const captured = await callOnce({ provider: 'anthropic', model: 'anthropic/claude-sonnet-4-5' });
        expect(captured.headers['anthropic-version']).toBe('2023-06-01');
        expect(captured.headers['x-api-key']).toBe('sk-tenant-key');
        expect(captured.headers.authorization).toBeUndefined();
    });

    it('uses each provider own auth scheme, not a Bearer default', async () => {
        const openai = await callOnce({ provider: 'openai', model: 'openai/gpt-4o-mini' });
        expect(openai.headers.authorization).toBe('Bearer sk-tenant-key');

        const google = await callOnce(
            { provider: 'google-ai-studio', model: 'google-ai-studio/gemini-2.5-flash' },
            { messages: [{ role: 'user', content: 'hi' }] },
            { candidates: [] },
        );
        expect(google.headers['x-goog-api-key']).toBe('sk-tenant-key');

        const azure = await callOnce({
            provider: 'azure',
            model: 'azure/gpt-4o',
            transportConfig: { resourceName: 'r', deploymentName: 'd', apiVersion: '2024-10-21' },
        });
        expect(azure.headers['api-key']).toBe('sk-tenant-key');
    });

    it('NEVER puts a key in the URL, for any provider', async () => {
        // A key in a URL is a key in a log — access logs, proxy logs, referrers, error
        // reports. Google is the trap here: it also accepts `?key=`.
        for (const provider of Object.keys(GATEWAY_PROVIDERS)) {
            const captured = await callOnce(
                {
                    provider,
                    model: `${provider}/some-model`,
                    transportConfig: { resourceName: 'r', deploymentName: 'd', apiVersion: 'v' },
                },
                { messages: [{ role: 'user', content: 'hi' }] },
                { choices: [{ message: { content: 'ok' } }], candidates: [] },
            );
            expect(captured.url).not.toContain('sk-tenant-key');
        }
    });

    it('sends the documented BYOK alias header when the credential is an alias', async () => {
        // Cloudflare documents `cf-aig-byok-alias`. The transport shipped with
        // `cf-aig-provider-key`, which the gateway ignores — so the request went out with NO
        // provider authentication at all and fell through to whatever the gateway had.
        const captured = await callOnce({ secret: null, alias: 'production' });
        expect(captured.headers['cf-aig-byok-alias']).toBe('production');
        expect(captured.headers['cf-aig-provider-key']).toBeUndefined();
    });

    it('carries the operator gateway token separately from the tenant key', async () => {
        const captured = await callOnce({ gatewayToken: 'cf-token' });
        expect(captured.headers['cf-aig-authorization']).toBe('Bearer cf-token');
        expect(captured.headers.authorization).toBe('Bearer sk-tenant-key');
    });

    it('does NOT let caller metadata overwrite trusted provenance', async () => {
        // AI Gateway dynamic routing can BRANCH ON METADATA. A call site that forwarded a
        // request body could otherwise relabel a platform call as `source: 'byok'` and take a
        // route — and a budget — it was never entitled to, while also poisoning cost analytics.
        const captured = await callOnce(
            {},
            {
                messages: [{ role: 'user', content: 'hi' }],
                metadata: { source: 'byok', task: 'premium', app: 'other-app', trace: 'abc-123' },
            },
        );
        const metadata = JSON.parse(captured.headers['cf-aig-metadata']!) as Record<string, string>;
        expect(metadata).toMatchObject({ source: 'byok', task: 'assist', app: 'app-1' });
        // Genuine caller tags still travel.
        expect(metadata.trace).toBe('abc-123');
    });

    it('reports a platform call as platform even when the caller claims otherwise', async () => {
        const captured = await callOnce(
            { provenance: { ...configFor().provenance, source: 'platform', taskKey: 'assist', credentialId: null } },
            { messages: [{ role: 'user', content: 'hi' }], metadata: { source: 'byok' } },
        );
        const metadata = JSON.parse(captured.headers['cf-aig-metadata']!) as Record<string, string>;
        expect(metadata.source).toBe('platform');
    });
});

// ---------------------------------------------------------------------------
// Deployment-dependent providers
// ---------------------------------------------------------------------------

describe('a provider this operator cannot route to is not offered to tenants', () => {
    const transport = createGatewayTransport();

    it('reports Azure unservable when the operator supplied no resource/deployment/apiVersion', () => {
        // Otherwise the form offers Azure, the tenant pastes a real key, the row saves and
        // lists — and every call is MERGE_INCOMPLETE, with nothing to point at.
        expect(transport.unservableProviders!({})).toContain('azure');
    });

    it('reports Azure servable once the operator configured it', () => {
        expect(
            transport.unservableProviders!({
                transportConfig: { resourceName: 'r', deploymentName: 'd', apiVersion: '2024-10-21' },
            }),
        ).not.toContain('azure');
    });

    it('does not false-positive on providers whose path depends on the MODEL, not on config', () => {
        // Google's path carries the model, so probing it with no model would wrongly report it
        // unservable on every deployment.
        expect(transport.unservableProviders!({})).not.toContain('google-ai-studio');
        expect(transport.unservableProviders!({})).not.toContain('openai');
    });

    it('narrows tenant selection at composition without unregistering the provider', () => {
        const registry = withTenantSelectionRemoved(createProviderRegistry(), ['azure']);
        expect(registry.isTenantSelectable('azure')).toBe(false);
        expect(registry.tenantSelectable().map((entry) => entry.id)).not.toContain('azure');
        // Still registered: the platform path, the keyless-mismatch guard and the
        // PROVIDER_UNREGISTERED verdict must all behave exactly as before.
        expect(registry.has('azure')).toBe(true);
        expect(registry.requiresKeyFor('azure')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Dynamic routes
// ---------------------------------------------------------------------------

describe('a dynamic route is a MODEL VALUE, not a URL segment', () => {
    it('calls the compat endpoint with `model: "dynamic/<route>"`', async () => {
        const captured = await callOnce({ model: 'dynamic/support', provider: 'openai' });
        expect(captured.url).toBe(`${BASE}/compat/chat/completions`);
        expect(captured.body.model).toBe('dynamic/support');
    });

    it('does not build `.../dynamic/<route>` as a path', async () => {
        const captured = await callOnce({ model: 'dynamic/support', provider: 'openai' });
        expect(captured.url).not.toContain('/dynamic/');
    });

    it('strips traversal segments from a route name', async () => {
        const captured = await callOnce({ model: 'dynamic/../../evil', provider: 'openai' });
        expect(captured.url).toBe(`${BASE}/compat/chat/completions`);
        expect(captured.body.model).toBe('dynamic/evil');
    });
});

// ---------------------------------------------------------------------------
// Bodies
// ---------------------------------------------------------------------------

describe('request bodies match the dialect, and `extra` cannot fight the URL', () => {
    it('shapes an Anthropic body: system hoisted, max_tokens always present', async () => {
        const captured = await callOnce(
            { provider: 'anthropic', model: 'anthropic/claude-sonnet-4-5' },
            {
                messages: [
                    { role: 'system', content: 'be terse' },
                    { role: 'user', content: 'hi' },
                ],
            },
        );
        expect(captured.body).toMatchObject({
            model: 'claude-sonnet-4-5',
            system: 'be terse',
            messages: [{ role: 'user', content: 'hi' }],
            max_tokens: 1024,
        });
    });

    it('shapes a Gemini body: contents + system_instruction, same-role turns merged', async () => {
        const captured = await callOnce(
            { provider: 'google-ai-studio', model: 'google-ai-studio/gemini-2.5-flash' },
            {
                messages: [
                    { role: 'system', content: 'be terse' },
                    { role: 'user', content: 'one' },
                    // Gemini rejects consecutive same-role turns; this pair must merge.
                    { role: 'user', content: 'two' },
                ],
                maxTokens: 64,
            },
            { candidates: [] },
        );
        expect(captured.body).toMatchObject({
            system_instruction: { parts: [{ text: 'be terse' }] },
            contents: [{ role: 'user', parts: [{ text: 'one' }, { text: 'two' }] }],
            generationConfig: { maxOutputTokens: 64 },
        });
    });

    it('opts into streamed usage UNCONDITIONALLY for OpenAI-shaped providers', async () => {
        const captured: Captured[] = [];
        const client = makeClient({ fetch: capturingFetch(captured) });
        // Drain the generator so the request is actually issued.
        for await (const _ of client.stream({ messages: [{ role: 'user', content: 'hi' }] })) void _;
        expect(captured[0]!.body).toMatchObject({ stream: true, stream_options: { include_usage: true } });
    });

    it('does NOT let `extra` overwrite model, messages or stream', async () => {
        // The URL was already chosen from these values. Letting `extra` change them means the
        // request is routed for one call and bodied for another.
        const captured = await callOnce(
            {},
            {
                messages: [{ role: 'user', content: 'real' }],
                extra: {
                    model: 'evil-model',
                    messages: [{ role: 'user', content: 'forged' }],
                    stream: true,
                    top_p: 0.1,
                },
            },
        );
        expect(captured.body.model).toBe('gpt-4o-mini');
        expect(captured.body.messages).toEqual([{ role: 'user', content: 'real' }]);
        expect(captured.body.stream).toBeUndefined();
        // Genuine provider knobs still pass through.
        expect(captured.body.top_p).toBe(0.1);
    });
});

// ---------------------------------------------------------------------------
// Refusals
// ---------------------------------------------------------------------------

describe('the transport refuses what it cannot do correctly', () => {
    it('refuses a provider with no verified wire contract instead of guessing', async () => {
        // Cohere is the case that matters: an OpenAI-shaped request to Cohere returns HTTP
        // 200 with an EMPTY completion, which no error path anywhere would ever surface.
        const client = makeClient({ provider: 'cohere', model: 'cohere/command-r', fetch: capturingFetch([]) });
        const result = await client.complete({ messages: [{ role: 'user', content: 'hi' }] });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toMatch(/no verified wire contract/);
    });

    it('reports an unsupported provider as INCOMPLETE at resolve time, not at call time', () => {
        const transport = createGatewayTransport();
        expect(transport.isComplete(configFor({ provider: 'cohere', model: 'cohere/command-r' }))).toBe(false);
        expect(transport.isComplete(configFor())).toBe(true);
        // A dynamic route owns provider selection inside the gateway, so the credential's own
        // provider is irrelevant to whether the call can be made.
        expect(transport.isComplete(configFor({ provider: 'workers-ai', model: 'dynamic/support' }))).toBe(true);
    });

    it('refuses a per-call model that names a DIFFERENT provider than the credential', async () => {
        // Routed to provider B, authenticated for provider A. Either a confusing 401, or —
        // on a provider pair sharing an auth scheme — a live credential submission to a
        // provider the tenant never chose.
        const client = makeClient({ provider: 'openai', fetch: capturingFetch([]) });
        const result = await client.complete({
            messages: [{ role: 'user', content: 'hi' }],
            model: 'anthropic/claude-sonnet-4-5',
        });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.message).toMatch(/may not change the provider/);
    });

    it('does not reach the network when the caller signal is ALREADY aborted', async () => {
        const captured: Captured[] = [];
        const client = makeClient({ fetch: capturingFetch(captured) });
        const controller = new AbortController();
        controller.abort();

        const result = await client.complete({
            messages: [{ role: 'user', content: 'hi' }],
            signal: controller.signal,
        });
        expect(result.ok).toBe(false);
        // `addEventListener('abort')` never fires on an already-aborted signal, so without an
        // explicit check the request goes out anyway — billed, logged, key held open.
        expect(captured).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// SSE framing
// ---------------------------------------------------------------------------

describe('SSE framing follows the spec, not one provider habits', () => {
    function streamingFetch(chunks: string[]): typeof fetch {
        return (async () => {
            const encoder = new TextEncoder();
            return new Response(
                new ReadableStream<Uint8Array>({
                    start(controller) {
                        for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
                        controller.close();
                    },
                }),
                { status: 200 },
            );
        }) as unknown as typeof fetch;
    }

    async function collect(chunks: string[], overrides: Partial<MergedTransportConfig> = {}) {
        const client = makeClient({ ...overrides, fetch: streamingFetch(chunks) });
        const events = [];
        for await (const event of client.stream({ messages: [{ role: 'user', content: 'hi' }] })) events.push(event);
        return events;
    }

    it('parses CRLF-framed events incrementally, not in one lump at the end', async () => {
        const events = await collect([
            'data: {"choices":[{"delta":{"content":"a"}}]}\r\n\r\n',
            'data: {"choices":[{"delta":{"content":"b"}}]}\r\n\r\n',
            'data: [DONE]\r\n\r\n',
        ]);
        expect(events.filter((e) => e.type === 'delta').map((e) => (e as { text: string }).text)).toEqual(['a', 'b']);
    });

    it('survives a CRLF split ACROSS chunk boundaries without forging a frame break', async () => {
        // The subtle one: translating a trailing CR to LF eagerly, then meeting the LF that
        // follows, manufactures a `\n\n` in the middle of a frame and truncates its JSON.
        const events = await collect([
            'data: {"choices":[{"delta":{"content":"split"}}]}\r',
            '\n\r\ndata: [DONE]\r\n\r\n',
        ]);
        expect(events.filter((e) => e.type === 'delta').map((e) => (e as { text: string }).text)).toEqual(['split']);
    });

    it('concatenates multi-line `data:` payloads into ONE event', async () => {
        const events = await collect(['data: {"choices":[{"delta":\ndata: {"content":"multi"}}]}\n\n']);
        expect(events.filter((e) => e.type === 'delta').map((e) => (e as { text: string }).text)).toEqual(['multi']);
    });

    it('still flushes a final frame that arrives with no trailing blank line', async () => {
        // For OpenAI-shaped providers that final frame is the one carrying USAGE, so losing
        // it means every streamed call meters zero tokens.
        const events = await collect(['data: {"usage":{"prompt_tokens":7,"completion_tokens":3}}']);
        expect(events.find((e) => e.type === 'usage')).toMatchObject({ tokens: { input: 7, output: 3 } });
    });

    it('reports Anthropic input tokens from message_start, not zero', async () => {
        const events = await collect(
            [
                'data: {"type":"message_start","message":{"model":"claude-sonnet-4-5","usage":{"input_tokens":11}}}\n\n',
                'data: {"type":"content_block_delta","delta":{"text":"hi"}}\n\n',
                'data: {"type":"message_delta","usage":{"output_tokens":4}}\n\n',
            ],
            { provider: 'anthropic', model: 'anthropic/claude-sonnet-4-5' },
        );
        expect(events.find((e) => e.type === 'usage')).toMatchObject({ tokens: { input: 11, output: 4 } });
    });

    it('surfaces an in-stream error object — the 200-with-a-failure case', async () => {
        const events = await collect(['data: {"error":{"message":"nope","code":"bad_key","status":401}}\n\n']);
        expect(events.find((e) => e.type === 'error')).toMatchObject({
            error: { statusCode: 401, providerCode: 'bad_key' },
        });
    });
});

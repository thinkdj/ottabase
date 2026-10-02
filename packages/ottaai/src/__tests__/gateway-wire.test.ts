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

import { describe, expect, it, vi } from 'vitest';
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
        gatewayToken: 'cf-token',
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

describe('Worker global fetch binding', () => {
    it("preserves fetch's receiver when no custom fetch is injected", async () => {
        const captured: Captured[] = [];
        const workerFetch = function (this: typeof globalThis, input: RequestInfo | URL, init?: RequestInit) {
            if (this !== globalThis) throw new TypeError('Illegal invocation');
            return capturingFetch(captured)(String(input), init ?? {});
        } as typeof fetch;

        vi.stubGlobal('fetch', workerFetch);
        try {
            const result = await makeClient({}).complete({ messages: [{ role: 'user', content: 'hi' }] });

            expect(result.ok).toBe(true);
            expect(captured).toHaveLength(1);
        } finally {
            vi.unstubAllGlobals();
        }
    });
});

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
    it('requires authenticated Gateway access and an explicit billing source', () => {
        const transport = createGatewayTransport();
        expect(transport.isComplete(configFor({ gatewayToken: undefined }))).toBe(false);
        expect(transport.isComplete(configFor())).toBe(true);
        expect(transport.isComplete(configFor({ gatewayToken: 'cf-token', secret: null, billing: undefined }))).toBe(
            false,
        );
        expect(
            transport.isComplete(
                configFor({ gatewayToken: undefined, apiToken: 'cf-api-token', secret: null, billing: 'unified' }),
            ),
        ).toBe(true);
        expect(
            transport.isComplete(
                configFor({
                    provider: 'workers-ai',
                    model: 'llama-3.1-8b-instruct',
                    gatewayToken: undefined,
                    apiToken: 'cf-api-token',
                    secret: null,
                    billing: 'unified',
                }),
            ),
        ).toBe(false);
        expect(transport.isComplete(configFor({ provider: 'anthropic', model: 'openai/gpt-4o-mini' }))).toBe(false);
    });

    it('uses Cloudflare REST API authentication for Unified Billing', async () => {
        const captured = await callOnce({
            secret: null,
            gatewayToken: undefined,
            apiToken: 'cf-api-token',
            billing: 'unified',
        });
        expect(captured.url).toBe(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/v1/chat/completions`);
        expect(captured.headers.authorization).toBe('Bearer cf-api-token');
        expect(captured.headers['cf-aig-gateway-id']).toBe(GATEWAY);
        expect(captured.headers['cf-aig-authorization']).toBeUndefined();
        expect(captured.body.model).toBe('openai/gpt-4o-mini');
    });

    it('maps registry ids to Cloudflare REST model ids for Unified Billing', async () => {
        const captured = await callOnce({
            provider: 'workers-ai',
            model: 'workers-ai/@cf/meta/llama-3.1-8b-instruct',
            secret: null,
            gatewayToken: undefined,
            apiToken: 'cf-api-token',
            billing: 'unified',
        });

        expect(captured.url).toBe(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/v1/chat/completions`);
        expect(captured.body.model).toBe('@cf/meta/llama-3.1-8b-instruct');

        const google = await callOnce({
            provider: 'google-ai-studio',
            model: 'google-ai-studio/gemini-2.5-flash',
            secret: null,
            gatewayToken: undefined,
            apiToken: 'cf-api-token',
            billing: 'unified',
        });
        expect(google.body.model).toBe('google/gemini-2.5-flash');
    });

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
        expect(captured.headers['cf-aig-no-wholesale']).toBe('true');
    });

    it('prevents every tenant BYOK request from falling through to Unified Billing', async () => {
        const inline = await callOnce({});
        expect(inline.headers['cf-aig-no-wholesale']).toBe('true');

        const platform = await callOnce({
            provenance: { ...configFor().provenance, source: 'platform', credentialId: null },
        });
        expect(platform.headers['cf-aig-no-wholesale']).toBeUndefined();
    });

    it('carries the operator gateway token separately from the tenant key', async () => {
        const captured = await callOnce({ gatewayToken: 'cf-token' });
        expect(captured.headers['cf-aig-authorization']).toBe('Bearer cf-token');
        expect(captured.headers.authorization).toBe('Bearer sk-tenant-key');
    });

    it('emits only the fixed server-owned provenance envelope', async () => {
        const captured = await callOnce(
            {},
            {
                messages: [{ role: 'user', content: 'hi' }],
            },
        );
        const metadata = JSON.parse(captured.headers['cf-aig-metadata']!) as Record<string, string>;
        expect(metadata).toEqual({ source: 'byok', task: 'assist', app: 'app-1', user: 'user-1' });
        expect(captured.headers['cf-aig-collect-log-payload']).toBe('false');
    });

    it('reports platform provenance from the resolved config', async () => {
        const captured = await callOnce(
            { provenance: { ...configFor().provenance, source: 'platform', taskKey: 'assist', credentialId: null } },
            { messages: [{ role: 'user', content: 'hi' }] },
        );
        const metadata = JSON.parse(captured.headers['cf-aig-metadata']!) as Record<string, string>;
        expect(metadata.source).toBe('platform');
    });

    it('does not let operator transport headers weaken request invariants', async () => {
        const captured = await callOnce({
            transportConfig: {
                headers: {
                    Authorization: 'Bearer injected',
                    'cf-aig-metadata': '{"source":"forged"}',
                    'cf-aig-collect-log-payload': 'true',
                    'Content-Type': 'text/plain',
                },
            },
        });
        expect(captured.headers.authorization).toBe('Bearer sk-tenant-key');
        expect(captured.headers['content-type']).toBe('application/json');
        expect(captured.headers['cf-aig-collect-log-payload']).toBe('false');
        expect(JSON.parse(captured.headers['cf-aig-metadata']!)).toMatchObject({ source: 'byok', task: 'assist' });
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

    it('shapes a Gemini body: contents + systemInstruction (camelCase), same-role turns merged', async () => {
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
            systemInstruction: { parts: [{ text: 'be terse' }] },
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
// Embeddings
// ---------------------------------------------------------------------------

describe('OpenAI embeddings', () => {
    it('uses the documented provider-native endpoint and preserves batch order', async () => {
        const captured: Captured[] = [];
        const client = makeClient({
            fetch: capturingFetch(captured, {
                data: [{ embedding: [0.1] }, { embedding: [0.2] }],
                usage: { prompt_tokens: 7 },
                model: 'text-embedding-3-small',
            }),
        });

        const result = await client.embed!({
            model: 'openai/text-embedding-3-small',
            input: ['first', 'second'],
            dimensions: 256,
        });

        expect(captured[0]!.url).toBe(`${BASE}/openai/embeddings`);
        expect(captured[0]!.body).toEqual({
            model: 'text-embedding-3-small',
            input: ['first', 'second'],
            dimensions: 256,
        });
        expect(result).toMatchObject({
            ok: true,
            result: { vectors: [[0.1], [0.2]], tokens: { input: 7 }, model: 'text-embedding-3-small' },
        });
    });

    it('refuses chat models and unsupported providers before issuing a billable request', async () => {
        const chatCaptured: Captured[] = [];
        const chatClient = makeClient({ fetch: capturingFetch(chatCaptured) });
        const chat = await chatClient.embed!({ input: 'nope' });
        expect(chat.ok).toBe(false);
        expect(chatCaptured).toHaveLength(0);

        const providerCaptured: Captured[] = [];
        const providerClient = makeClient({
            provider: 'anthropic',
            model: 'anthropic/claude-sonnet-4-5',
            fetch: capturingFetch(providerCaptured),
        });
        const provider = await providerClient.embed!({ input: 'nope', model: 'text-embedding-3-small' });
        expect(provider.ok).toBe(false);
        expect(providerCaptured).toHaveLength(0);
    });

    it('uses the universal REST endpoint for Unified Billing embeddings', async () => {
        const captured: Captured[] = [];
        const client = makeClient({
            secret: null,
            gatewayToken: undefined,
            apiToken: 'cf-api-token',
            billing: 'unified',
            fetch: capturingFetch(captured, {
                success: true,
                result: { data: [[0.1, 0.2]], usage: { input_tokens: 3 } },
            }),
        });

        const result = await client.embed!({
            model: 'openai/text-embedding-3-small',
            input: 'embed me',
            dimensions: 256,
        });

        expect(captured).toHaveLength(1);
        expect(captured[0]!.url).toBe(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/run`);
        expect(captured[0]!.headers.authorization).toBe('Bearer cf-api-token');
        expect(captured[0]!.headers['cf-aig-gateway-id']).toBe(GATEWAY);
        expect(captured[0]!.body).toEqual({
            model: 'openai/text-embedding-3-small',
            input: { input: 'embed me', dimensions: 256 },
        });
        expect(result).toMatchObject({
            ok: true,
            result: { vectors: [[0.1, 0.2]], tokens: { input: 3 }, model: 'openai/text-embedding-3-small' },
        });
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

    it('detaches its listener from the caller signal once a call or stream settles', async () => {
        const controller = new AbortController();
        const added: unknown[] = [];
        const removed: unknown[] = [];
        const signal = controller.signal;
        const add = signal.addEventListener.bind(signal);
        const remove = signal.removeEventListener.bind(signal);
        signal.addEventListener = ((type: string, listener: EventListener, opts?: AddEventListenerOptions) => {
            added.push(listener);
            add(type, listener, opts);
        }) as typeof signal.addEventListener;
        signal.removeEventListener = ((type: string, listener: EventListener) => {
            removed.push(listener);
            remove(type, listener);
        }) as typeof signal.removeEventListener;

        await makeClient({ fetch: capturingFetch([]) }).complete({
            messages: [{ role: 'user', content: 'hi' }],
            signal,
        });

        const sseFetch = (async () =>
            new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n', {
                status: 200,
            })) as unknown as typeof fetch;
        for await (const _event of makeClient({ fetch: sseFetch }).stream({
            messages: [{ role: 'user', content: 'hi' }],
            signal,
        })) {
            // drain
        }

        expect(added).toHaveLength(2);
        expect(removed).toEqual(added);
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

// ---------------------------------------------------------------------------
// Images + JSON output — each provider's own spelling
// ---------------------------------------------------------------------------
// Transcribed from each provider's API reference (cited beside its `supports` entry in
// `transports/providers.ts`). These are the strings a provider reads; a wrong one is not
// an error on most providers — it is an image the model never saw, or prose where JSON
// was expected.

/** 1x1 transparent PNG. */
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const DATA_URL = `data:image/png;base64,${PNG}`;
const SCHEMA = {
    type: 'object',
    properties: { total: { type: 'number' } },
    required: ['total'],
    additionalProperties: false,
};
const AZURE = { resourceName: 'res', deploymentName: 'dep', apiVersion: '2024-10-21' };

const withImage = (count = 1) => ({
    messages: [
        {
            role: 'user' as const,
            content: [
                { type: 'text' as const, text: 'read this' },
                ...Array.from({ length: count }, () => ({
                    type: 'image' as const,
                    mimeType: 'image/png' as const,
                    data: PNG,
                })),
            ],
        },
    ],
});

const json = (format: Record<string, unknown> = {}) => ({
    messages: [{ role: 'user' as const, content: 'total?' }],
    responseFormat: { type: 'json' as const, ...format },
});

/** The system text the transport sent, whichever dialect carried it. */
function systemText(body: Record<string, unknown>): string {
    if (typeof body.system === 'string') return body.system;
    const google = body.systemInstruction as { parts: Array<{ text: string }> } | undefined;
    if (google) return google.parts.map((p) => p.text).join('\n');
    const messages = body.messages as Array<{ role: string; content: string }>;
    return messages
        .filter((m) => m.role === 'system')
        .map((m) => m.content)
        .join('\n');
}

const OPENAI_SHAPED: Array<[string, Partial<MergedTransportConfig>]> = [
    ['openai', { provider: 'openai', model: 'openai/gpt-4o-mini' }],
    ['groq', { provider: 'groq', model: 'groq/meta-llama/llama-4-scout-17b-16e-instruct' }],
    ['mistral', { provider: 'mistral', model: 'mistral/pixtral-12b-latest' }],
    ['deepseek', { provider: 'deepseek', model: 'deepseek/deepseek-chat' }],
    ['perplexity', { provider: 'perplexity', model: 'perplexity/sonar' }],
    ['azure', { provider: 'azure', model: 'azure/gpt-4o', transportConfig: AZURE }],
];

describe('image parts are spelled in each dialect', () => {
    it.each(OPENAI_SHAPED)('%s: an `image_url` part carrying a base64 data URL', async (_name, config) => {
        const captured = await callOnce(config, withImage());
        expect(captured.body.messages).toEqual([
            {
                role: 'user',
                content: [
                    { type: 'text', text: 'read this' },
                    { type: 'image_url', image_url: { url: DATA_URL } },
                ],
            },
        ]);
    });

    it('anthropic: a base64 `image` block with `media_type`', async () => {
        const captured = await callOnce({ provider: 'anthropic', model: 'anthropic/claude-haiku-4-5' }, withImage());
        expect(captured.body.messages).toEqual([
            {
                role: 'user',
                content: [
                    { type: 'text', text: 'read this' },
                    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: PNG } },
                ],
            },
        ]);
    });

    it('google-ai-studio: a camelCase `inlineData` part, merged into the same user turn', async () => {
        const captured = await callOnce(
            { provider: 'google-ai-studio', model: 'google-ai-studio/gemini-2.5-flash-lite' },
            withImage(),
        );
        expect(captured.body.contents).toEqual([
            { role: 'user', parts: [{ text: 'read this' }, { inlineData: { mimeType: 'image/png', data: PNG } }] },
        ]);
    });

    it('keeps a plain string message a string — no needless part array', async () => {
        const captured = await callOnce({});
        expect(captured.body.messages).toEqual([{ role: 'user', content: 'hi' }]);
    });
});

describe('images are refused where a route does not take them, before any request', () => {
    async function refused(config: Partial<MergedTransportConfig>, count = 1) {
        const captured: Captured[] = [];
        const client = makeClient({ ...config, fetch: capturingFetch(captured) });
        const result = await client.complete(withImage(count));
        expect(captured).toHaveLength(0);
        expect(result.ok).toBe(false);
        return result.ok ? null : result.error;
    }

    it('over the provider image count (Groq: 3)', async () => {
        const error = await refused({ provider: 'groq', model: 'groq/meta-llama/llama-4-scout-17b-16e-instruct' }, 4);
        expect(error).toMatchObject({ code: 'UNSUPPORTED_OPERATION', retryable: false });
        expect(error!.message).toMatch(/at most 3 images/);
    });

    it('on a dynamic route — Cloudflare documents no image input on the compat endpoint', async () => {
        const error = await refused({ model: 'dynamic/support' });
        expect(error).toMatchObject({ code: 'UNSUPPORTED_OPERATION' });
    });

    it('on Unified Billing — the REST endpoint documents no image input', async () => {
        const error = await refused({ secret: null, gatewayToken: undefined, apiToken: 't', billing: 'unified' });
        expect(error).toMatchObject({ code: 'UNSUPPORTED_OPERATION' });
    });

    it('accepts exactly the provider maximum', async () => {
        const captured = await callOnce(
            { provider: 'groq', model: 'groq/meta-llama/llama-4-scout-17b-16e-instruct' },
            withImage(3),
        );
        expect((captured.body.messages as Array<{ content: unknown[] }>)[0]!.content).toHaveLength(4);
    });
});

describe('JSON output: default tier is JSON MODE, strict tier is PROVIDER-ENFORCED where supported', () => {
    it('always asks for JSON in the system instruction — OpenAI-shaped JSON mode requires it', async () => {
        const captured = await callOnce({}, json());
        const messages = captured.body.messages as Array<{ role: string; content: string }>;
        expect(messages[0]!.role).toBe('system');
        expect(messages[0]!.content).toMatch(/JSON object/);
        expect(captured.body.response_format).toEqual({ type: 'json_object' });
    });

    it('puts the caller system message AFTER the JSON instruction, not instead of it', async () => {
        const captured = await callOnce(
            {},
            {
                ...json(),
                messages: [
                    { role: 'system', content: 'be terse' },
                    { role: 'user', content: 'total?' },
                ],
            },
        );
        const roles = (captured.body.messages as Array<{ role: string; content: string }>).map(
            (m) => `${m.role}:${m.content.slice(0, 8)}`,
        );
        expect(roles).toEqual(['system:Respond ', 'system:be terse', 'user:total?']);
    });

    it('default tier: the schema is INSTRUCTED, never sent as an enforced schema', async () => {
        const captured = await callOnce({}, json({ schema: SCHEMA }));
        expect(captured.body.response_format).toEqual({ type: 'json_object' });
        expect(systemText(captured.body)).toContain(JSON.stringify(SCHEMA));
    });

    it('openai strict: `json_schema` with a name and strict:true, and no duplicate schema in the prompt', async () => {
        const captured = await callOnce({}, json({ schema: SCHEMA, strict: true, name: 'receipt' }));
        expect(captured.body.response_format).toEqual({
            type: 'json_schema',
            json_schema: { name: 'receipt', schema: SCHEMA, strict: true },
        });
        expect(systemText(captured.body)).not.toContain('"properties"');
    });

    it('defaults the schema name to `response`', async () => {
        const captured = await callOnce({}, json({ schema: SCHEMA, strict: true }));
        expect(captured.body.response_format).toMatchObject({ json_schema: { name: 'response' } });
    });

    it.each([
        ['mistral', { provider: 'mistral', model: 'mistral/mistral-large-latest' }, 'json_schema'],
        ['deepseek', { provider: 'deepseek', model: 'deepseek/deepseek-chat' }, 'json_object'],
        ['groq', { provider: 'groq', model: 'groq/llama-3.3-70b-versatile' }, 'json_object'],
        ['azure', { provider: 'azure', model: 'azure/gpt-4o', transportConfig: AZURE }, 'json_object'],
        ['perplexity', { provider: 'perplexity', model: 'perplexity/sonar' }, 'json_schema'],
    ] as Array<[string, Partial<MergedTransportConfig>, string]>)('%s strict → `%s`', async (_name, config, type) => {
        const captured = await callOnce(config, json({ schema: SCHEMA, strict: true }));
        expect((captured.body.response_format as { type: string }).type).toBe(type);
        // Where the provider does not enforce the schema, the prompt carries it.
        expect(systemText(captured.body).includes(JSON.stringify(SCHEMA))).toBe(type === 'json_object');
    });

    it('perplexity default: NO response_format — it has no `json_object` type', async () => {
        const captured = await callOnce({ provider: 'perplexity', model: 'perplexity/sonar' }, json());
        expect(captured.body.response_format).toBeUndefined();
        expect(systemText(captured.body)).toMatch(/JSON object/);
    });

    it('anthropic default: instructed only — Anthropic has no schema-less JSON mode', async () => {
        const captured = await callOnce({ provider: 'anthropic', model: 'anthropic/claude-haiku-4-5' }, json());
        expect(captured.body.output_config).toBeUndefined();
        expect(captured.body.tool_choice).toBeUndefined();
        expect(captured.body.system).toMatch(/JSON object/);
    });

    it('anthropic strict: `output_config.format`, NOT forced tool use (400s on the newest models)', async () => {
        const captured = await callOnce(
            { provider: 'anthropic', model: 'anthropic/claude-haiku-4-5' },
            json({ schema: SCHEMA, strict: true }),
        );
        expect(captured.body.output_config).toEqual({ format: { type: 'json_schema', schema: SCHEMA } });
        expect(captured.body.tools).toBeUndefined();
        expect(captured.body.tool_choice).toBeUndefined();
    });

    it('google default: `responseMimeType`; strict: `responseFormat` ALONE (the only non-deprecated schema field)', async () => {
        const google = { provider: 'google-ai-studio', model: 'google-ai-studio/gemini-2.5-flash' };
        const loose = await callOnce(google, json({ schema: SCHEMA }));
        expect(loose.body.generationConfig).toEqual({ responseMimeType: 'application/json' });
        expect(systemText(loose.body)).toContain(JSON.stringify(SCHEMA));

        // Never both styles: `responseMimeType` beside `responseFormat` is the mixed form
        // Google's docs warn against, and `responseJsonSchema` is deprecated on v1.
        const strict = await callOnce(google, json({ schema: SCHEMA, strict: true }));
        expect(strict.body.generationConfig).toEqual({
            responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: SCHEMA } },
        });
    });

    it.each([
        ['a dynamic route', { model: 'dynamic/support' }],
        ['Unified Billing', { secret: null, gatewayToken: undefined, apiToken: 't', billing: 'unified' }],
    ] as Array<[string, Partial<MergedTransportConfig>]>)(
        '%s: instructed only — no documented `response_format`',
        async (_name, config) => {
            const captured = await callOnce(config, json({ schema: SCHEMA, strict: true }));
            expect(captured.body.response_format).toBeUndefined();
            expect(systemText(captured.body)).toContain(JSON.stringify(SCHEMA));
        },
    );

    it('`extra` cannot override the output format the caller asked for', async () => {
        const openai = await callOnce(
            {},
            { ...json(), extra: { response_format: { type: 'text' }, tools: [{}], tool_choice: 'required' } },
        );
        expect(openai.body.response_format).toEqual({ type: 'json_object' });
        expect(openai.body.tools).toBeUndefined();
        expect(openai.body.tool_choice).toBeUndefined();

        const anthropic = await callOnce(
            { provider: 'anthropic', model: 'anthropic/claude-haiku-4-5' },
            { ...json(), extra: { output_config: { format: { type: 'text' } }, system: 'override' } },
        );
        expect(anthropic.body.output_config).toBeUndefined();
        expect(anthropic.body.system).toMatch(/JSON object/);

        const google = await callOnce(
            { provider: 'google-ai-studio', model: 'google-ai-studio/gemini-2.5-flash' },
            { ...json(), extra: { generationConfig: { responseMimeType: 'text/plain', topP: 0.5 } } },
        );
        expect(google.body.generationConfig).toEqual({ responseMimeType: 'application/json', topP: 0.5 });
    });
});

describe('output budget field', () => {
    it('openai: `max_completion_tokens` — `max_tokens` 400s on reasoning models', async () => {
        const captured = await callOnce({}, { messages: [{ role: 'user', content: 'hi' }], maxTokens: 512 });
        expect(captured.body.max_completion_tokens).toBe(512);
        expect(captured.body.max_tokens).toBeUndefined();
    });

    it('OpenAI-compatible providers, dynamic routes and Unified Billing keep `max_tokens`', async () => {
        const options = { messages: [{ role: 'user' as const, content: 'hi' }], maxTokens: 512 };
        for (const config of [
            { provider: 'groq', model: 'groq/llama-3.3-70b-versatile' },
            { model: 'dynamic/support' },
            { secret: null, gatewayToken: undefined, apiToken: 't', billing: 'unified' as const },
        ] as Array<Partial<MergedTransportConfig>>) {
            const captured = await callOnce(config, options);
            expect(captured.body.max_tokens).toBe(512);
            expect(captured.body.max_completion_tokens).toBeUndefined();
        }
    });

    it('`extra` cannot set either budget field behind `maxTokens`', async () => {
        const captured = await callOnce(
            {},
            { messages: [{ role: 'user', content: 'hi' }], maxTokens: 64, extra: { max_tokens: 9999 } },
        );
        expect(captured.body).toMatchObject({ max_completion_tokens: 64 });
        expect(captured.body.max_tokens).toBeUndefined();
    });
});

describe('anthropic `extra.system` is merged, never dropped', () => {
    const anthropic = { provider: 'anthropic', model: 'anthropic/claude-haiku-4-5' };

    it('keeps cache-controlled system BLOCKS, after the JSON instruction', async () => {
        const cached = { type: 'text', text: 'long reusable context', cache_control: { type: 'ephemeral' } };
        const captured = await callOnce(anthropic, { ...json(), extra: { system: [cached] } });
        const system = captured.body.system as Array<{ type: string; text: string }>;
        expect(system[0]!.text).toMatch(/JSON object/);
        expect(system[1]).toEqual(cached);
    });

    it('appends a string `extra.system` to the system messages', async () => {
        const captured = await callOnce(anthropic, {
            messages: [
                { role: 'system', content: 'be terse' },
                { role: 'user', content: 'hi' },
            ],
            extra: { system: 'house style' },
        });
        expect(captured.body.system).toBe('be terse\nhouse style');
    });
});

describe('route support: reported per route, overridable by the operator', () => {
    it('reports `vision` unsupported where the route documents no image input', () => {
        const transport = createGatewayTransport();
        expect(transport.unsupportedCapabilitiesFor!(configFor())).toEqual([]);
        expect(transport.unsupportedCapabilitiesFor!(configFor({ model: 'dynamic/support' }))).toEqual(['vision']);
        expect(
            transport.unsupportedCapabilitiesFor!(
                configFor({ secret: null, gatewayToken: undefined, apiToken: 't', billing: 'unified' }),
            ),
        ).toEqual(['vision']);
    });

    it('lets an operator assert a fact about THEIR deployment', async () => {
        const transport = createGatewayTransport({
            routeSupport: { azure: { jsonSchema: true }, dynamic: { images: { max: 4 } } },
        });
        const captured: Captured[] = [];
        const azure = transport.createClient(
            configFor({
                provider: 'azure',
                model: 'azure/gpt-4o',
                transportConfig: AZURE,
                fetch: capturingFetch(captured),
            }),
        );
        await azure.complete(json({ schema: SCHEMA, strict: true }));
        expect((captured[0]!.body.response_format as { type: string }).type).toBe('json_schema');

        expect(transport.unsupportedCapabilitiesFor!(configFor({ model: 'dynamic/support' }))).toEqual([]);
        const dynamic = transport.createClient(
            configFor({ model: 'dynamic/support', fetch: capturingFetch(captured) }),
        );
        const result = await dynamic.complete(withImage(2));
        expect(result.ok).toBe(true);
    });
});

// ============================================================
// /api/ai/complete — APP-LEVEL INTEGRATION, real OttaAI composition.
// ============================================================
// The package has 236 unit tests and none of them prove that THIS APP wires the
// package correctly. Everything below runs the real thing: the real
// `ottabase.config.ts` dials, the real `createAiProvisioningWithStorage`
// composition, the real resolver, the real ORM credential store, and the real
// Cloudflare AI Gateway transport. Only three things are stubbed, and each is a
// genuine external boundary:
//
//   • the session / security context  (there is no auth server in a unit test)
//   • the Drizzle driver              (there is no D1 in a unit test)
//   • `fetch`                         (there is no Cloudflare gateway in a unit test)
//
// That last one is the point: the outbound request is asserted as a REAL URL with
// REAL headers, so this file fails if the app stops passing the account id, the
// gateway name, the operator token, or the config dials into the package.
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const session = { user: { id: 'user-1', email: 'u@example.com' } };
let security: Record<string, unknown>;

vi.mock('@ottabase/auth/backend', () => ({ getSession: vi.fn(async () => session) }));
vi.mock('../../lib/auth-utils', () => ({
    getAuthOptions: vi.fn(() => ({})),
    getSecurityContext: vi.fn(async () => security),
}));

import { clearConnection, registerConnection } from '@ottabase/ottaorm';
import { resetCredentialWrites } from '@ottabase/ottaai/ottaorm';
import { handleAiComplete, handleAiEmbed } from '../ai';

// ---------------------------------------------------------------------------
// Stubs for the three external boundaries
// ---------------------------------------------------------------------------

/** Enough Drizzle surface for the credential store's reads and writes. */
function stubDriver(rows: Array<Record<string, unknown>> = []) {
    const db = {
        insert: () => ({
            values: (data: Record<string, unknown>) => {
                rows.push({ ...data });
                return { returning: async () => [{ ...data }] };
            },
        }),
        update: () => ({
            set: () => ({
                where: () => ({
                    returning: async () => [],
                    then: (resolve: (value: unknown) => unknown) => resolve([]),
                }),
            }),
        }),
        select: () => ({
            from: () => {
                const result = {
                    where: () => result,
                    orderBy: () => result,
                    offset: () => result,
                    limit: async () => rows.slice(0, 1),
                    then: (resolve: (value: unknown) => unknown) => resolve(rows),
                };
                return result;
            },
        }),
        delete: () => ({ where: async () => undefined }),
    };
    return { getDb: () => db, execute: async () => [], executeRaw: async () => undefined };
}

interface Outbound {
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
}

let outbound: Outbound[];

function stubFetch(response: unknown = { choices: [{ message: { content: 'hello' } }], usage: {} }) {
    return vi.fn(async (url: string, init: RequestInit) => {
        const headers: Record<string, string> = {};
        new Headers(init.headers).forEach((value, key) => {
            headers[key] = value;
        });
        outbound.push({ url: String(url), headers, body: JSON.parse(String(init.body)) });
        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    });
}

/** 32+ bytes of decoded material — `createKeyring` rejects anything weaker. */
const MASTER_SECRET = 'dGVzdC1tYXN0ZXItc2VjcmV0LWZvci1vdHRhYWktMzJieXRlcy1taW5pbXVt';

/**
 * An in-memory stand-in for the KV namespace the rate limiter uses.
 *
 * REQUIRED for the happy paths, and that is the behaviour under test as much as anything
 * else: this env configures a platform provider key, so with no limiter available the
 * limiter refuses platform-paid inference outright (see the fail-closed suite below).
 */
let kv: Map<string, string>;

function kvStub() {
    return {
        get: async (key: string) => kv.get(key) ?? null,
        put: async (key: string, value: string) => {
            kv.set(key, value);
        },
    };
}

function env(overrides: Record<string, unknown> = {}) {
    return {
        // NO `OBCF_D1`: `ensureDbConnection` returns early without it, leaving the stub
        // driver this file registers in place.
        OBCF_KV: kvStub(),
        AI_CREDENTIAL_SECRET: MASTER_SECRET,
        CLOUDFLARE_ACCOUNT_ID: 'acct-test',
        CFAI_GATEWAY_NAME: 'gw-test',
        CFAI_GATEWAY_TOKEN: 'cf-aig-token',
        OTTAAI_PLATFORM_PROVIDER: 'openai',
        OTTAAI_PLATFORM_MODEL: 'gpt-4o-mini',
        CFAI_OPENAI_API_KEY: 'sk-platform-key-0123456789',
        ...overrides,
    };
}

function post(body: unknown, envOverrides: Record<string, unknown> = {}) {
    return {
        request: new Request('http://localhost/api/ai/complete', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: typeof body === 'string' ? body : JSON.stringify(body),
        }),
        env: env(envOverrides),
    } as never;
}

function embedPost(body: unknown, envOverrides: Record<string, unknown> = {}) {
    return {
        request: new Request('http://localhost/api/ai/embed', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: typeof body === 'string' ? body : JSON.stringify(body),
        }),
        env: env(envOverrides),
    } as never;
}

beforeEach(() => {
    outbound = [];
    kv = new Map();
    security = { userId: 'user-1', organizationId: null, memberOrganizationIds: [], platformAdmin: false };
    clearConnection('default');
    registerConnection('default', stubDriver() as never);
    resetCredentialWrites();
    vi.stubGlobal('fetch', stubFetch());
});

afterEach(() => {
    vi.unstubAllGlobals();
    clearConnection('default');
    resetCredentialWrites();
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

describe('authentication', () => {
    it('401s an anonymous caller BEFORE any resolution runs', async () => {
        // Not a lesser bug than a missing UI check: `getSecurityContext` only
        // membership-verifies an org id when a user id is present, so an anonymous request
        // can otherwise carry a client-supplied `x-org-id` straight into the RLS-BYPASSING
        // resolver — set one header, run on another tenant's key and bill.
        security = { userId: null, organizationId: 'org-someone-else' };

        const res = await handleAiComplete(post({ prompt: 'hi' }));

        expect(res.status).toBe(401);
        expect(outbound).toHaveLength(0);
    });

    it('501s when the feature is dormant (no master secret configured)', async () => {
        const res = await handleAiComplete(post({ prompt: 'hi' }, { AI_CREDENTIAL_SECRET: undefined }));
        expect(res.status).toBe(501);
        expect(outbound).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// Input validation — the budget, and the untrusted-JSON shapes
// ---------------------------------------------------------------------------

describe('request payload validation', () => {
    it('rejects an unknown task', async () => {
        const res = await handleAiComplete(post({ task: 'not-a-task', prompt: 'hi' }));
        expect(res.status).toBe(400);
    });

    it('rejects a non-string task', async () => {
        const res = await handleAiComplete(post({ task: { evil: true }, prompt: 'hi' }));
        expect(res.status).toBe(400);
    });

    it('rejects a missing or blank prompt', async () => {
        expect((await handleAiComplete(post({}))).status).toBe(400);
        expect((await handleAiComplete(post({ prompt: '   ' }))).status).toBe(400);
    });

    it('rejects a NON-STRING prompt or system instead of forwarding an object to the provider', async () => {
        // `body.system` was previously consumed truthily, so an object became a message whose
        // `content` was an object — which serialises into the provider payload and comes back
        // as a 400 about THEIR schema, debugged as a transport bug.
        expect((await handleAiComplete(post({ prompt: { a: 1 } }))).status).toBe(400);
        expect((await handleAiComplete(post({ prompt: 'hi', system: { role: 'x' } }))).status).toBe(400);
        expect((await handleAiComplete(post({ prompt: 'hi', system: ['a'] }))).status).toBe(400);
        expect(outbound).toHaveLength(0);
    });

    it('enforces a PER-TASK input budget before spending a resolution or a round trip', async () => {
        // `assist` is the chat path and is capped tighter than `extract`, which is expected
        // to carry a long document.
        const huge = 'x'.repeat(20_000);
        const assist = await handleAiComplete(post({ task: 'assist', prompt: huge }));
        expect(assist.status).toBe(400);
        expect(await assist.json()).toMatchObject({ error: expect.stringMatching(/too long/) });
        expect(outbound).toHaveLength(0);

        // The same prompt is within budget for the long-document task.
        const summarize = await handleAiComplete(post({ task: 'summarize', prompt: huge }));
        expect(summarize.status).toBe(200);
    });

    it('caps the system instruction separately from the prompt', async () => {
        const res = await handleAiComplete(post({ prompt: 'hi', system: 'x'.repeat(5_000) }));
        expect(res.status).toBe(400);
        expect(outbound).toHaveLength(0);
    });

    it('refuses an operator-only dynamic route from the request body', async () => {
        const res = await handleAiComplete(post({ prompt: 'hi', model: 'dynamic/premium' }));
        expect(res.status).toBe(400);
        expect(outbound).toHaveLength(0);
    });

    it('refuses a traversal attempt in the model override', async () => {
        // A raw path segment would otherwise be interpolated into the gateway URL while the
        // request still carries the operator's gateway token.
        const res = await handleAiComplete(post({ prompt: 'hi', model: '../../evil' }));
        expect(res.status).toBe(400);
        expect(outbound).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// The wire — real composition, real transport
// ---------------------------------------------------------------------------

describe('the app composes the package into a correctly addressed gateway call', () => {
    it('issues the documented OpenAI gateway request with the operator credentials', async () => {
        const res = await handleAiComplete(post({ prompt: 'Summarise this', system: 'Be terse' }));

        expect(res.status).toBe(200);
        expect(outbound).toHaveLength(1);
        const call = outbound[0]!;

        // The account id and gateway name reached the transport from env, through config,
        // through composition. Any break in that chain lands here.
        expect(call.url).toBe('https://gateway.ai.cloudflare.com/v1/acct-test/gw-test/openai/chat/completions');
        expect(call.headers.authorization).toBe('Bearer sk-platform-key-0123456789');
        expect(call.headers['cf-aig-authorization']).toBe('Bearer cf-aig-token');
        expect(call.body).toMatchObject({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'Be terse' },
                { role: 'user', content: 'Summarise this' },
            ],
        });
    });

    it('tags every call with trusted provenance the caller cannot forge', async () => {
        await handleAiComplete(post({ prompt: 'hi' }));
        const metadata = JSON.parse(outbound[0]!.headers['cf-aig-metadata']!) as Record<string, string>;
        expect(metadata).toMatchObject({ source: 'platform', task: 'assist', app: 'otta-web' });
    });

    it('returns the REDACTED projection — never the merged config that carries a key', async () => {
        const res = await handleAiComplete(post({ prompt: 'hi' }));
        const body = (await res.json()) as Record<string, unknown>;

        expect(body).toMatchObject({ text: 'hello', source: 'platform', provider: 'openai' });
        expect(JSON.stringify(body)).not.toContain('sk-platform-key');
        expect(JSON.stringify(body)).not.toContain('cf-aig-token');
    });

    it('honours a per-call model override', async () => {
        await handleAiComplete(post({ prompt: 'hi', model: 'gpt-4o' }));
        expect(outbound[0]!.body).toMatchObject({ model: 'gpt-4o' });
    });
});

// ---------------------------------------------------------------------------
// Embeddings — the same resolver, a deliberately separate operation
// ---------------------------------------------------------------------------

describe('/api/ai/embed', () => {
    it('issues an OpenAI embeddings call through the gateway with the task-pinned model', async () => {
        vi.stubGlobal(
            'fetch',
            stubFetch({
                data: [{ embedding: [0.125, -0.25, 0.5], index: 0 }],
                model: 'text-embedding-3-small',
                usage: { prompt_tokens: 4 },
            }),
        );

        const res = await handleAiEmbed(embedPost({ input: 'Semantic search starts here', dimensions: 512 }));

        expect(res.status).toBe(200);
        expect(outbound).toHaveLength(1);
        expect(outbound[0]).toMatchObject({
            url: 'https://gateway.ai.cloudflare.com/v1/acct-test/gw-test/openai/embeddings',
            body: {
                model: 'text-embedding-3-small',
                input: 'Semantic search starts here',
                dimensions: 512,
            },
        });
        expect(JSON.parse(outbound[0]!.headers['cf-aig-metadata']!)).toMatchObject({
            source: 'platform',
            task: 'embed',
            app: 'otta-web',
        });
        expect(await res.json()).toMatchObject({
            vectors: [[0.125, -0.25, 0.5]],
            source: 'platform',
            provider: 'openai',
            model: 'text-embedding-3-small',
            usage: { input: 4 },
        });
    });

    it('accepts a small ordered batch and refuses malformed or oversized input before spending', async () => {
        vi.stubGlobal(
            'fetch',
            stubFetch({ data: [{ embedding: [1] }, { embedding: [2] }], usage: { prompt_tokens: 2 } }),
        );
        expect((await handleAiEmbed(embedPost({ input: ['first', 'second'] }))).status).toBe(200);
        expect(outbound[0]!.body.input).toEqual(['first', 'second']);

        expect((await handleAiEmbed(embedPost({ input: ['valid', { no: 'objects' }] }))).status).toBe(400);
        expect((await handleAiEmbed(embedPost({ input: 'x'.repeat(16_001) }))).status).toBe(400);
        expect((await handleAiEmbed(embedPost({ input: 'valid', dimensions: 1_537 }))).status).toBe(400);
        expect(outbound).toHaveLength(1);
    });

    it('requires an authenticated session before resolution', async () => {
        security = { userId: null, organizationId: 'org-someone-else' };

        const res = await handleAiEmbed(embedPost({ input: 'do not bill another tenant' }));

        expect(res.status).toBe(401);
        expect(outbound).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// The gate
// ---------------------------------------------------------------------------

describe('the BYOK gate is enforced by the server, not the browser', () => {
    it('402s a `gate: required` task for a tenant with no key of their own', async () => {
        // `extract` declares `mode: 'byok'` + `gate: 'required'`, so the platform floor —
        // which is fully configured in this env — must NOT satisfy it.
        const res = await handleAiComplete(post({ task: 'extract', prompt: 'a document' }));

        expect(res.status).toBe(402);
        expect(await res.json()).toMatchObject({ code: 'BYOK_REQUIRED' });
        // And nothing was spent on the operator's key finding that out.
        expect(outbound).toHaveLength(0);
    });

    it('serves a `gate: soft` task from the platform floor', async () => {
        const res = await handleAiComplete(post({ task: 'assist', prompt: 'hi' }));
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ source: 'platform' });
    });
});

// ---------------------------------------------------------------------------
// Spend controls
// ---------------------------------------------------------------------------

describe('inference is rate limited, and platform spend fails CLOSED without a limiter', () => {
    it('429s once a single user exceeds their per-minute budget', async () => {
        // The default is 20/minute per user. Authentication alone is not a spend control:
        // without this, one signed-in account can loop the operator's provider key forever.
        const results: number[] = [];
        for (let i = 0; i < 22; i++) {
            results.push((await handleAiComplete(post({ prompt: 'hi' }))).status);
        }

        expect(results.slice(0, 20).every((status) => status === 200)).toBe(true);
        expect(results[20]).toBe(429);
        // And the refusal happened BEFORE the provider was called.
        expect(outbound).toHaveLength(20);
    });

    it('classifies the refusal rather than throwing a bare 429', async () => {
        for (let i = 0; i < 20; i++) await handleAiComplete(post({ prompt: 'hi' }));
        const res = await handleAiComplete(post({ prompt: 'hi' }));

        // The package turns a `quota` refusal into a classified result, so a UI can branch on
        // the code instead of parsing prose.
        expect(res.status).toBe(429);
        expect(await res.json()).toMatchObject({ code: 'RATE_LIMITED' });
    });

    it('does NOT let one hammering user deny AI to everyone else', async () => {
        // The denial-of-service regression, end to end. Rejected calls charge nothing, so a
        // user who blows through their own 20/min cannot drain the 600/min app-wide budget
        // and lock out every other account for the rest of the window.
        for (let i = 0; i < 80; i++) await handleAiComplete(post({ prompt: 'hi' }));

        security = { ...security, userId: 'user-2' };
        const res = await handleAiComplete(post({ prompt: 'hi' }));

        expect(res.status).toBe(200);
    });

    it('REFUSES platform-paid inference when no limiter binding is available', async () => {
        // The deployment mistake this guards: a platform provider key configured, no KV bound,
        // and therefore unbounded spend on the operator's account. Better to refuse loudly.
        const res = await handleAiComplete(post({ prompt: 'hi' }, { OBCF_KV: undefined }));

        expect(res.status).toBe(429);
        expect(outbound).toHaveLength(0);
    });

    it('does NOT refuse when there is no platform key to spend', async () => {
        // A BYOK-only deployment has nothing for an abuser to burn, so a missing limiter is
        // not held to the same standard — it reports NOT_CONFIGURED, the honest answer.
        const res = await handleAiComplete(
            post(
                { prompt: 'hi' },
                { OBCF_KV: undefined, OTTAAI_PLATFORM_PROVIDER: undefined, CFAI_OPENAI_API_KEY: undefined },
            ),
        );

        expect(res.status).toBe(501);
        expect(await res.json()).toMatchObject({ code: 'NOT_CONFIGURED' });
    });

    it('rejects an oversized body before parsing it', async () => {
        // An optimisation, not a boundary: Content-Length is client-supplied and absent on
        // chunked bodies. The real bound is the per-task character limit on the parsed value.
        const request = new Request('http://localhost/api/ai/complete', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'content-length': String(2 * 1024 * 1024) },
            body: JSON.stringify({ prompt: 'hi' }),
        });

        const res = await handleAiComplete({ request, env: env() } as never);

        expect(res.status).toBe(413);
        expect(outbound).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// Not configured
// ---------------------------------------------------------------------------

describe('an incomplete platform config degrades honestly', () => {
    it('reports NOT_CONFIGURED rather than issuing a malformed request', async () => {
        const res = await handleAiComplete(
            post({ prompt: 'hi' }, { OTTAAI_PLATFORM_PROVIDER: undefined, CFAI_OPENAI_API_KEY: undefined }),
        );

        expect(res.status).toBe(501);
        expect(await res.json()).toMatchObject({ code: 'NOT_CONFIGURED' });
        expect(outbound).toHaveLength(0);
    });
});

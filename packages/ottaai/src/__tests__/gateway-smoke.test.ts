// ============================================================
// OPT-IN SMOKE TEST — a REAL call to a REAL Cloudflare AI Gateway.
// ============================================================
// SKIPPED BY DEFAULT. It needs credentials, it costs a fraction of a cent, and it
// touches the network, so it never runs in CI unless someone opts in.
//
// WHY IT EXISTS: `gateway-wire.test.ts` asserts that this transport sends what
// Cloudflare's docs SAY it should. It cannot notice when Cloudflare changes what
// it ACCEPTS. Two known-moving surfaces make that a live risk rather than a
// hypothetical one:
//
//   • the OpenAI-compatible endpoint (`compat/chat/completions`) — which is how a
//     `dynamic/<route>` model ref is invoked — is documented as DEPRECATED in
//     favour of the AI Gateway REST API;
//   • Dynamic Routing itself is Beta.
//
// So the wire tests catch "we transcribed the docs wrong" and this catches
// "the docs changed under us". Run it before a release and after any Cloudflare
// AI Gateway announcement.
//
// Usage (PowerShell):
//   $env:OTTAAI_SMOKE_ACCOUNT_ID="…"; $env:OTTAAI_SMOKE_GATEWAY="…"
//   $env:OTTAAI_SMOKE_PROVIDER="openai"; $env:OTTAAI_SMOKE_MODEL="gpt-4o-mini"
//   $env:OTTAAI_SMOKE_KEY="sk-…"
//   pnpm --filter @ottabase/ottaai exec vitest run gateway-smoke
//
// Optional:
//   OTTAAI_SMOKE_GATEWAY_TOKEN   an authenticated gateway's cf-aig-authorization token
//   OTTAAI_SMOKE_DYNAMIC_ROUTE   a configured dynamic route name, to cover that path too
// ============================================================

import { describe, expect, it } from 'vitest';
import { SecretValue } from '../secret';
import type { MergedTransportConfig } from '../types';
import { createGatewayTransport } from '../transports/gateway';

// Read through a cast rather than `process.env`: the package targets the Workers runtime and
// deliberately ships no `@types/node`, so `process` is not in its lib.
const ENV = ((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {}) as Record<
    string,
    string | undefined
>;

const ACCOUNT_ID = ENV.OTTAAI_SMOKE_ACCOUNT_ID;
const GATEWAY = ENV.OTTAAI_SMOKE_GATEWAY;
const PROVIDER = ENV.OTTAAI_SMOKE_PROVIDER;
const MODEL = ENV.OTTAAI_SMOKE_MODEL;
const KEY = ENV.OTTAAI_SMOKE_KEY;
const GATEWAY_TOKEN = ENV.OTTAAI_SMOKE_GATEWAY_TOKEN;
const DYNAMIC_ROUTE = ENV.OTTAAI_SMOKE_DYNAMIC_ROUTE;

const CONFIGURED = Boolean(ACCOUNT_ID && GATEWAY && PROVIDER && MODEL && KEY);

function config(overrides: Partial<MergedTransportConfig> = {}): MergedTransportConfig {
    return {
        provider: PROVIDER!,
        model: `${PROVIDER}/${MODEL}`,
        secret: new SecretValue(KEY!),
        alias: null,
        accountId: ACCOUNT_ID,
        gateway: GATEWAY,
        gatewayToken: GATEWAY_TOKEN,
        transportConfig: {},
        provenance: {
            source: 'byok',
            credentialId: null,
            taskKey: '__smoke__',
            appId: null,
            organizationId: null,
            userId: null,
        },
        ...overrides,
    };
}

/** Smallest call that still proves the URL, headers and body were accepted. */
const PING = {
    messages: [{ role: 'user' as const, content: 'ping' }],
    maxTokens: 1,
    temperature: 0,
    // A cached success would "prove" a contract that no longer holds.
    skipCache: true,
    timeout: 20_000,
};

describe.skipIf(!CONFIGURED)('REAL Cloudflare AI Gateway', () => {
    const transport = createGatewayTransport();

    it('accepts the provider-native request this transport builds', async () => {
        const result = await transport.createClient(config()).complete(PING);

        // The assertion is deliberately about ACCEPTANCE, not about content: a model is free
        // to answer anything, but a wrong path 404s, a wrong auth header 401s, and a wrong
        // body 400s — and the message names which.
        if (!result.ok) {
            throw new Error(`Gateway rejected the provider-native request: ${result.error.message}`);
        }
        expect(typeof result.result.text).toBe('string');
        // Token accounting is the other half of the contract; a shape change breaks metering
        // silently, so assert the provider reported something.
        expect(result.result.tokens).not.toBeNull();
    });

    it('streams, and reports usage on the stream', async () => {
        const events: string[] = [];
        let usageSeen = false;
        for await (const event of transport.createClient(config()).stream({ ...PING, maxTokens: 8 })) {
            events.push(event.type);
            if (event.type === 'usage') usageSeen = true;
            if (event.type === 'error')
                throw new Error(`Gateway rejected the streamed request: ${event.error.message}`);
        }
        expect(events).toContain('done');
        // OpenAI-shaped providers omit usage on streams unless asked; this is the live proof
        // that `stream_options.include_usage` is still the way to ask.
        expect(usageSeen).toBe(true);
    });

    it.skipIf(!DYNAMIC_ROUTE)('invokes a dynamic route through the compat endpoint', async () => {
        // THE SURFACE MOST LIKELY TO MOVE. Cloudflare documents `compat/chat/completions` as
        // deprecated in favour of the REST API while Dynamic Routing still requires it. When
        // that resolves, this test fails first — which is the entire point of running it.
        const result = await transport
            .createClient(config({ model: `dynamic/${DYNAMIC_ROUTE}` }))
            .complete({ ...PING, maxTokens: 4 });

        if (!result.ok) {
            throw new Error(
                `Dynamic route "${DYNAMIC_ROUTE}" was rejected: ${result.error.message}. ` +
                    'If Cloudflare has migrated dynamic routing off the compat endpoint, update ' +
                    '`DEFAULT_DYNAMIC_PATH` in transports/gateway.ts and its wire test.',
            );
        }
        expect(typeof result.result.text).toBe('string');
    });
});

describe.skipIf(CONFIGURED)('REAL Cloudflare AI Gateway (skipped)', () => {
    it('is opt-in — set OTTAAI_SMOKE_* to run it', () => {
        // A visible skipped test beats a silently absent one: without this, "we have a smoke
        // test" and "the smoke test has run this year" look identical from the terminal.
        expect(CONFIGURED).toBe(false);
    });
});

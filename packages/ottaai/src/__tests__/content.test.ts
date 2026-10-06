// ============================================================
// Images + JSON output, the provider-NEUTRAL half.
//
// The wire half (how each provider spells an image or a JSON request) is asserted
// literally in `gateway-wire.test.ts`. This file covers what every transport
// shares: input validation, the capability declaration rule, and the JSON
// guarantee on `complete()`.
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    AI_CONTENT_LIMITS,
    base64DecodedBytes,
    capabilitiesForCall,
    parseJsonObject,
    validateCallContent,
    type AiMessage,
} from '../content';
import { encryptSecret } from '../crypto';
import { createProviderRegistry } from '../registry';
import { createAiProvisioning, createInstrumentedClient, type AiProvisioning } from '../resolver';
import type { AiTenancyTuple, CredentialRecord, PlatformAiConfig } from '../types';
import {
    createMemoryStore,
    createMockTransport,
    createTestKeyring,
    credentialFixture,
    resetFixtureCounter,
    type MemoryStore,
    type MockTransport,
} from '../testing';

/** 1x1 transparent PNG. */
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

function imageMessage(data = PNG, role: AiMessage['role'] = 'user'): AiMessage {
    return {
        role,
        content: [
            { type: 'text', text: 'read this' },
            { type: 'image', mimeType: 'image/png', data },
        ],
    };
}

/** Base64 of exactly `bytes` decoded bytes (a multiple of 3 keeps it unpadded). */
function base64OfBytes(bytes: number): string {
    return 'A'.repeat((bytes / 3) * 4);
}

describe('validateCallContent', () => {
    it('accepts plain text and an image in a user turn', () => {
        expect(validateCallContent({ messages: [{ role: 'user', content: 'hi' }] })).toEqual({ ok: true });
        expect(validateCallContent({ messages: [imageMessage()] })).toEqual({ ok: true });
    });

    it('refuses an image outside a user turn', () => {
        for (const role of ['system', 'assistant', 'tool'] as const) {
            const result = validateCallContent({ messages: [imageMessage(PNG, role)] });
            expect(result.ok).toBe(false);
        }
    });

    it('refuses a data: URL, non-base64 data and an unsupported mime type', () => {
        const bad = [
            { type: 'image', mimeType: 'image/png', data: `data:image/png;base64,${PNG}` },
            { type: 'image', mimeType: 'image/png', data: 'not base64!' },
            { type: 'image', mimeType: 'image/png', data: 'abc' }, // length not a multiple of 4
            { type: 'image', mimeType: 'image/svg+xml', data: PNG },
            { type: 'image', mimeType: 'image/heic', data: PNG },
        ];
        for (const part of bad) {
            expect(validateCallContent({ messages: [{ role: 'user', content: [part] }] }).ok).toBe(false);
        }
    });

    it('refuses malformed messages and parts from an untrusted body', () => {
        expect(validateCallContent({ messages: [] }).ok).toBe(false);
        expect(validateCallContent({ messages: 'hi' }).ok).toBe(false);
        expect(validateCallContent({ messages: [{ role: 'admin', content: 'hi' }] }).ok).toBe(false);
        expect(validateCallContent({ messages: [{ role: 'user', content: { text: 'hi' } }] }).ok).toBe(false);
        expect(validateCallContent({ messages: [{ role: 'user', content: [] }] }).ok).toBe(false);
        expect(validateCallContent({ messages: [{ role: 'user', content: [{ type: 'audio' }] }] }).ok).toBe(false);
        expect(validateCallContent({ messages: [{ role: 'user', content: [{ type: 'text', text: 1 }] }] }).ok).toBe(
            false,
        );
    });

    it('enforces the per-image, per-request and image-count limits', () => {
        const atLimit = base64OfBytes(AI_CONTENT_LIMITS.imageBytes - (AI_CONTENT_LIMITS.imageBytes % 3));
        expect(validateCallContent({ messages: [imageMessage(atLimit)] }).ok).toBe(true);
        expect(
            validateCallContent({ messages: [imageMessage(base64OfBytes(AI_CONTENT_LIMITS.imageBytes + 3))] }).ok,
        ).toBe(false);

        // Five images each under the per-image cap, together over the request cap.
        const fiveMany = Array.from({ length: 5 }, () => imageMessage(atLimit));
        expect(validateCallContent({ messages: fiveMany }).ok).toBe(false);

        const tooMany = Array.from({ length: AI_CONTENT_LIMITS.images + 1 }, () => imageMessage());
        expect(validateCallContent({ messages: tooMany }).ok).toBe(false);
    });

    it('requires a schema for the strict tier, there is nothing to enforce otherwise', () => {
        const messages = [{ role: 'user', content: 'hi' }];
        expect(validateCallContent({ messages, responseFormat: { type: 'json', strict: true } }).ok).toBe(false);
        expect(validateCallContent({ messages, responseFormat: { type: 'json', strict: 'yes' } }).ok).toBe(false);
        expect(
            validateCallContent({
                messages,
                responseFormat: { type: 'json', strict: true, schema: { type: 'object' } },
            }).ok,
        ).toBe(true);
    });

    it('requires an object-rooted schema and a safe schema name', () => {
        const messages = [{ role: 'user', content: 'hi' }];
        expect(validateCallContent({ messages, responseFormat: { type: 'json' } }).ok).toBe(true);
        expect(validateCallContent({ messages, responseFormat: { type: 'json', schema: { type: 'object' } } }).ok).toBe(
            true,
        );
        expect(validateCallContent({ messages, responseFormat: { type: 'text' } }).ok).toBe(false);
        expect(validateCallContent({ messages, responseFormat: { type: 'json', schema: { type: 'array' } } }).ok).toBe(
            false,
        );
        expect(validateCallContent({ messages, responseFormat: { type: 'json', name: 'has space' } }).ok).toBe(false);
    });
});

describe('content helpers', () => {
    it('computes decoded bytes from base64 length and padding', () => {
        expect(base64DecodedBytes('QUJD')).toBe(3);
        expect(base64DecodedBytes('QUI=')).toBe(2);
        expect(base64DecodedBytes('QQ==')).toBe(1);
    });

    it('derives the capabilities a call needs', () => {
        expect(capabilitiesForCall({ messages: [{ role: 'user', content: 'hi' }] })).toEqual([]);
        expect(capabilitiesForCall({ messages: [imageMessage()], responseFormat: { type: 'json' } })).toEqual([
            'vision',
            'json',
        ]);
    });

    it('parses an object reply, tolerating exactly one code fence', () => {
        expect(parseJsonObject('{"a":1}')).toEqual({ a: 1 });
        expect(parseJsonObject('  ```json\n{"a":1}\n```  ')).toEqual({ a: 1 });
        expect(parseJsonObject('```\n{"a":1}\n```')).toEqual({ a: 1 });
    });

    it('rejects arrays, scalars, prose and truncated JSON', () => {
        expect(parseJsonObject('[1,2]')).toBeUndefined();
        expect(parseJsonObject('null')).toBeUndefined();
        expect(parseJsonObject('Here you go: {"a":1}')).toBeUndefined();
        expect(parseJsonObject('{"a":')).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// Through the real resolver + instrumented client
// ---------------------------------------------------------------------------

const registry = createProviderRegistry();
const CONTEXT: AiTenancyTuple = { userId: 'user-1', organizationId: 'org-a', appId: 'app-1', impersonated: false };
const PLATFORM: PlatformAiConfig = {
    accountId: 'acct',
    gateway: 'gw',
    provider: 'openai',
    providerKey: 'platform-key-0123456789',
    model: 'gpt-4o-mini',
};

interface Harness {
    ai: AiProvisioning<AiTenancyTuple>;
    store: MemoryStore;
    transport: MockTransport;
    events: Array<{ event: string; payload: Record<string, unknown> }>;
    quota: ReturnType<typeof vi.fn>;
}

function harness(options: Record<string, unknown> = {}): Harness {
    const store = createMemoryStore();
    const transport = createMockTransport();
    const events: Harness['events'] = [];
    const quota = vi.fn().mockReturnValue(true);
    const ai = createAiProvisioning<AiTenancyTuple>({
        keyring: createTestKeyring(),
        store,
        transport,
        platform: PLATFORM,
        registry,
        tasks: [{ key: 'chat' }, { key: 'scan', requiredCapabilities: ['vision', 'json'] }],
        contextFrom: (tuple: AiTenancyTuple) => tuple,
        verifyMembership: () => true,
        authorize: () => true,
        quota,
        eventSink: (event: string, payload: unknown) =>
            events.push({ event, payload: payload as Record<string, unknown> }),
        ...options,
    } as never) as AiProvisioning<AiTenancyTuple>;
    return { ai, store, transport, events, quota };
}

async function encryptedCredential(overrides: Partial<CredentialRecord> = {}): Promise<CredentialRecord> {
    const base = credentialFixture(overrides);
    const { envelope, keyId, formatVersion } = await encryptSecret({
        plaintext: 'sk-tenant-abcdefgh',
        keyring: createTestKeyring(),
        aad: {
            credentialId: base.id,
            organizationId: base.organizationId,
            userId: base.userId,
            appId: base.appId,
            provider: base.provider,
        },
    });
    return { ...base, secret: { kind: 'inline', ciphertext: envelope }, keyId, formatVersion };
}

async function clientFor(h: Harness, task: string) {
    const resolution = await h.ai.resolve(h.ai.contextFrom(CONTEXT), task);
    return resolution.client!;
}

beforeEach(() => resetFixtureCounter());

describe('a call may only use what its TASK declared', () => {
    it('refuses an image on a task without `vision`, before quota and before any request', async () => {
        const h = harness();
        const client = await clientFor(h, 'chat');
        const result = await client.complete({ messages: [imageMessage()] });

        expect(result).toMatchObject({ ok: false, code: 'CONFIGURATION' });
        expect(result.ok ? '' : result.message).toMatch(/requiredCapabilities: \['vision'\]/);
        expect(h.transport.calls).toHaveLength(0);
        expect(h.quota).not.toHaveBeenCalled();
    });

    it('refuses `responseFormat` on a task without `json`', async () => {
        const h = harness();
        const client = await clientFor(h, 'chat');
        const result = await client.complete({
            messages: [{ role: 'user', content: 'hi' }],
            responseFormat: { type: 'json' },
        });
        expect(result).toMatchObject({ ok: false, code: 'CONFIGURATION' });
        expect(h.transport.calls).toHaveLength(0);
    });

    it('refuses malformed content as VALIDATION, before quota', async () => {
        const h = harness();
        const client = await clientFor(h, 'scan');
        const result = await client.complete({ messages: [imageMessage('data:image/png;base64,xx')] });
        expect(result).toMatchObject({ ok: false, code: 'VALIDATION' });
        expect(h.quota).not.toHaveBeenCalled();
    });

    it('refuses on the stream path too, as an error event', async () => {
        const h = harness();
        const client = await clientFor(h, 'chat');
        const events = [];
        for await (const event of client.stream({ messages: [imageMessage()] })) events.push(event);
        expect(events).toEqual([
            expect.objectContaining({
                type: 'error',
                error: expect.objectContaining({ code: 'CONFIGURATION' }),
            }),
        ]);
        expect(h.transport.calls).toHaveLength(0);
    });

    it('passes an image and a JSON request through when the task declares both', async () => {
        const h = harness();
        const client = await clientFor(h, 'scan');
        h.transport.script({ text: '{"total":12.5}' });
        const result = await client.complete({ messages: [imageMessage()], responseFormat: { type: 'json' } });

        expect(result).toMatchObject({ ok: true, result: { json: { total: 12.5 } } });
        expect(h.transport.calls[0]!.options).toMatchObject({ responseFormat: { type: 'json' } });
    });
});

describe('the JSON guarantee', () => {
    it('never returns ok without a parsed object', async () => {
        const h = harness();
        const client = await clientFor(h, 'scan');
        h.transport.script({ text: '{"total": 12.', tokens: { input: 900, output: 4096 } });
        const result = await client.complete({ messages: [imageMessage()], responseFormat: { type: 'json' } });

        expect(result).toMatchObject({ ok: false, code: 'INVALID_RESPONSE' });
    });

    it('still METERS the tokens of an unusable reply, the provider billed for them', async () => {
        const h = harness();
        const client = await clientFor(h, 'scan');
        h.transport.script({ text: 'Sorry, I cannot read that.', tokens: { input: 900, output: 12 } });
        await client.complete({ messages: [imageMessage()], responseFormat: { type: 'json' } });

        const completed = h.events.filter((e) => e.event === 'call.completed').at(-1)!;
        expect(completed.payload).toMatchObject({
            outcome: 'error',
            errorCode: 'INVALID_RESPONSE',
            inputTokens: 900,
            outputTokens: 12,
        });
    });

    it('does not touch a plain text call', async () => {
        const h = harness();
        const client = await clientFor(h, 'chat');
        h.transport.script({ text: 'not json' });
        const result = await client.complete({ messages: [{ role: 'user', content: 'hi' }] });
        expect(result).toMatchObject({ ok: true, result: { text: 'not json' } });
        expect(result.ok && 'json' in result.result).toBe(false);
    });
});

describe('degradation honours the task capabilities', () => {
    it('does not retry an image on a text-only platform model when the tenant key 401s', async () => {
        // Groq's registry defaults carry no `vision`, so it cannot serve a vision task.
        const h = harness({
            degradation: 'platform-on-auth-error',
            platform: { ...PLATFORM, provider: 'groq', model: 'llama-3.3-70b-versatile' },
            tasks: [{ key: 'scan', requiredCapabilities: ['vision', 'json'] }],
        });
        h.store.seed([await encryptedCredential({ provider: 'openai', model: 'gpt-4o-mini' })]);
        const client = await clientFor(h, 'scan');
        h.transport.script({ status: 401 });
        const result = await client.complete({ messages: [imageMessage()], responseFormat: { type: 'json' } });

        expect(result).toMatchObject({ ok: false, code: 'INVALID_KEY' });
        expect(h.events.some((e) => e.event === 'call.degraded')).toBe(false);
        expect(h.transport.calls).toHaveLength(1);
    });

    it('still degrades when the platform model CAN serve the task', async () => {
        const h = harness({
            degradation: 'platform-on-auth-error',
            tasks: [{ key: 'scan', requiredCapabilities: ['vision', 'json'] }],
        });
        h.store.seed([await encryptedCredential({ provider: 'anthropic', model: 'claude-haiku-4-5' })]);
        const client = await clientFor(h, 'scan');
        h.transport.script({ status: 401 });
        await client.complete({ messages: [imageMessage()], responseFormat: { type: 'json' } });
        expect(h.events.some((e) => e.event === 'call.degraded')).toBe(true);
    });
});

describe('a route refusal is not a key failure', () => {
    it('classifies as UNSUPPORTED_OPERATION and leaves credential health alone', async () => {
        const recordOutcome = vi.fn().mockResolvedValue(undefined);
        const client = createInstrumentedClient({
            raw: {
                complete: async () => ({
                    ok: false,
                    error: { retryable: false, code: 'UNSUPPORTED_OPERATION', message: 'no images here' },
                }),
                async *stream() {},
            },
            platformFallback: null,
            config: {
                provider: 'openai',
                model: 'openai/gpt-4o-mini',
                secret: null,
                alias: null,
                transportConfig: {},
                provenance: {
                    source: 'byok',
                    credentialId: 'cred-1',
                    taskKey: 'scan',
                    appId: null,
                    organizationId: null,
                    userId: 'user-1',
                },
            },
            source: 'byok',
            taskKey: 'scan',
            taskCapabilities: ['vision'],
            degradation: 'strict',
            emit: () => {},
            defer: () => {},
            recordOutcome,
            redactionSentinels: [],
        });

        const result = await client.complete({ messages: [imageMessage()] });
        expect(result).toMatchObject({ ok: false, code: 'UNSUPPORTED_OPERATION', message: 'no images here' });
        expect(recordOutcome).not.toHaveBeenCalled();
    });
});

describe('a route that cannot carry a capability resolves CAPABILITY_UNMET, not a doomed client', () => {
    it('on the platform path: status and the gate must not offer what every call refuses', async () => {
        const h = harness();
        // e.g. Cloudflare Unified Billing: the model reads images, the REST endpoint does not.
        h.transport.script({ unsupported: ['vision'] });

        const scan = await h.ai.resolve(h.ai.contextFrom(CONTEXT), 'scan');
        expect(scan).toMatchObject({ client: null, source: null, reason: 'CAPABILITY_UNMET' });

        // A task that needs no vision is unaffected by the same route.
        const chat = await h.ai.resolve(h.ai.contextFrom(CONTEXT), 'chat');
        expect(chat.client).not.toBeNull();
    });

    it('on the tenant path: the credential is skipped with a readable verdict', async () => {
        const h = harness();
        h.store.seed([await encryptedCredential({ provider: 'openai', model: 'gpt-4o-mini' })]);
        h.transport.script({ unsupported: ['vision'] });

        const scan = await h.ai.resolve(h.ai.contextFrom(CONTEXT), 'scan');
        expect(scan.client).toBeNull();
        expect(h.events).toContainEqual(
            expect.objectContaining({
                event: 'credential.skipped',
                payload: expect.objectContaining({ verdict: 'CAPABILITY_UNMET' }),
            }),
        );
    });

    it('still refuses an image at call time if a route turns it away', async () => {
        const h = harness();
        const client = await clientFor(h, 'scan');
        h.transport.script({ unsupported: ['vision'] });
        const result = await client.complete({ messages: [imageMessage()], responseFormat: { type: 'json' } });
        expect(result).toMatchObject({ ok: false, code: 'UNSUPPORTED_OPERATION' });
    });
});

describe('task output budget', () => {
    it("applies the task's maxTokens when the call sets none, and lets the call win", async () => {
        const h = harness({ tasks: [{ key: 'chat', maxTokens: 4096 }] });
        const client = await clientFor(h, 'chat');

        await client.complete({ messages: [{ role: 'user', content: 'hi' }] });
        await client.complete({ messages: [{ role: 'user', content: 'hi' }], maxTokens: 100 });
        for await (const _ of client.stream({ messages: [{ role: 'user', content: 'hi' }] })) void _;

        expect(h.transport.calls.map((c) => (c.options as { maxTokens?: number }).maxTokens)).toEqual([
            4096, 100, 4096,
        ]);
    });

    it('refuses a non-positive or fractional budget at composition', () => {
        for (const maxTokens of [0, -1, 1.5]) {
            expect(() => harness({ tasks: [{ key: 'chat', maxTokens }] })).toThrow(/maxTokens/);
        }
    });
});

describe('a per-call model is re-checked against the task', () => {
    it('refuses a per-call model that lacks a capability the task requires', async () => {
        const h = harness();
        const client = await clientFor(h, 'scan');
        // Registered for OpenAI, but an embedding model, no vision, no json.
        const result = await client.complete({
            messages: [imageMessage()],
            responseFormat: { type: 'json' },
            model: 'text-embedding-3-small',
        });
        expect(result).toMatchObject({ ok: false, code: 'CONFIGURATION' });
        expect(result.ok ? '' : result.message).toMatch(/lacks vision, json/);
        expect(h.transport.calls).toHaveLength(0);
    });

    it("follows the task's unknownModelPolicy for a model the registry has never seen", async () => {
        const deny = harness();
        const denied = await (
            await clientFor(deny, 'scan')
        ).complete({
            messages: [imageMessage()],
            responseFormat: { type: 'json' },
            model: 'gpt-from-the-future',
        });
        expect(denied).toMatchObject({ ok: false, code: 'CONFIGURATION' });

        const allow = harness({
            tasks: [{ key: 'scan', requiredCapabilities: ['vision', 'json'], unknownModelPolicy: 'allow' }],
        });
        allow.transport.script({ text: '{"ok":true}' });
        const allowed = await (
            await clientFor(allow, 'scan')
        ).complete({
            messages: [imageMessage()],
            responseFormat: { type: 'json' },
            model: 'gpt-from-the-future',
        });
        expect(allowed.ok).toBe(true);
    });

    it('lets a capable per-call model through', async () => {
        const h = harness();
        h.transport.script({ text: '{"ok":true}' });
        const result = await (
            await clientFor(h, 'scan')
        ).complete({ messages: [imageMessage()], responseFormat: { type: 'json' }, model: 'gpt-4o' });
        expect(result.ok).toBe(true);
    });
});

// ============================================================
// The resolution STATE MACHINE: every stage, every exit, every reason code.
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encryptSecret } from '../crypto';
import { AI_ERROR_CODES } from '../errors';
import { createProviderRegistry } from '../registry';
import { createAiProvisioning, type AiProvisioning } from '../resolver';
import { evaluateGate, intersectModes } from '../tasks';
import type { AiTenancyTuple, CredentialRecord, PlatformAiConfig } from '../types';
import {
    createMemoryStore,
    createMockTransport,
    createTestKeyring,
    credentialFixture,
    resetFixtureCounter,
    strictModeSink,
    StrictModeViolation,
    type MemoryStore,
    type MockTransport,
} from '../testing';

const CONTEXT: AiTenancyTuple = {
    userId: 'user-1',
    organizationId: 'org-a',
    appId: 'app-1',
    impersonated: false,
};

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

function harness(options: Partial<Parameters<typeof createAiProvisioning>[0]> = {}): Harness {
    const store = createMemoryStore();
    const transport = createMockTransport();
    const events: Array<{ event: string; payload: Record<string, unknown> }> = [];

    const ai = createAiProvisioning<AiTenancyTuple>({
        keyring: createTestKeyring(),
        store,
        transport,
        platform: PLATFORM,
        registry: createProviderRegistry(),
        tasks: [{ key: 'chat' }, { key: 'premium', mode: 'byok', gate: 'required' }],
        contextFrom: (tuple) => tuple,
        verifyMembership: () => true,
        authorize: () => true,
        // Supplied so composition does not warn about unbounded platform spend in every
        // unrelated test — this PLATFORM config genuinely has a usable route. The warning is
        // covered explicitly in `review-regressions.test.ts`.
        quota: () => true,
        eventSink: (event, payload) => events.push({ event, payload: payload as unknown as Record<string, unknown> }),
        ...options,
    } as Parameters<typeof createAiProvisioning>[0]) as AiProvisioning<AiTenancyTuple>;

    return { ai, store, transport, events };
}

beforeEach(() => resetFixtureCounter());

describe('composition — boot tier THROWS', () => {
    it('requires verifyMembership and authorize whenever the strategy has an org dimension', () => {
        expect(() =>
            createAiProvisioning({
                keyring: createTestKeyring(),
                store: createMemoryStore(),
                transport: createMockTransport(),
                platform: PLATFORM,
                tasks: [],
                contextFrom: (t: AiTenancyTuple) => t,
                strategy: 'org-then-user',
            } as never),
        ).toThrow(/verifyMembership/);

        expect(() =>
            createAiProvisioning({
                keyring: createTestKeyring(),
                store: createMemoryStore(),
                transport: createMockTransport(),
                platform: PLATFORM,
                tasks: [],
                contextFrom: (t: AiTenancyTuple) => t,
                strategy: 'org-then-user',
                verifyMembership: () => true,
            } as never),
        ).toThrow(/authorize/);
    });

    it('rejects an incoherent platform pairing at BOOT, not at first inference', () => {
        expect(() =>
            createAiProvisioning({
                keyring: createTestKeyring(),
                store: createMemoryStore(),
                transport: createMockTransport(),
                platform: { ...PLATFORM, provider: 'openai', model: 'anthropic/claude-sonnet-4-5' },
                tasks: [],
                contextFrom: (t: AiTenancyTuple) => t,
                strategy: 'user',
            } as never),
        ).toThrow(/incoherent/);
    });

    it('skips the coherence check OUT LOUD for a dynamic route rather than passing silently', () => {
        const onBoot = vi.fn();
        createAiProvisioning({
            keyring: createTestKeyring(),
            store: createMemoryStore(),
            transport: createMockTransport(),
            platform: { ...PLATFORM, model: 'dynamic/default-chat' },
            tasks: [],
            contextFrom: (t: AiTenancyTuple) => t,
            strategy: 'user',
            onBoot,
        } as never);
        expect(onBoot).toHaveBeenCalledWith(expect.objectContaining({ coherenceCheck: 'skipped' }));
    });

    it('rejects platform.providerKey with no declared provider — inference from a prefix goes stale', () => {
        expect(() =>
            createAiProvisioning({
                keyring: createTestKeyring(),
                store: createMemoryStore(),
                transport: createMockTransport(),
                platform: { accountId: 'a', gateway: 'g', providerKey: 'sk-x' },
                tasks: [],
                contextFrom: (t: AiTenancyTuple) => t,
                strategy: 'user',
            } as never),
        ).toThrow(/must be DECLARED/);
    });

    it('validates EVERY declared task eagerly — a task that can never run is a boot error', () => {
        expect(() =>
            createAiProvisioning({
                keyring: createTestKeyring(),
                store: createMemoryStore(),
                transport: createMockTransport(),
                platform: PLATFORM,
                mode: 'platform',
                tasks: [{ key: 'gated', mode: 'byok' }],
                contextFrom: (t: AiTenancyTuple) => t,
                strategy: 'user',
            } as never),
        ).toThrow(/no key source is permitted/);
    });

    it('the KILL SWITCH rewrites rather than intersects, so the adoption cliff never fires', () => {
        const onBoot = vi.fn();
        const ai = createAiProvisioning({
            keyring: createTestKeyring(),
            store: createMemoryStore(),
            transport: createMockTransport(),
            platform: PLATFORM,
            byokEnabled: false,
            tasks: [{ key: 'gated', mode: 'byok', gate: 'required' }],
            contextFrom: (t: AiTenancyTuple) => t,
            strategy: 'user',
            onBoot,
        } as never) as AiProvisioning<AiTenancyTuple>;
        // Every `required` gate is downgraded to `soft`, and nothing throws.
        expect(ai.tasks.get('gated')?.gate).toBe('soft');
        expect(ai.tasks.get('gated')?.mode).toBe('platform');
    });
});

describe('mode intersection law — a layer may only REMOVE a permission', () => {
    it.each([
        [['auto', 'byok'], 'byok'],
        [['auto', 'platform'], 'platform'],
        [['byok', 'auto'], 'byok'],
        [['platform', 'auto'], 'platform'],
        [['auto', 'auto'], 'auto'],
    ] as const)('%s ⇒ %s', (modes, expected) => {
        expect(intersectModes(...(modes as unknown as Array<'auto' | 'byok' | 'platform'>))).toBe(expected);
    });

    it('throws on {✗,✗}', () => {
        expect(() => intersectModes('platform', 'byok')).toThrow(/no key source is permitted/);
    });
});

describe('state machine', () => {
    it('stage 1 — MODE_PLATFORM_ONLY when the tenant path is not permitted', async () => {
        const { ai, store } = harness();
        store.seed([await encryptedCredential()]);
        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'chat', { mode: 'platform' });
        expect(resolution.source).toBe('platform');
        expect(resolution.tenantReason).toBe('MODE_PLATFORM_ONLY');
    });

    it('stage 1i — an impersonated actor never spends the tenant key', async () => {
        const { ai, store } = harness();
        store.seed([await encryptedCredential()]);
        const resolution = await ai.resolve(ai.contextFrom({ ...CONTEXT, impersonated: true }), 'chat');
        expect(resolution.source).toBe('platform');
        expect(resolution.tenantReason).toBe('IMPERSONATED_ACTOR');
    });

    it('stage 2 — refuses an unscoped lookup outright', async () => {
        const { ai, store } = harness();
        const spy = vi.spyOn(store, 'findCandidates');
        const resolution = await ai.resolve(
            ai.contextFrom({ userId: null, organizationId: null, appId: 'app-1', impersonated: false }),
            'chat',
        );
        expect(resolution.tenantReason).toBe('NO_TENANT_CONTEXT');
        expect(spy).not.toHaveBeenCalled();
    });

    it('stage 4 — NO_CREDENTIAL falls through to the platform under `auto`', async () => {
        const { ai } = harness();
        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'chat');
        expect(resolution.source).toBe('platform');
        expect(resolution.reason).toBe('PLATFORM_FALLBACK');
        expect(resolution.tenantReason).toBe('NO_CREDENTIAL');
    });

    it('BOTH reasons are always returned — otherwise `auto` flattens every cause', async () => {
        const { ai, store } = harness();
        store.seed([await encryptedCredential({ enabled: false })]);
        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'chat');
        expect(resolution.reason).toBe('PLATFORM_FALLBACK');
        expect(resolution.tenantReason).toBe('ALL_DISABLED');
    });

    it('stage 7✓ — SELECTED on the happy path, with a client', async () => {
        const { ai, store } = harness();
        store.seed([await encryptedCredential({ model: 'gpt-4o' })]);
        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'chat');
        expect(resolution.source).toBe('byok');
        expect(resolution.reason).toBe('SELECTED');
        expect(resolution.tenantReason).toBeNull();
        expect(resolution.client).not.toBeNull();
        expect(resolution.model).toBe('openai/gpt-4o');
    });

    it('stage 8 — no client at all when the mode forbids the platform and nothing was selected', async () => {
        const { ai } = harness();
        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'premium');
        expect(resolution.client).toBeNull();
        expect(resolution.source).toBeNull();
        expect(resolution.reason).toBe('NO_CREDENTIAL');
    });

    it('stage 6b — NO_TENANT_SECRET under `byok` when the winner carries no secret', async () => {
        const { ai, store } = harness();
        store.seed([credentialFixture({ provider: 'openai', secret: { kind: 'none' }, keyHint: '' })]);
        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'premium');
        expect(resolution.reason).toBe('NO_TENANT_SECRET');
        expect(resolution.client).toBeNull();
    });

    it('stage 6 — the keyless-mismatch guard discards the WHOLE credential, including its model', async () => {
        const { ai, store } = harness();
        store.seed([credentialFixture({ provider: 'openai', secret: { kind: 'none' }, model: 'gpt-4o' })]);
        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'chat');
        expect(resolution.tenantReason).toBe('SKIPPED_KEYLESS_MISMATCH');
        // The fall-through uses the PLATFORM'S model, not the tenant's.
        expect(resolution.model).toBe('openai/gpt-4o-mini');
    });

    it('stage 9✗ — PLATFORM_INCOMPLETE when the adapter says the merged config cannot issue a request', async () => {
        const transport = createMockTransport();
        transport.isComplete = () => false;
        const { ai } = harness({ transport });
        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'chat');
        expect(resolution.reason).toBe('PLATFORM_INCOMPLETE');
        expect(resolution.client).toBeNull();
    });

    it('the resolver NEVER throws for any of these — absence of a client is the signal', async () => {
        const { ai } = harness();
        await expect(ai.resolve(ai.contextFrom(CONTEXT), 'premium')).resolves.toBeDefined();
    });
});

describe('decrypt failure FAILS CLOSED', () => {
    it('returns CREDENTIAL_UNREADABLE in `auto`, rather than silently moving spend to the operator', async () => {
        const { ai, store, events } = harness();
        // A row wrapped under a key this deployment does not hold.
        store.seed([
            credentialFixture({
                secret: { kind: 'inline', ciphertext: 'v1.othertkey.AAAA.BBBB.CCCC' },
                keyId: 'othertkey',
            }),
        ]);
        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'chat');
        expect(resolution.source).toBeNull();
        expect(resolution.reason).toBe('CREDENTIAL_UNREADABLE');
        expect(resolution.client).toBeNull();

        const failure = events.find((entry) => entry.event === 'credential.decrypt_failed');
        expect(failure).toBeDefined();
        // The event carries the CODE plus keyId + formatVersion — exactly what diagnosis
        // needs — and never the envelope.
        expect(failure!.payload.errorCode).toBe(AI_ERROR_CODES.NO_ENCRYPTION_KEY);
        expect(JSON.stringify(failure!.payload)).not.toContain('AAAA.BBBB.CCCC');
    });

    it('`fall-through` exists for deployments that consciously prefer availability', async () => {
        const { ai, store } = harness({ onCredentialError: 'fall-through' });
        store.seed([
            credentialFixture({
                secret: { kind: 'inline', ciphertext: 'v1.othertkey.AAAA.BBBB.CCCC' },
                keyId: 'othertkey',
            }),
        ]);
        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'chat');
        expect(resolution.source).toBe('platform');
        expect(resolution.tenantReason).toBe('CREDENTIAL_UNREADABLE');
    });
});

describe('the pre-resolved credential parameter is a THREE-state seam', () => {
    it('explicit null forces the platform path with NO lookup', async () => {
        const { ai, store } = harness();
        const spy = vi.spyOn(store, 'findCandidates');
        store.seed([await encryptedCredential()]);
        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'chat', { credential: null });
        expect(resolution.source).toBe('platform');
        expect(spy).not.toHaveBeenCalled();
    });

    it('a record is used directly', async () => {
        const { ai, store } = harness();
        const spy = vi.spyOn(store, 'findCandidates');
        const record = await encryptedCredential();
        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'chat', { credential: record });
        expect(resolution.source).toBe('byok');
        expect(spy).not.toHaveBeenCalled();
    });
});

describe('the status primitive is the DRY RUN, not the force-platform flag', () => {
    it('reports byok for a tenant with a working key — the bug this test exists to prevent', async () => {
        const { ai, store } = harness();
        store.seed([await encryptedCredential()]);
        const status = await ai.status(ai.contextFrom(CONTEXT));
        expect(status.source).toBe('byok');
        expect(status.configured).toBe(true);
        expect(status.hasSecret).toBe(true);
    });

    it('answers the gate for every declared task', async () => {
        const { ai, store } = harness();
        store.seed([await encryptedCredential()]);
        const status = await ai.status(ai.contextFrom(CONTEXT));
        expect(status.gates.chat?.allowed).toBe(true);
        expect(status.gates.premium?.allowed).toBe(true);
    });

    it('reports whether an org-scoped row could ever be SELECTED under this strategy', async () => {
        // A rung the write path can produce but the resolver can never choose is dead data
        // that errors nowhere: under `strategy: 'user'` an org-only row scores 0 in every
        // match class. The settings UI and the create handler both key off this.
        const userOnly = harness({ strategy: 'user' });
        expect((await userOnly.ai.status(userOnly.ai.contextFrom(CONTEXT))).orgScopeManageable).toBe(false);

        for (const strategy of ['org', 'user-then-org', 'org-then-user'] as const) {
            const h = harness({ strategy });
            expect((await h.ai.status(h.ai.contextFrom(CONTEXT))).orgScopeManageable).toBe(true);
        }
    });

    it('the management list shows BOTH dimensions, unlike the single-dimension RLS filter', async () => {
        // The route factory reads the store's two-query fan-out, so under `user-then-org` an
        // org key is still visible and manageable — the RLS policy is defence in depth for
        // the generic-CRUD path, not the source for this list.
        const { ai, store } = harness();
        store.seed([
            await encryptedCredential({ id: 'mine', userId: 'user-1', organizationId: null }),
            await encryptedCredential({ id: 'ours', userId: null, organizationId: 'org-a' }),
        ]);
        const found = await store.findCandidates(
            { organizationId: 'org-a', userId: 'user-1', appId: 'app-1' },
            ai.strategy,
        );
        expect(found.map((r) => r.id).sort()).toEqual(['mine', 'ours']);
    });

    it('fetches candidates ONCE for the whole status call, not once per declared task', async () => {
        const { ai, store } = harness();
        const spy = vi.spyOn(store, 'findCandidates');
        store.seed([await encryptedCredential()]);
        await ai.status(ai.contextFrom(CONTEXT));
        // Three declared tasks in the harness; the candidate set is task-independent.
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('never returns a secret-bearing field', async () => {
        const { ai, store } = harness();
        store.seed([await encryptedCredential()]);
        const status = await ai.status(ai.contextFrom(CONTEXT));
        expect(JSON.stringify(status)).not.toContain('v1.test.');
    });
});

describe('the gate predicate', () => {
    it('a KEYLESS FREE provider must NOT satisfy a `required` gate', () => {
        // `source === 'byok'` alone would walk straight past the gate into exactly the
        // quality the gate existed to prevent.
        expect(evaluateGate({ gate: 'required', source: 'byok', tenantSecretPresent: false }).allowed).toBe(false);
        expect(evaluateGate({ gate: 'required', source: 'byok', tenantSecretPresent: true }).allowed).toBe(true);
    });

    it('a `soft` gate always passes, and flags the upsell', () => {
        const answer = evaluateGate({ gate: 'soft', source: 'platform', tenantSecretPresent: false });
        expect(answer.allowed).toBe(true);
        expect(answer.upsell).toBe(true);
    });
});

describe('requireByok is the SAME resolver, so guard and runtime cannot drift', () => {
    it('denies without a tenant key and allows with one', async () => {
        const { ai, store } = harness();
        const context = ai.contextFrom(CONTEXT);
        await expect(ai.requireByok(context, 'premium')).resolves.toMatchObject({ allowed: false });

        store.seed([await encryptedCredential()]);
        await expect(ai.requireByok(context, 'premium')).resolves.toEqual({ allowed: true });
    });
});

describe('explainResolution returns a VERDICT PROJECTION, never records', () => {
    it('shows why each candidate lost, with no ciphertext anywhere', async () => {
        const { ai, store } = harness();
        store.seed([await encryptedCredential({ id: 'winner' }), credentialFixture({ id: 'loser', enabled: false })]);
        const explained = await ai.explainResolution(ai.contextFrom(CONTEXT), 'chat');
        expect(explained.candidates).toHaveLength(2);
        expect(explained.candidates.find((c) => c.id === 'loser')?.verdict).toBe('DISABLED');
        expect(explained.candidates.find((c) => c.id === 'winner')?.selected).toBe(true);
        expect(JSON.stringify(explained)).not.toContain('v1.test.');
        expect(explained.resolution.client).toBeNull();
    });
});

describe('strict mode catches the trap dev environments hide', () => {
    it('fails when a task falls through to the platform unexpectedly', async () => {
        const { ai } = harness({ eventSink: strictModeSink([]) });
        await expect(ai.resolve(ai.contextFrom(CONTEXT), 'chat')).rejects.toBeInstanceOf(StrictModeViolation);
    });

    it('passes for tasks that are allowed to run on the platform', async () => {
        const { ai } = harness({ eventSink: strictModeSink(['chat']) });
        await expect(ai.resolve(ai.contextFrom(CONTEXT), 'chat')).resolves.toBeDefined();
    });
});

describe('the instrumented client', () => {
    it('meters every call with the resolved source, and never at the call site', async () => {
        const { ai, store, events } = harness();
        store.seed([await encryptedCredential()]);
        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'chat');
        await resolution.client!.complete({ messages: [{ role: 'user', content: 'hi' }] });

        const completed = events.find((entry) => entry.event === 'call.completed');
        expect(completed?.payload).toMatchObject({ source: 'byok', taskKey: 'chat', outcome: 'success' });
    });

    it('routes embeddings through the same quota, provenance and outcome pipeline as chat', async () => {
        const { ai, store, events, transport } = harness({
            tasks: [
                {
                    key: 'embed',
                    defaultModel: 'openai/text-embedding-3-small',
                    requiredCapabilities: ['embedding'],
                },
            ],
        });
        store.seed([await encryptedCredential({ model: 'openai/text-embedding-3-small' })]);

        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'embed');
        const result = await resolution.client!.embed({ input: ['first', 'second'] });

        expect(result).toMatchObject({ ok: true, result: { vectors: [[0.1, 0.2, 0.3]] } });
        expect(transport.calls).toContainEqual(expect.objectContaining({ kind: 'embed' }));
        expect(events.find((entry) => entry.event === 'call.completed')?.payload).toMatchObject({
            source: 'byok',
            taskKey: 'embed',
            operation: 'embedding',
            inputTokens: 1,
            outputTokens: null,
        });
    });

    it('classifies a 401 as INVALID_KEY and does NOT cascade by default', async () => {
        const { ai, store, transport } = harness();
        store.seed([await encryptedCredential()]);
        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'chat');
        transport.script({ status: 401 });

        const result = await resolution.client!.complete({ messages: [{ role: 'user', content: 'hi' }] });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.code).toBe(AI_ERROR_CODES.INVALID_KEY);
        // Selection, not cascade: exactly one upstream attempt.
        expect(transport.calls).toHaveLength(1);
    });

    it('a 429 reports RATE_LIMITED — the key WORKS, so a boolean-only UI would lie', async () => {
        const { ai, store, transport } = harness();
        store.seed([await encryptedCredential()]);
        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'chat');
        transport.script({ status: 429 });
        const result = await resolution.client!.complete({ messages: [{ role: 'user', content: 'hi' }] });
        if (!result.ok) expect(result.code).toBe(AI_ERROR_CODES.RATE_LIMITED);
    });

    it('degrades exactly once on 401 when the policy allows it, and NEVER on 429', async () => {
        const { ai, store, transport, events } = harness({ degradation: 'platform-on-auth-error' });
        store.seed([await encryptedCredential()]);

        const first = await ai.resolve(ai.contextFrom(CONTEXT), 'chat');
        transport.script({ status: 401 });
        await first.client!.complete({ messages: [{ role: 'user', content: 'hi' }] });
        expect(events.some((entry) => entry.event === 'call.degraded')).toBe(true);

        const second = await ai.resolve(ai.contextFrom(CONTEXT), 'chat');
        transport.reset();
        transport.script({ status: 429 });
        const before = events.filter((entry) => entry.event === 'call.degraded').length;
        await second.client!.complete({ messages: [{ role: 'user', content: 'hi' }] });
        // A tenant's rate limit must not become the operator's bill.
        expect(events.filter((entry) => entry.event === 'call.degraded')).toHaveLength(before);
    });

    it('surfaces an auth failure arriving INSIDE a 200 stream as a stream error, never a cascade', async () => {
        const { ai, store, transport, events } = harness({ degradation: 'platform-on-auth-error' });
        store.seed([await encryptedCredential()]);
        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'chat');
        transport.script({ inStreamError: { statusCode: 401, message: 'invalid api key' } });

        const seen: string[] = [];
        for await (const event of resolution.client!.stream({ messages: [{ role: 'user', content: 'hi' }] })) {
            seen.push(event.type);
        }
        expect(seen).toContain('error');
        expect(events.some((entry) => entry.event === 'call.degraded')).toBe(false);
    });

    it('BYOK-sourced calls default to response-cache OFF', async () => {
        const { ai, store, transport } = harness({
            tasks: [{ key: 'cached', responseCacheTtlSeconds: 600 }],
        });
        store.seed([await encryptedCredential()]);
        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'cached');
        await resolution.client!.complete({ messages: [{ role: 'user', content: 'hi' }] });
        expect(transport.calls[0]!.options.cacheTtlSeconds).toBeUndefined();
    });

    it('refuses the call when the quota hook says no, and emits the event', async () => {
        const { ai, store, events } = harness({ quota: () => false });
        store.seed([await encryptedCredential()]);
        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'chat');
        const result = await resolution.client!.complete({ messages: [{ role: 'user', content: 'hi' }] });
        expect(result.ok).toBe(false);
        expect(events.some((entry) => entry.event === 'quota.exceeded')).toBe(true);
    });
});

describe('secret hygiene on EVERY failure path', () => {
    it.each([[401], [403], [429], [500]])('status %i never echoes the tenant secret', async (status) => {
        const { ai, store, transport, events } = harness();
        const record = await encryptedCredential();
        store.seed([record]);
        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'chat');

        transport.script({ status });
        const result = await resolution.client!.complete({ messages: [{ role: 'user', content: 'hi' }] });

        const haystack = JSON.stringify({
            result,
            events,
            configs: transport.configs.map((c) => ({ ...c, secret: undefined })),
        });
        expect(haystack).not.toContain('sk-tenant-abcdefgh');
        expect(haystack).not.toContain('platform-key-0123456789');
    });

    it('a network throw never echoes the secret either', async () => {
        const { ai, store, transport } = harness();
        store.seed([await encryptedCredential()]);
        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'chat');
        transport.script({ throws: new Error('connect ECONNREFUSED with header Bearer sk-tenant-abcdefgh') });
        const result = await resolution.client!.complete({ messages: [{ role: 'user', content: 'hi' }] });
        expect(JSON.stringify(result)).not.toContain('sk-tenant-abcdefgh');
    });

    it('the merged transport config is NOT part of the resolution return shape', async () => {
        const { ai, store } = harness();
        store.seed([await encryptedCredential()]);
        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'chat');
        expect(resolution).not.toHaveProperty('config');
        expect(resolution.configSummary).toEqual({
            provider: 'openai',
            model: 'openai/gpt-4o-mini',
            transport: 'mock',
            tenantSecret: true,
        });
    });
});

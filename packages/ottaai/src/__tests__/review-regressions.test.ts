// ============================================================
// Regressions for defects found by adversarial review.
//
// Each test names the failure it prevents, because the whole point of these is
// that they all FAILED SILENTLY: wrong cost attribution, an inert dial, a lost
// metering event. None of them threw.
// ============================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encryptSecret } from '../crypto';
import { createProviderRegistry } from '../registry';
import { createAiProvisioning, verifyCredential, type AiProvisioning } from '../resolver';
import { resolveTaskDefaults } from '../tasks';
import { capabilitiesSatisfied, selectCredential } from '../pure';
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

const registry = createProviderRegistry();

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

interface Harness {
    ai: AiProvisioning<AiTenancyTuple>;
    store: MemoryStore;
    transport: MockTransport;
    events: Array<{ event: string; payload: Record<string, unknown> }>;
}

function harness(options: Record<string, unknown> = {}): Harness {
    const store = createMemoryStore();
    const transport = createMockTransport();
    const events: Array<{ event: string; payload: Record<string, unknown> }> = [];
    const ai = createAiProvisioning<AiTenancyTuple>({
        keyring: createTestKeyring(),
        store,
        transport,
        platform: PLATFORM,
        registry,
        tasks: [{ key: 'chat' }],
        contextFrom: (tuple: AiTenancyTuple) => tuple,
        verifyMembership: () => true,
        authorize: () => true,
        // Supplied so composition does not warn about unbounded platform spend in every
        // unrelated test — this PLATFORM config genuinely has a usable route. The warning
        // itself is covered explicitly in the `platformRouteUsable` suite, which overrides it.
        quota: () => true,
        eventSink: (event: string, payload: unknown) =>
            events.push({ event, payload: payload as Record<string, unknown> }),
        ...options,
    } as never) as AiProvisioning<AiTenancyTuple>;
    return { ai, store, transport, events };
}

beforeEach(() => resetFixtureCounter());

describe('verifyMembership is actually INVOKED, not just required at boot', () => {
    it('drops the org dimension when the host says the caller is not a member', async () => {
        // Requiring the callback and never calling it is worse than not requiring it: it
        // manufactures confidence that the org dimension of an RLS-BYPASSING lookup was
        // checked, when nothing checked it.
        const verifyMembership = vi.fn().mockResolvedValue(false);
        const { ai, store } = harness({ verifyMembership });

        store.seed([await encryptedCredential({ id: 'org-key', userId: null, organizationId: 'org-a' })]);

        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'chat');
        expect(verifyMembership).toHaveBeenCalledWith({ userId: 'user-1', organizationId: 'org-a' });
        // The org row must NOT be selected, so the call falls through to the platform.
        expect(resolution.source).toBe('platform');
        expect(resolution.credentialId).toBeNull();
    });

    it('still serves the caller their OWN key when the org check fails', async () => {
        const { ai, store } = harness({ verifyMembership: () => false });
        store.seed([
            await encryptedCredential({ id: 'mine', userId: 'user-1', organizationId: null }),
            await encryptedCredential({ id: 'theirs', userId: null, organizationId: 'org-a' }),
        ]);
        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'chat');
        expect(resolution.credentialId).toBe('mine');
    });

    it('resolves normally when the caller IS a member', async () => {
        const { ai, store } = harness({ verifyMembership: () => true });
        store.seed([await encryptedCredential({ id: 'org-key', userId: null, organizationId: 'org-a' })]);
        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'chat');
        expect(resolution.credentialId).toBe('org-key');
    });
});

describe('a per-call model override cannot reach an operator dynamic route', () => {
    it('throws rather than pointing the caller at the operator key and budget', async () => {
        const { ai } = harness();
        // The write path already refuses a tenant-supplied `dynamic/` ref; the per-call
        // override is a SECOND door into the same merge, and a handler that forwards a
        // request body would otherwise walk straight through it.
        await expect(ai.resolve(ai.contextFrom(CONTEXT), 'chat', { model: 'dynamic/premium' })).rejects.toThrow(
            /operator-only/,
        );
    });
});

describe('degradation', () => {
    it('a TASK-level policy is honoured even when the instance dial is the default', async () => {
        // Gating the fallback CLIENT on the instance dial while configuring the decorator
        // with the task dial makes the task-level policy silently inert.
        const { ai, store, transport, events } = harness({
            // instance `degradation` deliberately left at the default 'strict'
            tasks: [{ key: 'chat', degradation: 'platform-on-auth-error' }],
        });
        store.seed([await encryptedCredential()]);
        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'chat');
        transport.script({ status: 401 });

        await resolution.client!.complete({ messages: [{ role: 'user', content: 'hi' }] });
        expect(events.some((e) => e.event === 'call.degraded')).toBe(true);
    });

    it("attributes a degraded call to the PLATFORM provider and model, not the tenant's", async () => {
        const { ai, store, transport, events } = harness({
            degradation: 'platform-on-auth-error',
            platform: { ...PLATFORM, provider: 'openai', model: 'gpt-4o-mini' },
        });
        store.seed([await encryptedCredential({ provider: 'anthropic', model: 'claude-sonnet-4-5' })]);
        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'chat');
        transport.script({ status: 401 });
        await resolution.client!.complete({ messages: [{ role: 'user', content: 'hi' }] });

        const completed = events.filter((e) => e.event === 'call.completed').at(-1)!;
        // Reporting the tenant's Anthropic pair with `source: 'platform'` would bill the
        // operator's OpenAI spend to a provider and model that were never called.
        expect(completed.payload).toMatchObject({ source: 'platform', provider: 'openai' });
        expect(completed.payload.model).not.toContain('anthropic');
        expect(completed.payload.credentialId).toBeNull();
    });

    it('builds the fallback client from the FULL model chain, not just platform.model', async () => {
        const { ai, store, transport } = harness({
            degradation: 'platform-on-auth-error',
            // No platform.model — legal, since the boot coherence check needs both set.
            platform: { accountId: 'acct', gateway: 'gw', provider: 'openai', providerKey: 'k-0123456789' },
            tasks: [{ key: 'chat', defaultModel: 'gpt-4o-mini', degradation: 'platform-on-auth-error' }],
        });
        store.seed([await encryptedCredential()]);
        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'chat');
        transport.script({ status: 401 });
        await resolution.client!.complete({ messages: [{ role: 'user', content: 'hi' }] });

        // The fallback client's merged config must carry a model; without it the gateway
        // adapter omits `model` from the body entirely and the provider 400s — while a
        // tenant with NO key at all succeeds on the same task.
        const fallbackConfig = transport.configs.at(-1)!;
        expect(fallbackConfig.model).toBe('openai/gpt-4o-mini');
    });
});

describe('task-pinned eligibility filters unpinnable providers even with no required capabilities', () => {
    it('does not let an unpinnable provider shadow the credential that can serve the pin', () => {
        const task = resolveTaskDefaults({
            key: 'translate',
            modelPolicy: 'task-pinned',
            pinnedModels: { openai: 'gpt-4o-mini' },
            // deliberately NO requiredCapabilities — this is the case that slipped through
        });
        const context = { organizationId: 'org-a', userId: 'user-1', appId: 'app-1' };

        const anthropicUserKey = credentialFixture({ id: 'a', provider: 'anthropic', userId: 'user-1' });
        expect(capabilitiesSatisfied({ record: anthropicUserKey, context, registry, task, appScope: 'strict' })).toBe(
            false,
        );

        const result = selectCredential({
            candidates: [
                anthropicUserKey,
                credentialFixture({ id: 'b', provider: 'openai', userId: null, organizationId: 'org-a' }),
            ],
            context,
            strategy: 'user-then-org',
            appScope: 'strict',
            registry,
            task,
        });
        expect(result.winner?.id).toBe('b');
    });
});

describe('streaming instrumentation survives early termination', () => {
    it('still meters when the consumer breaks out of the loop', async () => {
        const { ai, store, events } = harness();
        store.seed([await encryptedCredential()]);
        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'chat');

        for await (const event of resolution.client!.stream({ messages: [{ role: 'user', content: 'hi' }] })) {
            if (event.type === 'delta') break; // user pressed Stop
        }

        // Without a `finally`, an async generator finalized early skips everything after
        // the loop: no call.completed, zero tokens metered for a call the tenant paid for.
        expect(events.some((e) => e.event === 'call.completed')).toBe(true);
    });

    it('classifies and redacts an adapter that throws mid-stream instead of letting it escape', async () => {
        const { ai, store, transport } = harness();
        store.seed([await encryptedCredential()]);
        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'chat');
        transport.script({ throws: new Error('socket hang up carrying sk-tenant-abcdefgh') });

        const seen: string[] = [];
        for await (const event of resolution.client!.stream({ messages: [{ role: 'user', content: 'hi' }] })) {
            seen.push(event.type);
            if (event.type === 'error') {
                expect(JSON.stringify(event)).not.toContain('sk-tenant-abcdefgh');
            }
        }
        expect(seen).toContain('error');
    });
});

describe('BYOK-sourced calls are never response-cached', () => {
    it('ignores a caller-supplied cacheTtlSeconds on the byok path', async () => {
        const { ai, store, transport } = harness();
        store.seed([await encryptedCredential()]);
        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'chat');

        await resolution.client!.complete({ messages: [{ role: 'user', content: 'hi' }], cacheTtlSeconds: 300 });
        // A completion cache keyed on prompt+model has no tenant dimension, so honouring
        // this would let tenant B be served a completion tenant A paid for.
        expect(transport.calls[0]!.options.cacheTtlSeconds).toBeUndefined();
    });

    it('still honours it on the platform path', async () => {
        const { ai, transport } = harness();
        const resolution = await ai.resolve(ai.contextFrom(CONTEXT), 'chat');
        await resolution.client!.complete({ messages: [{ role: 'user', content: 'hi' }], cacheTtlSeconds: 300 });
        expect(transport.calls[0]!.options.cacheTtlSeconds).toBe(300);
    });
});

describe('an UNBOUND credential is not a cross-app wildcard on the MANAGEMENT plane', () => {
    it('refuses to load an `appId: null` row from an app that has an id', async () => {
        const { ai, store } = harness();
        // Rows like this are reachable: generic auto-CRUD, a direct database write, or any
        // deployment that ran before an `appId` was configured.
        store.seed([await encryptedCredential({ id: 'unbound', userId: 'user-1', appId: null })]);

        const loaded = await ai.store.findByIdInScope(
            { organizationId: 'org-a', userId: 'user-1', appId: 'app-1' },
            'unbound',
        );
        // The old check was `row.appId && row.appId !== scope.appId`, so this returned the
        // row — and a manager in app B could then view, re-key or delete app A's credential.
        expect(loaded).toBeNull();
    });

    it('still loads an unbound row for a deployment that has no appId either', async () => {
        const { ai, store } = harness();
        store.seed([await encryptedCredential({ id: 'unbound', userId: 'user-1', appId: null })]);
        const loaded = await ai.store.findByIdInScope(
            { organizationId: null, userId: 'user-1', appId: null },
            'unbound',
        );
        expect(loaded?.id).toBe('unbound');
    });
});

describe('allowOrgCredentials is a SERVER dial, not a UI prop', () => {
    it('reports orgScopeManageable false when the operator turned org keys off', async () => {
        const { ai } = harness({ strategy: 'user-then-org', allowOrgCredentials: false });
        const status = await ai.status(ai.contextFrom(CONTEXT));
        // The settings component reads THIS field. Reading a second, independent copy of the
        // app config is how the client and the server end up disagreeing.
        expect(status.orgScopeManageable).toBe(false);
        expect(ai.orgCredentialsAllowed).toBe(false);
    });

    it('defaults to true', async () => {
        const { ai } = harness({ strategy: 'user-then-org' });
        expect((await ai.status(ai.contextFrom(CONTEXT))).orgScopeManageable).toBe(true);
    });

    it('is ANDed with the strategy — a strategy that cannot score an org row still closes it', async () => {
        const { ai } = harness({ strategy: 'user', allowOrgCredentials: true });
        expect((await ai.status(ai.contextFrom(CONTEXT))).orgScopeManageable).toBe(false);
    });
});

describe('the gate and the client come from ONE resolution', () => {
    it('resolveWithGate returns both without resolving twice', async () => {
        const { ai, store, events } = harness({ tasks: [{ key: 'chat', gate: 'required', mode: 'byok' }] });
        store.seed([await encryptedCredential()]);

        const { gate, resolution } = await ai.resolveWithGate(ai.contextFrom(CONTEXT), 'chat');
        expect(gate.allowed).toBe(true);
        expect(resolution.client).not.toBeNull();
        // `requireByok` then `resolve` emits `credential.resolved` TWICE — two candidate
        // fan-outs and two envelope decryptions per inference, on the hot path.
        expect(events.filter((e) => e.event === 'credential.resolved')).toHaveLength(1);
    });

    it('agrees with requireByok on the refusal', async () => {
        const { ai } = harness({ tasks: [{ key: 'chat', gate: 'required', mode: 'byok' }] });
        const viaGate = await ai.resolveWithGate(ai.contextFrom(CONTEXT), 'chat');
        const viaGuard = await ai.requireByok(ai.contextFrom(CONTEXT), 'chat');
        expect(viaGate.gate).toEqual(viaGuard);
        expect(viaGuard.allowed).toBe(false);
    });
});

describe('platformRouteUsable asks the TRANSPORT, not whether a provider key exists', () => {
    /** A transport whose completeness rule is the real one: destination fields, no key. */
    function destinationTransport() {
        const base = createMockTransport();
        return { ...base, isComplete: (config: { provider: string }) => Boolean(config.provider) };
    }

    it('is true for GATEWAY-BILLED inference, which has no provider key at all', async () => {
        // THE BLIND SPOT THIS CLOSES. A gateway holding the credential (a BYOK alias, unified
        // billing) still spends the OPERATOR'S money — but `platform.providerKey` is unset, so
        // every warning derived from "is a key configured?" stayed silent on exactly the
        // deployment that needed it. The runtime limiter was always correct (it keys on
        // `source`); this is about the operator finding out at boot.
        const summaries: Array<Record<string, unknown>> = [];
        harness({
            platform: { accountId: 'acct', gateway: 'gw', provider: 'openai', model: 'gpt-4o-mini' },
            transport: destinationTransport(),
            // Overridden to undefined so the "no quota hook" flag is what is under test.
            quota: undefined,
            onBoot: (summary: Record<string, unknown>) => summaries.push(summary),
        });

        const boot = summaries.at(-1)!;
        expect(boot.platformRouteUsable).toBe(true);
        expect(boot.platform).toMatchObject({ hasProviderKey: false });
        // …and with no quota hook, that is flagged as unbounded spend.
        expect(boot.platformSpendUnbounded).toBe(true);
    });

    it('is false when the platform path cannot serve a call', async () => {
        const summaries: Array<Record<string, unknown>> = [];
        harness({
            // No provider — nothing for the transport to route to.
            platform: { accountId: 'acct', gateway: 'gw' },
            transport: destinationTransport(),
            quota: undefined,
            onBoot: (summary: Record<string, unknown>) => summaries.push(summary),
        });

        const boot = summaries.at(-1)!;
        expect(boot.platformRouteUsable).toBe(false);
        // A BYOK-only deployment has nothing for an abuser to spend, so no warning.
        expect(boot.platformSpendUnbounded).toBeUndefined();
    });

    it('does not flag unbounded spend once a quota hook is supplied', async () => {
        const summaries: Array<Record<string, unknown>> = [];
        harness({
            transport: destinationTransport(),
            quota: () => true,
            onBoot: (summary: Record<string, unknown>) => summaries.push(summary),
        });

        expect(summaries.at(-1)!.platformRouteUsable).toBe(true);
        expect(summaries.at(-1)!.platformSpendUnbounded).toBeUndefined();
    });

    it('is exposed on the instance so a host need not re-derive it', () => {
        const { ai } = harness({ transport: destinationTransport() });
        expect(ai.platformRouteUsable).toBe(true);
    });
});

describe('the key-test endpoint enforces the same admission rules as the write path', () => {
    it('refuses a dynamic/<route> model — operator namespace, reached with the operator gateway token', async () => {
        const { ai } = harness();
        const result = await verifyCredential(ai as never, ai.contextFrom(CONTEXT), {
            kind: 'inline',
            provider: 'openai',
            model: 'dynamic/premium',
            secret: 'sk-whatever-1234567890',
        });
        expect(result.ok).toBe(false);
        expect(result.message).toMatch(/operator-only/);
    });

    it('refuses an unregistered provider instead of making the call', async () => {
        const { ai, transport } = harness();
        const result = await verifyCredential(ai as never, ai.contextFrom(CONTEXT), {
            kind: 'inline',
            provider: 'totally-made-up',
            secret: 'sk-whatever-1234567890',
        });
        expect(result.ok).toBe(false);
        expect(transport.calls).toHaveLength(0);
    });

    it('refuses a platform-only provider a tenant could never bring a key for', async () => {
        const { ai } = harness();
        const result = await verifyCredential(ai as never, ai.contextFrom(CONTEXT), {
            kind: 'inline',
            provider: 'workers-ai',
            secret: 'sk-whatever-1234567890',
        });
        expect(result.ok).toBe(false);
    });

    it('still tests a legitimate inline key', async () => {
        const { ai, transport } = harness();
        const result = await verifyCredential(ai as never, ai.contextFrom(CONTEXT), {
            kind: 'inline',
            provider: 'openai',
            model: 'gpt-4o-mini',
            secret: 'sk-whatever-1234567890',
        });
        expect(result.ok).toBe(true);
        expect(transport.calls).toHaveLength(1);
        // Never cached: a cached success happily "validates" a key revoked five minutes ago.
        expect(transport.calls[0]!.options.skipCache).toBe(true);
    });
});

describe('status picks the most informative task, not the first declared', () => {
    it('reports the tenant key even when a platform-only task is declared first', async () => {
        const { ai, store } = harness({
            tasks: [
                // A cheap internal task deliberately kept off tenant keys — declared FIRST.
                { key: 'internal', mode: 'platform' },
                { key: 'chat' },
            ],
        });
        store.seed([await encryptedCredential()]);

        const status = await ai.status(ai.contextFrom(CONTEXT));
        // Taking tasks[0] would tell a paying tenant their key is unused while their other
        // tasks are in fact running on it — and reordering the array would change the answer.
        expect(status.source).toBe('byok');
        expect(status.hasSecret).toBe(true);
        expect(status.credentialId).not.toBeNull();
    });
});

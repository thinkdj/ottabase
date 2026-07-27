// ============================================================
// THE TABLES IN THE DESIGN RECORD ARE THE TEST MATRIX.
// Every cell of the specificity score, every row of the org/user conflict and
// app-scope tables, the total order, and every row of the merge table.
// ============================================================

import { beforeEach, describe, expect, it } from 'vitest';
import { createProviderRegistry } from '../registry';
import { resolveTaskDefaults } from '../tasks';
import {
    appMatch,
    compareCandidates,
    dimensionMatch,
    evaluateEligibility,
    keylessMismatch,
    mergeConfig,
    selectCredential,
    specificityScore,
} from '../pure';
import type { AiStrategy, PlatformAiConfig } from '../types';
import { credentialFixture, resetFixtureCounter } from '../testing';

const registry = createProviderRegistry();
const task = resolveTaskDefaults({ key: 'test' });

beforeEach(() => resetFixtureCounter());

describe('org/user conflict table', () => {
    const rows: Array<[string | null, string | null, { conflict: boolean; match: boolean }]> = [
        [null, null, { conflict: false, match: false }],
        [null, 'X', { conflict: false, match: false }],
        ['X', null, { conflict: true, match: false }],
        ['X', 'X', { conflict: false, match: true }],
        ['X', 'Y', { conflict: true, match: false }],
    ];

    it.each(rows)('credential=%s context=%s', (credential, context, expected) => {
        expect(dimensionMatch(credential, context)).toEqual(expected);
    });

    it('a credential carrying BOTH dimensions is usable only by that exact (org, user) pair', () => {
        const record = credentialFixture({ organizationId: 'org-a', userId: 'user-1' });
        const inOrgB = evaluateEligibility({
            record,
            context: { organizationId: 'org-b', userId: 'user-1', appId: 'app-1' },
            registry,
            task,
            appScope: 'strict',
        });
        // It never degrades to "a user-only key" for a different org — silently spending it
        // in another workspace is a consent problem.
        expect(inOrgB.verdict).toBe('NOT_IN_SCOPE');
    });
});

describe('app-scope table', () => {
    const cases: Array<[string | null, string | null, boolean, boolean]> = [
        // credential.appId, context.appId, strict, wildcard
        [null, null, true, true],
        [null, 'X', false, true],
        ['X', null, false, false],
        ['X', 'X', true, true],
        ['X', 'Y', false, false],
    ];

    it.each(cases)('cred=%s ctx=%s → strict=%s wildcard=%s', (cred, ctx, strict, wildcard) => {
        expect(appMatch(cred, ctx, 'strict')).toBe(strict);
        expect(appMatch(cred, ctx, 'wildcard')).toBe(wildcard);
    });

    it('a bound row never leaks upward, even under wildcard', () => {
        expect(appMatch('app-1', null, 'wildcard')).toBe(false);
    });
});

describe('specificity score — all four strategies x all match classes', () => {
    const context = { organizationId: 'org-a', userId: 'user-1' };
    const classes = {
        'user and org': { organizationId: 'org-a', userId: 'user-1' },
        'user only': { organizationId: null, userId: 'user-1' },
        'org only': { organizationId: 'org-a', userId: null },
        neither: { organizationId: null, userId: null },
    } as const;

    const table: Record<keyof typeof classes, Record<AiStrategy, number>> = {
        'user and org': { user: 3, org: 3, 'user-then-org': 4, 'org-then-user': 4 },
        'user only': { user: 2, org: 0, 'user-then-org': 3, 'org-then-user': 2 },
        'org only': { user: 0, org: 2, 'user-then-org': 2, 'org-then-user': 3 },
        neither: { user: 0, org: 0, 'user-then-org': 0, 'org-then-user': 0 },
    };

    for (const [className, record] of Object.entries(classes)) {
        for (const strategy of ['user', 'org', 'user-then-org', 'org-then-user'] as AiStrategy[]) {
            it(`${className} under ${strategy}`, () => {
                expect(specificityScore(record, context, strategy)).toBe(
                    table[className as keyof typeof classes][strategy],
                );
            });
        }
    }

    it('an exact user+org match ranks highest under EVERY strategy, including `user`', () => {
        // `strategy: 'user'` means MUST MATCH THE USER, not MUST HAVE NO ORG.
        expect(specificityScore(classes['user and org'], context, 'user')).toBeGreaterThan(
            specificityScore(classes['user only'], context, 'user'),
        );
    });

    it('a row with neither dimension is permanently unselectable — there is no global credential', () => {
        for (const strategy of ['user', 'org', 'user-then-org', 'org-then-user'] as AiStrategy[]) {
            expect(specificityScore(classes.neither, context, strategy)).toBe(0);
        }
    });
});

describe('determinism — the ranking is a TOTAL order', () => {
    it('breaks a full tie on id ascending, not on query concatenation order', () => {
        const a = { record: credentialFixture({ id: 'bbb', updatedAt: 1000 }), score: 3 };
        const b = { record: credentialFixture({ id: 'aaa', updatedAt: 1000 }), score: 3 };
        expect([a, b].sort(compareCandidates)[0]!.record.id).toBe('aaa');
        expect([b, a].sort(compareCandidates)[0]!.record.id).toBe('aaa');
    });

    it('ranks isActive above updatedAt, and score above both', () => {
        const active = { record: credentialFixture({ id: 'z', isActive: true, updatedAt: 1 }), score: 2 };
        const newer = { record: credentialFixture({ id: 'a', isActive: false, updatedAt: 9999 }), score: 2 };
        expect([newer, active].sort(compareCandidates)[0]!.record.id).toBe('z');

        const higherScore = { record: credentialFixture({ id: 'q', isActive: false, updatedAt: 1 }), score: 4 };
        expect([active, higherScore].sort(compareCandidates)[0]!.record.id).toBe('q');
    });

    it('reads the tie-break timestamp defensively (Date or epoch number)', () => {
        const asDate = {
            record: credentialFixture({ id: 'a', updatedAt: new Date(5000) as unknown as number }),
            score: 2,
        };
        const asNumber = { record: credentialFixture({ id: 'b', updatedAt: 1000 }), score: 2 };
        expect([asNumber, asDate].sort(compareCandidates)[0]!.record.id).toBe('a');
    });
});

describe('verdicts and selection', () => {
    const context = { organizationId: 'org-a', userId: 'user-1', appId: 'app-1' };

    it('`enabled` is a HARD FILTER; absent counts as enabled', () => {
        const disabled = credentialFixture({ enabled: false });
        expect(evaluateEligibility({ record: disabled, context, registry, task, appScope: 'strict' }).verdict).toBe(
            'DISABLED',
        );
    });

    it('`isActive: false` still RANKS — a tenant whose only saved credential is inactive still has it used', () => {
        const result = selectCredential({
            candidates: [credentialFixture({ isActive: false })],
            context,
            strategy: 'user-then-org',
            appScope: 'strict',
            registry,
            task,
        });
        expect(result.winner).not.toBeNull();
    });

    it('an unregistered provider is INELIGIBLE', () => {
        const record = credentialFixture({ provider: 'not-a-real-provider' });
        expect(evaluateEligibility({ record, context, registry, task, appScope: 'strict' }).verdict).toBe(
            'PROVIDER_UNREGISTERED',
        );
    });

    it('de-dupes the two-query fan-out before ranking', () => {
        const both = credentialFixture({ organizationId: 'org-a', userId: 'user-1' });
        const result = selectCredential({
            candidates: [both, both],
            context,
            strategy: 'user-then-org',
            appScope: 'strict',
            registry,
            task,
        });
        expect(result.assessed).toHaveLength(1);
    });

    it('capability is an ELIGIBILITY FILTER, so a text-only user key cannot shadow a vision-capable org key', () => {
        const visionTask = resolveTaskDefaults({ key: 'vision', requiredCapabilities: ['vision'] });
        // Cohere's default capability set has no vision.
        const userTextOnly = credentialFixture({ id: 'a', provider: 'cohere', userId: 'user-1' });
        const orgVision = credentialFixture({
            id: 'b',
            provider: 'openai',
            model: 'gpt-4o',
            userId: null,
            organizationId: 'org-a',
        });

        const result = selectCredential({
            candidates: [userTextOnly, orgVision],
            context,
            strategy: 'user-then-org',
            appScope: 'strict',
            registry,
            task: visionTask,
        });
        expect(result.winner?.id).toBe('b');
    });

    it('an unknown free-text model fails CLOSED for a capability-constrained task', () => {
        const visionTask = resolveTaskDefaults({ key: 'vision', requiredCapabilities: ['vision'] });
        const record = credentialFixture({ provider: 'openai', model: 'some-unreleased-model' });
        expect(evaluateEligibility({ record, context, registry, task: visionTask, appScope: 'strict' }).verdict).toBe(
            'CAPABILITY_UNMET',
        );

        const permissive = resolveTaskDefaults({
            key: 'vision',
            requiredCapabilities: ['vision'],
            unknownModelPolicy: 'allow',
        });
        expect(evaluateEligibility({ record, context, registry, task: permissive, appScope: 'strict' }).verdict).toBe(
            'ELIGIBLE',
        );
    });

    it('aggregates stage-4a by the highest-precedence verdict PRESENT, not by "all"', () => {
        const result = selectCredential({
            candidates: [
                credentialFixture({ enabled: false }),
                credentialFixture({ provider: 'unknown-provider' }),
                credentialFixture({ appId: 'other-app' }),
            ],
            context,
            strategy: 'user-then-org',
            appScope: 'strict',
            registry,
            task,
        });
        expect(result.winner).toBeNull();
        expect(result.aggregatedReason).toBe('ALL_DISABLED');
    });

    it('reports NO_CREDENTIAL when there were no rows at all', () => {
        const result = selectCredential({
            candidates: [],
            context,
            strategy: 'user-then-org',
            appScope: 'strict',
            registry,
            task,
        });
        expect(result.aggregatedReason).toBe('NO_CREDENTIAL');
    });
});

describe('merge — the rows a naive implementation gets wrong', () => {
    const context = { organizationId: 'org-a', userId: 'user-1', appId: 'app-1' };
    const platform: PlatformAiConfig = {
        accountId: 'acct',
        gateway: 'gw',
        provider: 'openai',
        providerKey: 'platform-key-0123456789',
        model: 'gpt-4o-mini',
    };

    it('an inline tenant secret REPLACES the platform key and deletes any inherited alias', () => {
        const merged = mergeConfig({
            platform,
            registry,
            credential: credentialFixture({ secret: { kind: 'inline', ciphertext: 'x' } }),
            tenantSecret: new (class {
                expose() {
                    return 'tenant-key';
                }
            })() as never,
            model: 'gpt-4o',
            taskKey: 't',
            context,
        });
        expect(merged.alias).toBeNull();
        expect(merged.secret).not.toBeNull();
    });

    it('an alias-only credential deletes the inherited PROVIDER KEY — never two auth mechanisms at once', () => {
        const merged = mergeConfig({
            platform,
            registry,
            credential: credentialFixture({ secret: { kind: 'alias', alias: 'org-openai' } }),
            tenantSecret: null,
            model: null,
            taskKey: 't',
            context,
        });
        expect(merged.alias).toBe('org-openai');
        expect(merged.secret).toBeNull();
    });

    it('a KEYLESS credential does not inherit the platform key — otherwise byok is funded by the operator', () => {
        const merged = mergeConfig({
            platform,
            registry,
            credential: credentialFixture({ provider: 'workers-ai', secret: { kind: 'none' } }),
            tenantSecret: null,
            model: '@cf/meta/llama-3.1-8b-instruct',
            taskKey: 't',
            context,
        });
        expect(merged.secret).toBeNull();
        expect(merged.alias).toBeNull();
        expect(merged.provenance.source).toBe('byok');
    });

    it('everything else inherits, including the injected fetch', () => {
        const injected = (async () => new Response('{}')) as unknown as typeof fetch;
        const merged = mergeConfig({
            platform: { ...platform, fetch: injected },
            registry,
            credential: credentialFixture(),
            tenantSecret: null,
            model: null,
            taskKey: 't',
            context,
        });
        expect(merged.fetch).toBe(injected);
        expect(merged.accountId).toBe('acct');
        expect(merged.gateway).toBe('gw');
    });

    it('strips tenant-supplied destination keys from the transport bag', () => {
        const merged = mergeConfig({
            platform,
            registry,
            credential: credentialFixture({
                transportConfig: { baseUrl: 'https://attacker.example', temperature: 0.2 },
            }),
            tenantSecret: null,
            model: null,
            taskKey: 't',
            context,
        });
        expect(merged.transportConfig.baseUrl).toBeUndefined();
        expect(merged.transportConfig.temperature).toBe(0.2);
    });

    it('injects provenance so every call from the client carries the tag automatically', () => {
        const merged = mergeConfig({
            platform,
            registry,
            credential: credentialFixture({ id: 'cred-x' }),
            tenantSecret: null,
            model: null,
            taskKey: 'bill-parser',
            context,
        });
        expect(merged.provenance).toMatchObject({
            source: 'byok',
            credentialId: 'cred-x',
            taskKey: 'bill-parser',
            organizationId: 'org-a',
            userId: 'user-1',
        });
    });
});

describe('the keyless-mismatch guard — all three terms', () => {
    const platformWithKey: PlatformAiConfig = { provider: 'openai', providerKey: 'platform-key' };
    const gatewayBilled: PlatformAiConfig = { provider: 'openai' };

    it('fires when a key IS required, the credential is keyless, and a usable platform key exists', () => {
        expect(
            keylessMismatch({
                credential: credentialFixture({ provider: 'openai', secret: { kind: 'none' } }),
                registry,
                platform: platformWithKey,
                mayUsePlatformKey: true,
                dynamicModel: false,
            }),
        ).toBe(true);
    });

    it('TERM 2 — an alias COUNTS as a secret', () => {
        expect(
            keylessMismatch({
                credential: credentialFixture({ provider: 'openai', secret: { kind: 'alias', alias: 'a' } }),
                registry,
                platform: platformWithKey,
                mayUsePlatformKey: true,
                dynamicModel: false,
            }),
        ).toBe(false);
    });

    it('TERM 3 — gateway-billed deployments have NO platform key, and a keyless credential is valid BYOK', () => {
        // Deleting term 3 breaks this entire deployment class.
        expect(
            keylessMismatch({
                credential: credentialFixture({ provider: 'openai', secret: { kind: 'none' } }),
                registry,
                platform: gatewayBilled,
                mayUsePlatformKey: true,
                dynamicModel: false,
            }),
        ).toBe(false);
    });

    it('TERM 3 — under `byok` the platform key exists but may not be used, so the guard does NOT fire', () => {
        expect(
            keylessMismatch({
                credential: credentialFixture({ provider: 'openai', secret: { kind: 'none' } }),
                registry,
                platform: platformWithKey,
                mayUsePlatformKey: false,
                dynamicModel: false,
            }),
        ).toBe(false);
    });

    it('TERM 1 — a keyless FREE provider does not trip the guard', () => {
        expect(
            keylessMismatch({
                credential: credentialFixture({ provider: 'workers-ai', secret: { kind: 'none' } }),
                registry,
                platform: platformWithKey,
                mayUsePlatformKey: true,
                dynamicModel: false,
            }),
        ).toBe(false);
    });

    it('TERM 1 — a dynamic model ref counts as requiring a key regardless of provider', () => {
        expect(
            keylessMismatch({
                credential: credentialFixture({ provider: 'workers-ai', secret: { kind: 'none' } }),
                registry,
                platform: platformWithKey,
                mayUsePlatformKey: true,
                dynamicModel: true,
            }),
        ).toBe(true);
    });
});

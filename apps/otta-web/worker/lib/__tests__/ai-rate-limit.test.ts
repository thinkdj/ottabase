// ============================================================
// Inference rate limiting — the burst guard on platform spend.
//
// The behaviour worth protecting here is the ASYMMETRY: a missing or broken
// limiter must refuse PLATFORM-paid inference (the operator's money) while
// letting BYOK through (the tenant's own money, their provider's own limits).
// Get that backwards in either direction and you either brick a paying tenant or
// hand out unlimited spend on the operator's card.
// ============================================================

import { describe, expect, it, vi } from 'vitest';
import { createAiRateLimiter, platformSpendWarning } from '../ai-rate-limit';

const LIMITS = { perUser: 3, perOrganization: 5, perApp: 10 };

/** An in-memory stand-in for KV, with the same get/put surface. */
function memoryStore() {
    const map = new Map<string, string>();
    return {
        map,
        async get(key: string) {
            return map.get(key) ?? null;
        },
        async put(key: string, value: string) {
            map.set(key, value);
        },
    };
}

function limiter(overrides: Partial<Parameters<typeof createAiRateLimiter>[0]> = {}) {
    return createAiRateLimiter({
        store: memoryStore(),
        appId: 'app-1',
        limits: LIMITS,
        // Frozen clock so the fixed window never rolls mid-test.
        now: () => 1_700_000_000_000,
        onWarning: () => {},
        ...overrides,
    });
}

/** Current value of one bucket, for asserting what a rejected call did or did not charge. */
function bucketCount(store: ReturnType<typeof memoryStore>, dimension: string, id: string): number {
    const entry = [...store.map.entries()].find(([key]) => key.includes(`:${dimension}:${id}:`));
    return entry ? Number(entry[1]) : 0;
}

const CALL = { source: 'platform' as const, taskKey: 'assist', organizationId: null, userId: 'user-1' };

describe('every dimension is consumed, and all must pass', () => {
    it('refuses once the PER-USER limit is reached', async () => {
        const take = limiter();
        for (let i = 0; i < LIMITS.perUser; i++) {
            expect(await take(CALL)).toBe(true);
        }
        expect(await take(CALL)).toBe(false);
    });

    it('refuses on the ORG ceiling even when each user is individually under theirs', async () => {
        // The dimension that stops a workspace fanning the same abuse across seats.
        const take = limiter();
        const call = (userId: string) => take({ ...CALL, userId, organizationId: 'org-a' });

        // 5 calls spread over 5 distinct users: nobody hits perUser (3), but perOrg (5) fills.
        for (let i = 0; i < LIMITS.perOrganization; i++) {
            expect(await call(`user-${i}`)).toBe(true);
        }
        expect(await call('user-fresh')).toBe(false);
    });

    it('refuses on the APP ceiling regardless of how many accounts participate', async () => {
        // The operator's blast radius: the most that can be billed in one window.
        const take = limiter();
        for (let i = 0; i < LIMITS.perApp; i++) {
            expect(await take({ ...CALL, userId: `user-${i}` })).toBe(true);
        }
        expect(await take({ ...CALL, userId: 'user-last' })).toBe(false);
    });

    it('skips the org dimension when the caller has no active organization', async () => {
        const store = memoryStore();
        const take = limiter({ store });
        await take({ ...CALL, organizationId: null });
        expect([...store.map.keys()].some((key) => key.includes(':org:'))).toBe(false);
    });

    it('isolates buckets per app, so two apps sharing a KV namespace do not share limits', async () => {
        const store = memoryStore();
        const appA = limiter({ store, appId: 'app-a' });
        const appB = limiter({ store, appId: 'app-b' });

        for (let i = 0; i < LIMITS.perUser; i++) await appA(CALL);
        expect(await appA(CALL)).toBe(false);
        // Same user id, different app — untouched budget.
        expect(await appB(CALL)).toBe(true);
    });

    it('treats a limit of 0 as "dimension disabled", not "block everything"', async () => {
        // BYOK, because a PLATFORM call with a non-positive `perApp` is refused outright —
        // see the dedicated suite below. Disabling a dimension must not mean "deny".
        const take = limiter({ limits: { perUser: 0, perOrganization: 0, perApp: 0 } });
        for (let i = 0; i < 50; i++) expect(await take({ ...CALL, source: 'byok' })).toBe(true);
    });

    it('rolls the window forward', async () => {
        const store = memoryStore();
        let clock = 1_700_000_000_000;
        const take = limiter({ store, now: () => clock });

        for (let i = 0; i < LIMITS.perUser; i++) await take(CALL);
        expect(await take(CALL)).toBe(false);

        clock += 61_000; // next fixed window
        expect(await take(CALL)).toBe(true);
    });
});

describe('a rejected call charges NOTHING — the app budget cannot be poisoned', () => {
    it('does not consume the app bucket when the call is rejected on the USER dimension', async () => {
        // THE DENIAL-OF-SERVICE THIS CLOSES. The old order incremented `app` and only then
        // checked `user`, so once a user hit their own limit, every further rejected call —
        // free to them, zero provider tokens — still drained the app-wide budget. With
        // perUser=20 and perApp=600 that is 580 rejected calls to deny AI to everyone else
        // for the rest of the minute.
        const store = memoryStore();
        const take = limiter({ store });

        for (let i = 0; i < LIMITS.perUser; i++) expect(await take(CALL)).toBe(true);
        expect(bucketCount(store, 'app', 'app-1')).toBe(LIMITS.perUser);

        // Hammer well past the user limit.
        for (let i = 0; i < 50; i++) expect(await take(CALL)).toBe(false);

        // The app bucket is untouched by all of it.
        expect(bucketCount(store, 'app', 'app-1')).toBe(LIMITS.perUser);
    });

    it('leaves OTHER users unaffected after one user hammers past their limit', async () => {
        // The observable consequence of the bug: a second account must still be served.
        const store = memoryStore();
        const take = limiter({ store });

        for (let i = 0; i < LIMITS.perUser + 50; i++) await take({ ...CALL, userId: 'noisy' });

        expect(await take({ ...CALL, userId: 'quiet' })).toBe(true);
    });

    it('does not consume the app bucket when the call is rejected on the ORG dimension', async () => {
        // Reordering to user → org → app would NOT have fixed this case: a caller under their
        // own limit but over their org's still poisons the wider bucket. Only preflighting
        // every dimension before charging any of them closes both.
        const store = memoryStore();
        const take = limiter({ store });
        const inOrg = (userId: string) => take({ ...CALL, userId, organizationId: 'org-a' });

        for (let i = 0; i < LIMITS.perOrganization; i++) expect(await inOrg(`user-${i}`)).toBe(true);
        const appAfterFill = bucketCount(store, 'app', 'app-1');

        // A fresh user: under perUser (3), but the org bucket (5) is full.
        expect(await inOrg('user-fresh')).toBe(false);
        expect(bucketCount(store, 'app', 'app-1')).toBe(appAfterFill);
        // …and their own user bucket was not charged either.
        expect(bucketCount(store, 'user', 'user-fresh')).toBe(0);
    });

    it('charges every dimension when the call is allowed', async () => {
        const store = memoryStore();
        const take = limiter({ store });

        expect(await take({ ...CALL, organizationId: 'org-a' })).toBe(true);

        expect(bucketCount(store, 'app', 'app-1')).toBe(1);
        expect(bucketCount(store, 'user', 'user-1')).toBe(1);
        expect(bucketCount(store, 'org', 'org-a')).toBe(1);
    });
});

describe('a non-positive perApp cannot silently uncap platform spend', () => {
    it('refuses platform-paid inference when perApp is 0', async () => {
        // `perApp` is the ONLY aggregate limit, so treating 0 as "dimension disabled" would
        // restore exactly the unlimited operator spend this module exists to prevent.
        const warn = vi.fn();
        const take = limiter({ limits: { ...LIMITS, perApp: 0 }, onWarning: warn });

        expect(await take({ ...CALL, source: 'platform' })).toBe(false);
        expect(warn).toHaveBeenCalledWith(expect.stringMatching(/perApp/));
    });

    it('refuses platform-paid inference when perApp is negative', async () => {
        // Reachable through the env-override path, where a negative used to survive
        // `parseInt` and then read downstream as "disabled".
        const take = limiter({ limits: { ...LIMITS, perApp: -1 } });
        expect(await take({ ...CALL, source: 'platform' })).toBe(false);
    });

    it('still allows BYOK when perApp is 0 — the tenant is spending their own money', async () => {
        const take = limiter({ limits: { ...LIMITS, perApp: 0 } });
        expect(await take({ ...CALL, source: 'byok' })).toBe(true);
    });

    it('leaves perUser and perOrganization genuinely optional', async () => {
        // Only the aggregate ceiling is mandatory; the per-actor dimensions may be disabled.
        const take = limiter({ limits: { perUser: 0, perOrganization: 0, perApp: 2 } });

        expect(await take({ ...CALL, source: 'platform' })).toBe(true);
        expect(await take({ ...CALL, source: 'platform' })).toBe(true);
        // …but the app ceiling still bites.
        expect(await take({ ...CALL, source: 'platform' })).toBe(false);
    });
});

describe('an unavailable limiter fails CLOSED for platform spend and OPEN for BYOK', () => {
    it('refuses platform-paid inference when there is no store', async () => {
        const warn = vi.fn();
        const take = limiter({ store: null, onWarning: warn });

        expect(await take({ ...CALL, source: 'platform' })).toBe(false);
        // Silent refusal would be its own incident — an operator must be able to find this.
        expect(warn).toHaveBeenCalledWith(expect.stringMatching(/OBCF_KV/));
    });

    it('allows BYOK inference when there is no store', async () => {
        // The tenant is spending their own money against their own provider's limits, so a
        // missing binding is an operator inconvenience — not a reason to brick a paid feature.
        const warn = vi.fn();
        const take = limiter({ store: null, onWarning: warn });

        expect(await take({ ...CALL, source: 'byok' })).toBe(true);
        expect(warn).toHaveBeenCalled();
    });

    it('treats a storage READ failure the same as a missing store', async () => {
        // Otherwise a KV outage becomes the cheapest route to unlimited platform inference.
        const broken = {
            get: async () => {
                throw new Error('KV down');
            },
            put: async () => {},
        };
        const take = limiter({ store: broken, onWarning: () => {} });

        expect(await take({ ...CALL, source: 'platform' })).toBe(false);
        expect(await take({ ...CALL, source: 'byok' })).toBe(true);
    });

    it('treats a storage WRITE failure the same', async () => {
        const broken = {
            get: async () => '0',
            put: async () => {
                throw new Error('KV down');
            },
        };
        const take = limiter({ store: broken, onWarning: () => {} });

        expect(await take({ ...CALL, source: 'platform' })).toBe(false);
        expect(await take({ ...CALL, source: 'byok' })).toBe(true);
    });
});

describe('the operator-facing warning', () => {
    const bound = { OBCF_KV: {} } as never;
    const unbound = { OBCF_KV: undefined } as never;

    it('fires only when a platform route is USABLE and unprotected', () => {
        expect(platformSpendWarning(unbound, true, LIMITS)).toMatch(/REFUSED/);
        // A BYOK-only deployment has nothing for an abuser to spend.
        expect(platformSpendWarning(unbound, false, LIMITS)).toBeNull();
        // Protected.
        expect(platformSpendWarning(bound, true, LIMITS)).toBeNull();
    });

    it('keys on route usability, NOT on a provider key being present', () => {
        // The blind spot this closes: gateway-billed inference (a gateway holding the
        // credential — a BYOK alias, unified billing) has NO provider key but still spends the
        // operator's money. A key-based predicate stayed silent on exactly that deployment.
        // The caller passes the package's `platformRouteUsable`, which asks the transport.
        expect(platformSpendWarning(unbound, true, LIMITS)).toMatch(/usable platform AI route/);
    });

    it('names the non-positive perApp case too, so the boot log matches what callers hit', () => {
        // A warning that only covered the missing-binding case would leave an operator
        // debugging a refusal the boot log said nothing about.
        expect(platformSpendWarning(bound, true, { ...LIMITS, perApp: 0 })).toMatch(/perApp/);
        expect(platformSpendWarning(bound, true, { ...LIMITS, perApp: -5 })).toMatch(/perApp/);
        // perUser / perOrganization are optional — no warning for those.
        expect(platformSpendWarning(bound, true, { perUser: 0, perOrganization: 0, perApp: 600 })).toBeNull();
    });

    it('stays silent for a BYOK-only deployment, whatever the limits are', () => {
        expect(platformSpendWarning(unbound, false, { perUser: 0, perOrganization: 0, perApp: 0 })).toBeNull();
    });
});

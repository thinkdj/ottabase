/**
 * Tests for the security-context membership cache in auth-utils:
 * - read-through caching of org/group membership lookups (60s KV TTL)
 * - fail-safe fallback: KV failures must fall back to D1, never weaken
 *   membership resolution to `undefined`
 * - org validation still uses the (possibly cached) membership list
 * - invalidateMembershipCache drops both key families
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const organizationIdsForUser = vi.fn<(...args: any[]) => Promise<string[]>>();
const groupIdsForUser = vi.fn<(...args: any[]) => Promise<string[]>>();

vi.mock('@ottabase/ottaorm/models', () => ({
    Account: { forUser: vi.fn() },
    OrganizationMember: {
        organizationIdsForUser: (...args: any[]) => organizationIdsForUser(...args),
        activatePendingInvites: vi.fn(),
    },
    UserGroup: {
        groupIdsForUser: (...args: any[]) => groupIdsForUser(...args),
    },
    UserGroupMember: { activatePendingInvites: vi.fn() },
    VerificationToken: { create: vi.fn() },
}));
vi.mock('@ottabase/ottaorm', () => ({ registerConnection: vi.fn() }));
vi.mock('@ottabase/db/drizzle-d1', () => ({ createD1Driver: vi.fn() }));
vi.mock('../../../ottabase/config.loader', () => ({
    getOttabaseConfig: vi.fn(() => ({ appId: 'test-app' })),
}));
vi.mock('../email-provider', () => ({ resolveAppMailer: vi.fn() }));

import { getSecurityContext, invalidateMembershipCache } from '../auth-utils';

/** Minimal KV fake backed by a Map, with list() for prefix invalidation. */
function makeKv() {
    const store = new Map<string, string>();
    return {
        store,
        get: vi.fn(async (key: string) => store.get(key) ?? null),
        put: vi.fn(async (key: string, value: string) => {
            store.set(key, value);
        }),
        delete: vi.fn(async (key: string) => {
            store.delete(key);
        }),
        list: vi.fn(async ({ prefix }: { prefix?: string }) => ({
            keys: [...store.keys()].filter((k) => !prefix || k.startsWith(prefix)).map((name) => ({ name })),
            list_complete: true,
        })),
    };
}

function makeRequest(orgId?: string) {
    return new Request('http://localhost/api/test', {
        headers: orgId ? { 'x-org-id': orgId } : {},
    });
}

const session = { user: { id: 'user-1' } };

beforeEach(() => {
    organizationIdsForUser.mockReset().mockResolvedValue(['org-a']);
    groupIdsForUser.mockReset().mockResolvedValue(['group-1']);
});

describe('getSecurityContext — membership caching', () => {
    it('caches org + group lookups in KV (fetcher called once across requests)', async () => {
        const kv = makeKv();
        const env = { OBCF_KV: kv } as any;

        const first = await getSecurityContext(makeRequest('org-a'), session, env);
        expect(first.memberOrganizationIds).toEqual(['org-a']);
        expect(first.organizationId).toBe('org-a');
        expect(first.memberGroupIds).toEqual(['group-1']);
        expect(kv.store.has('auth:usr:user-1:member-orgs')).toBe(true);
        expect(kv.store.has('auth:usr:user-1:member-groups:org-a')).toBe(true);

        const second = await getSecurityContext(makeRequest('org-a'), session, env);
        expect(second.memberOrganizationIds).toEqual(['org-a']);
        expect(organizationIdsForUser).toHaveBeenCalledTimes(1); // cache hit — no second D1 fetch
        expect(groupIdsForUser).toHaveBeenCalledTimes(1);
    });

    it('falls back to direct D1 lookup when KV fails (never weakens to undefined)', async () => {
        const kv = makeKv();
        kv.get.mockRejectedValue(new Error('KV outage'));
        const env = { OBCF_KV: kv } as any;

        const ctx = await getSecurityContext(makeRequest('org-a'), session, env);
        expect(ctx.memberOrganizationIds).toEqual(['org-a']); // NOT undefined
        expect(ctx.organizationId).toBe('org-a');
        expect(organizationIdsForUser).toHaveBeenCalled();
    });

    it('keeps "membership unknown" semantics when the D1 lookup itself fails', async () => {
        organizationIdsForUser.mockRejectedValue(new Error('no such table'));
        groupIdsForUser.mockRejectedValue(new Error('no such table'));
        const env = { OBCF_KV: makeKv() } as any;

        const ctx = await getSecurityContext(makeRequest('org-a'), session, env);
        expect(ctx.memberOrganizationIds).toBeUndefined();
        expect(ctx.memberGroupIds).toBeUndefined();
    });

    it('nulls a caller-supplied org the (cached) membership list does not contain', async () => {
        const env = { OBCF_KV: makeKv() } as any;

        const ctx = await getSecurityContext(makeRequest('org-OTHER'), session, env);
        expect(ctx.organizationId).toBeNull(); // fails closed against header spoofing
        // Group lookup is keyed by the VALIDATED org (null → 'none' segment).
        expect(groupIdsForUser).toHaveBeenCalledWith('user-1', undefined);
    });

    it('works without KV (direct lookups every time)', async () => {
        const ctx = await getSecurityContext(makeRequest('org-a'), session, { OBCF_KV: undefined } as any);
        expect(ctx.memberOrganizationIds).toEqual(['org-a']);
        expect(organizationIdsForUser).toHaveBeenCalledTimes(1);
    });
});

describe('invalidateMembershipCache', () => {
    it('drops the member-orgs key and all member-groups keys', async () => {
        const kv = makeKv();
        const env = { OBCF_KV: kv } as any;

        await getSecurityContext(makeRequest('org-a'), session, env);
        expect(kv.store.size).toBeGreaterThanOrEqual(2);

        await invalidateMembershipCache(env.OBCF_KV, 'user-1');
        expect(kv.store.has('auth:usr:user-1:member-orgs')).toBe(false);
        expect([...kv.store.keys()].some((k) => k.startsWith('auth:usr:user-1:member-groups'))).toBe(false);

        // Next request re-fetches fresh membership from D1.
        organizationIdsForUser.mockResolvedValue(['org-a', 'org-new']);
        const ctx = await getSecurityContext(makeRequest('org-a'), session, env);
        expect(ctx.memberOrganizationIds).toEqual(['org-a', 'org-new']);
    });

    it('is a no-op without KV or userId', async () => {
        await expect(invalidateMembershipCache(undefined, 'user-1')).resolves.toBeUndefined();
        await expect(invalidateMembershipCache(makeKv() as any, undefined)).resolves.toBeUndefined();
    });
});

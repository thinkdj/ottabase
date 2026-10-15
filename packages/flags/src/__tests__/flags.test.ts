import { describe, expect, it, vi } from 'vitest';
import { createFlags, createMemoryOverrideStore, UNLIMITED, type Subject } from '../index';

type Env = { tag: string };
const env: Env = { tag: 'test' };
const org: Subject = { appId: 'app', organizationId: 'org-1', userId: 'u-1' };

const plans = {
    free: { limits: { projects: 3 } },
    pro: { features: ['export'], limits: { projects: UNLIMITED } },
};

describe('createFlags', () => {
    it('refuses a default plan that is not declared', () => {
        expect(() => createFlags({ plans, defaultPlan: 'gold' })).toThrow(/defaultPlan "gold"/);
    });

    it('resolves plan + overrides for a subject and caches per subject until invalidated', async () => {
        let clock = 1_000;
        const resolvePlan = vi.fn(async () => 'pro');
        const store = createMemoryOverrideStore<Env>([
            { id: 'o1', appId: 'app', organizationId: 'org-1', scope: 'organization', key: 'limit:projects', value: 9 },
        ]);
        const list = vi.spyOn(store, 'list');
        const flags = createFlags<Env>({ plans, defaultPlan: 'free', resolvePlan, overrides: store, now: () => clock });

        const first = await flags.resolve(env, org);
        expect(first.plan).toBe('pro');
        expect(first.limits.projects).toBe(9);
        expect(first.applied).toEqual([{ id: 'o1', scope: 'organization', key: 'limit:projects' }]);

        await flags.resolve(env, org);
        expect(resolvePlan).toHaveBeenCalledTimes(1);
        expect(list).toHaveBeenCalledTimes(1);

        await flags.resolve(env, { ...org, userId: 'u-2' });
        expect(resolvePlan).toHaveBeenCalledTimes(2);

        flags.invalidate(org);
        await flags.resolve(env, org);
        expect(resolvePlan).toHaveBeenCalledTimes(3);

        clock += 60_000;
        await flags.resolve(env, org);
        expect(resolvePlan).toHaveBeenCalledTimes(4);
    });

    it('answers gates and turns a closed one into a 402 with what the UI needs', async () => {
        const flags = createFlags<Env>({
            plans,
            defaultPlan: 'free',
            overrides: createMemoryOverrideStore(),
            upgradeHref: '/billing',
            cacheTtlMs: 0,
        });

        expect(await flags.requireFeature(env, org, 'export')).toBeInstanceOf(Response);
        const denied = (await flags.requireLimit(env, org, 'projects', 3))!;
        expect(denied.status).toBe(402);
        const body = (await denied.json()) as { code: string; metadata: Record<string, unknown> };
        expect(body.code).toBe('UPGRADE_REQUIRED');
        expect(body.metadata).toMatchObject({
            plan: 'free',
            reason: 'LIMIT_REACHED',
            limitKey: 'projects',
            limit: 3,
            upgradeHref: '/billing',
        });

        expect(await flags.requireLimit(env, org, 'projects', 2)).toBeNull();
    });

    it('an anonymous subject is a 401, never a plan', async () => {
        const flags = createFlags<Env>({
            plans,
            defaultPlan: 'free',
            overrides: createMemoryOverrideStore(),
            cacheTtlMs: 0,
        });
        const anonymous: Subject = { appId: 'app', organizationId: null, userId: null };
        expect(await flags.feature(env, anonymous, 'export')).toMatchObject({ allowed: false, reason: 'NO_SUBJECT' });
        expect((await flags.requireFeature(env, anonymous, 'export'))?.status).toBe(401);
    });

    it("a personal scope reads app-wide and its own overrides, never an organization's", async () => {
        const store = createMemoryOverrideStore<Env>([
            { id: 'app', appId: 'app', scope: 'app', key: 'feature:beta', value: true },
            {
                id: 'org',
                appId: 'app',
                organizationId: 'org-1',
                scope: 'organization',
                key: 'feature:export',
                value: true,
            },
            {
                id: 'me',
                appId: 'app',
                organizationId: null,
                userId: 'u-9',
                scope: 'user',
                key: 'limit:projects',
                value: 1,
            },
        ]);
        const flags = createFlags<Env>({ plans, defaultPlan: 'free', overrides: store, cacheTtlMs: 0 });
        const personal = await flags.resolve(env, { appId: 'app', organizationId: null, userId: 'u-9' });
        expect(personal.features).toEqual(['beta']);
        expect(personal.limits.projects).toBe(1);
    });
});

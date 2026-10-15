import { describe, expect, it } from 'vitest';
import {
    checkFeature,
    checkLimit,
    computeEntitlements,
    pickPlan,
    UNLIMITED,
    type Override,
    type PlanDefinition,
} from '../index';

const plans: Record<string, PlanDefinition> = {
    free: { label: 'Free', limits: { projects: 3 } },
    pro: { label: 'Pro', features: ['export', 'api'], limits: { projects: 50 } },
    team: { label: 'Team', features: ['export', 'api', 'sso'], limits: { projects: UNLIMITED, seats: 10 } },
};
const NOW = 1_700_000_000_000;
const override = (partial: Partial<Override> & Pick<Override, 'key' | 'value'>): Override => ({
    id: partial.id ?? `o-${partial.key}`,
    scope: partial.scope ?? 'organization',
    expiresAt: partial.expiresAt ?? null,
    ...partial,
});

describe('pickPlan', () => {
    it('takes the highest-ranked held plan, ignores unknown keys, and floors at the default', () => {
        expect(pickPlan(plans, 'free', null)).toBe('free');
        expect(pickPlan(plans, 'free', 'pro')).toBe('pro');
        expect(pickPlan(plans, 'free', ['pro', 'team'])).toBe('team');
        expect(pickPlan(plans, 'pro', ['free'])).toBe('pro');
        expect(pickPlan(plans, 'free', ['enterprise'])).toBe('free');
    });

    it('honours an explicit rank over declaration order', () => {
        const ranked = { a: { rank: 10 }, b: { rank: 1 } };
        expect(pickPlan(ranked, 'b', ['a', 'b'])).toBe('a');
    });
});

describe('computeEntitlements', () => {
    it('starts from the plan and lists nothing applied', () => {
        const result = computeEntitlements({ plans, defaultPlan: 'free', held: 'pro', overrides: [], now: NOW });
        expect(result).toEqual({
            plan: 'pro',
            label: 'Pro',
            features: ['api', 'export'],
            limits: { projects: 50 },
            applied: [],
        });
    });

    it('applies overrides narrowest-last: app, then organization, then user', () => {
        const overrides = [
            override({ id: 'u', scope: 'user', key: 'limit:projects', value: 7 }),
            override({ id: 'a', scope: 'app', key: 'limit:projects', value: 5 }),
            override({ id: 'o', scope: 'organization', key: 'limit:projects', value: 6 }),
            override({ id: 'f', scope: 'organization', key: 'feature:sso', value: true }),
            override({ id: 'k', scope: 'user', key: 'feature:export', value: false }),
        ];
        const result = computeEntitlements({ plans, defaultPlan: 'free', held: 'pro', overrides, now: NOW });
        expect(result.limits.projects).toBe(7);
        expect(result.features).toEqual(['api', 'sso']);
        expect(result.applied.map((entry) => entry.id)).toEqual(['a', 'o', 'f', 'u', 'k']);
    });

    it('a plan override changes the base plan before features and limits apply', () => {
        const overrides = [override({ id: 'p', key: 'plan', value: 'team' })];
        const result = computeEntitlements({ plans, defaultPlan: 'free', held: null, overrides, now: NOW });
        expect(result.plan).toBe('team');
        expect(result.features).toContain('sso');
        expect(result.applied).toEqual([{ id: 'p', scope: 'organization', key: 'plan' }]);
    });

    it('ignores expired overrides, unknown plans, and values that do not fit their key', () => {
        const overrides = [
            override({ id: 'expired', key: 'feature:sso', value: true, expiresAt: NOW - 1 }),
            override({ id: 'future', key: 'feature:api', value: true, expiresAt: NOW + 1 }),
            override({ id: 'badplan', key: 'plan', value: 'enterprise' }),
            override({ id: 'badtype', key: 'limit:projects', value: 'lots' }),
        ];
        const result = computeEntitlements({ plans, defaultPlan: 'free', held: null, overrides, now: NOW });
        expect(result.plan).toBe('free');
        expect(result.features).toEqual(['api']);
        expect(result.limits).toEqual({ projects: 3 });
        expect(result.applied.map((entry) => entry.id)).toEqual(['future']);
    });
});

describe('gates', () => {
    const pro = computeEntitlements({ plans, defaultPlan: 'free', held: 'pro', overrides: [], now: NOW });
    const team = computeEntitlements({ plans, defaultPlan: 'free', held: 'team', overrides: [], now: NOW });

    it('feature: allowed when in the plan, upsell otherwise', () => {
        expect(checkFeature(pro, 'export')).toMatchObject({ allowed: true, reason: 'OK', plan: 'pro' });
        expect(checkFeature(pro, 'sso', '/billing')).toEqual({
            allowed: false,
            upsell: true,
            reason: 'FEATURE_NOT_IN_PLAN',
            plan: 'pro',
            upgradeHref: '/billing',
        });
    });

    it('limit: room below the ceiling, UNLIMITED and undeclared keys never close', () => {
        expect(checkLimit(pro, 'projects', 49)).toMatchObject({ allowed: true, limit: 50 });
        expect(checkLimit(pro, 'projects', 50)).toMatchObject({ allowed: false, reason: 'LIMIT_REACHED', limit: 50 });
        expect(checkLimit(team, 'projects', 10_000)).toMatchObject({ allowed: true, reason: 'OK' });
        expect(checkLimit(pro, 'widgets', 10_000)).toMatchObject({ allowed: true, reason: 'OK' });
    });
});

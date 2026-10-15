import {
    UNLIMITED,
    type Entitlements,
    type GateAnswer,
    type Override,
    type OverrideScope,
    type PlanDefinition,
} from './types';

const SCOPE_ORDER: Record<OverrideScope, number> = { app: 0, organization: 1, user: 2 };

export function planRank(plans: Record<string, PlanDefinition>, key: string): number {
    const plan = plans[key];
    if (!plan) return -1;
    return plan.rank ?? Object.keys(plans).indexOf(key);
}

/** The best plan among the keys a subject holds; unknown keys are ignored; the default is the floor. */
export function pickPlan(
    plans: Record<string, PlanDefinition>,
    defaultPlan: string,
    held: string | string[] | null | undefined,
): string {
    const candidates = (Array.isArray(held) ? held : held ? [held] : []).filter((key) => key in plans);
    let best = defaultPlan;
    for (const key of candidates) {
        if (planRank(plans, key) > planRank(plans, best)) best = key;
    }
    return best;
}

/** Overrides in the order they apply: app-wide first, the user's own last, so the narrowest wins. */
export function orderOverrides(overrides: Override[], now: number): Override[] {
    return overrides
        .filter(
            (override) => override.expiresAt === null || override.expiresAt === undefined || override.expiresAt > now,
        )
        .sort((a, b) => SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope]);
}

/**
 * Pure: plans + the plan held + the overrides that apply → one answer. Everything else in
 * this package is fetching the inputs and shaping the response.
 */
export function computeEntitlements(input: {
    plans: Record<string, PlanDefinition>;
    defaultPlan: string;
    held: string | string[] | null | undefined;
    overrides: Override[];
    now: number;
}): Entitlements {
    const ordered = orderOverrides(input.overrides, input.now);
    const applied: Entitlements['applied'] = [];

    let planKey = pickPlan(input.plans, input.defaultPlan, input.held);
    for (const override of ordered) {
        if (override.key === 'plan' && typeof override.value === 'string' && override.value in input.plans) {
            planKey = override.value;
            applied.push({ id: override.id, scope: override.scope, key: override.key });
        }
    }
    const plan = input.plans[planKey] ?? {};

    const features = new Set(plan.features ?? []);
    const limits: Record<string, number> = { ...(plan.limits ?? {}) };
    for (const override of ordered) {
        if (override.key.startsWith('feature:') && typeof override.value === 'boolean') {
            const feature = override.key.slice('feature:'.length);
            if (override.value) features.add(feature);
            else features.delete(feature);
            applied.push({ id: override.id, scope: override.scope, key: override.key });
        } else if (
            override.key.startsWith('limit:') &&
            typeof override.value === 'number' &&
            Number.isFinite(override.value)
        ) {
            limits[override.key.slice('limit:'.length)] = override.value;
            applied.push({ id: override.id, scope: override.scope, key: override.key });
        }
    }

    return {
        plan: planKey,
        label: plan.label ?? planKey,
        features: [...features].sort(),
        limits,
        applied,
    };
}

export function checkFeature(entitlements: Entitlements, feature: string, upgradeHref?: string): GateAnswer {
    const allowed = entitlements.features.includes(feature);
    return {
        allowed,
        upsell: !allowed,
        reason: allowed ? 'OK' : 'FEATURE_NOT_IN_PLAN',
        plan: entitlements.plan,
        ...(upgradeHref ? { upgradeHref } : {}),
    };
}

export function checkLimit(
    entitlements: Entitlements,
    limitKey: string,
    current: number,
    upgradeHref?: string,
): GateAnswer {
    const limit = entitlements.limits[limitKey];
    if (limit === undefined || limit === UNLIMITED) {
        return { allowed: true, upsell: false, reason: 'OK', plan: entitlements.plan };
    }
    const allowed = current < limit;
    return {
        allowed,
        upsell: !allowed,
        reason: allowed ? 'OK' : 'LIMIT_REACHED',
        plan: entitlements.plan,
        limit,
        ...(upgradeHref ? { upgradeHref } : {}),
    };
}

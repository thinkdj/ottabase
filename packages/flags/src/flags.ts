import { checkFeature, checkLimit, computeEntitlements } from './entitlements';
import { gateDeniedResponse } from './guard';
import { createModelOverrideStore } from './store';
import type { Entitlements, Flags, FlagsOptions, Subject } from './types';

function subjectKey(subject: Subject): string {
    return `${subject.appId}|${subject.organizationId ?? ''}|${subject.userId ?? ''}`;
}

/**
 * Build the app's entitlement resolver. One per app, created in the package composition:
 *
 * ```typescript
 * export const flags = createFlags<CloudflareEnv>({
 *     plans: { free: { limits: { projects: 3 } }, pro: { features: ['export'], limits: { projects: UNLIMITED } } },
 *     defaultPlan: 'free',
 *     resolvePlan: (env, subject) => activeTiers(subject), // payport, a column, anything
 *     upgradeHref: '/billing',
 * });
 * ```
 */
export function createFlags<Env = unknown>(options: FlagsOptions<Env>): Flags<Env> {
    if (!(options.defaultPlan in options.plans)) {
        throw new Error(`[flags] defaultPlan "${options.defaultPlan}" is not one of the declared plans.`);
    }
    const now = options.now ?? Date.now;
    const store = options.overrides ?? createModelOverrideStore<Env>();
    const ttl = options.cacheTtlMs ?? 30_000;
    const cache = new Map<string, { value: Entitlements; expiresAt: number }>();

    async function resolve(env: Env, subject: Subject): Promise<Entitlements> {
        const key = subjectKey(subject);
        const cached = cache.get(key);
        const at = now();
        if (cached && cached.expiresAt > at) return cached.value;

        const [held, overrides] = await Promise.all([
            options.resolvePlan ? options.resolvePlan(env, subject) : null,
            store.list(env, subject),
        ]);
        const value = computeEntitlements({
            plans: options.plans,
            defaultPlan: options.defaultPlan,
            held,
            overrides,
            now: at,
        });
        if (ttl > 0) cache.set(key, { value, expiresAt: at + ttl });
        return value;
    }

    const noSubject = (subject: Subject) => !subject.appId || (!subject.organizationId && !subject.userId);

    return {
        plans: options.plans,
        resolve,
        async feature(env, subject, feature) {
            if (noSubject(subject)) return { allowed: false, upsell: false, reason: 'NO_SUBJECT', plan: null };
            return checkFeature(await resolve(env, subject), feature, options.upgradeHref);
        },
        async limit(env, subject, limitKey, current) {
            if (noSubject(subject)) return { allowed: false, upsell: false, reason: 'NO_SUBJECT', plan: null };
            return checkLimit(await resolve(env, subject), limitKey, current, options.upgradeHref);
        },
        async requireFeature(env, subject, feature) {
            const answer = await this.feature(env, subject, feature);
            return answer.allowed ? null : gateDeniedResponse(answer, { feature });
        },
        async requireLimit(env, subject, limitKey, current) {
            const answer = await this.limit(env, subject, limitKey, current);
            return answer.allowed ? null : gateDeniedResponse(answer, { limit: limitKey });
        },
        invalidate(subject) {
            if (!subject) cache.clear();
            else cache.delete(subjectKey(subject));
        },
    };
}

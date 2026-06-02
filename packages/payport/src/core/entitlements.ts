// ============================================================
// Payport — Entitlements Engine
// ============================================================
//
// Resolves which features a user has access to. Sources:
//   1. Active subscription's plan features (live lookup).
//   2. Explicit grants stored in `payment_entitlements`.
//
// Short-TTL per-userId memoization (ENTITLEMENTS_CACHE_TTL_MS,
// default 5 s) collapses multiple hasFeature() calls within the
// same HTTP handler into a single pair of DB round-trips, while
// ensuring the cache doesn't serve stale data across requests in
// long-lived Cloudflare Workers isolates.
//
// Call `clearEntitlementsCache(userId)` after a subscription
// mutation (cancel, upgrade) to force an immediate refresh.
// ============================================================

import { PaymentEntitlement, PaymentPlan, PaymentSubscription } from '../models';
import { resolvePlanBySlug } from './plans';

export interface ResolvedEntitlements {
    userId: string;
    planSlug: string | null;
    features: string[];
}

// ── In-isolate short-TTL cache ────────────────────────────────
// Stores a { promise, expiresAt } entry per userId. The promise is
// shared so concurrent calls for the same user don't fan out to the DB.

const ENTITLEMENTS_CACHE_TTL_MS = 5_000; // 5 seconds

interface CacheEntry {
    promise: Promise<ResolvedEntitlements>;
    expiresAt: number;
}

const ENTITLEMENTS_CACHE = new Map<string, CacheEntry>();

/** Force a cache eviction for a given user (call after subscription mutations). */
export function clearEntitlementsCache(userId?: string): void {
    if (userId) {
        ENTITLEMENTS_CACHE.delete(userId);
    } else {
        ENTITLEMENTS_CACHE.clear();
    }
}

async function resolveEntitlementsUncached(userId: string): Promise<ResolvedEntitlements> {
    const [subscription, granted] = await Promise.all([
        PaymentSubscription.activeForUser(userId),
        PaymentEntitlement.featuresForUser(userId),
    ]);

    let planSlug = (subscription?.get('planSlug') as string | undefined) ?? null;

    // Fallback: when the user has no active subscription, attribute the
    // configured "default" plan (typically the free tier). This lets
    // `hasFeature()` work end-to-end immediately after signup with no
    // explicit subscription rows or entitlement grants required.
    if (!planSlug) {
        const def = await PaymentPlan.findDefault();
        if (def) planSlug = (def.get('slug') as string | undefined) ?? null;
    }

    const planFeatures = planSlug ? (resolvePlanBySlug(planSlug)?.features ?? []) : [];

    // Deduplicate while preserving order (plan features first, then grants).
    const seen = new Set<string>();
    const features: string[] = [];
    for (const f of [...planFeatures, ...granted]) {
        if (!seen.has(f)) {
            seen.add(f);
            features.push(f);
        }
    }

    return { userId, planSlug, features };
}

export async function resolveEntitlements(userId: string): Promise<ResolvedEntitlements> {
    const now = Date.now();
    const cached = ENTITLEMENTS_CACHE.get(userId);
    if (cached && cached.expiresAt > now) return cached.promise;

    // Evict stale entry (if any) and create a new shared promise.
    const promise = resolveEntitlementsUncached(userId);
    // On rejection, remove the entry so the next call retries.
    promise.catch(() => ENTITLEMENTS_CACHE.delete(userId));
    ENTITLEMENTS_CACHE.set(userId, { promise, expiresAt: now + ENTITLEMENTS_CACHE_TTL_MS });
    return promise;
}

export async function hasFeature(userId: string, feature: string): Promise<boolean> {
    const { features } = await resolveEntitlements(userId);
    return features.includes(feature);
}

/** Alias for code that prefers a `can()` style. */
export const can = hasFeature;

/**
 * Hard assertion: throws `EntitlementError` if missing. Use at API boundaries.
 */
export class EntitlementError extends Error {
    constructor(
        public readonly userId: string,
        public readonly feature: string,
    ) {
        super(`User "${userId}" is missing required feature "${feature}".`);
        this.name = 'EntitlementError';
    }
}

export async function requireFeature(userId: string, feature: string): Promise<void> {
    if (!(await hasFeature(userId, feature))) throw new EntitlementError(userId, feature);
}

export class PlanRequiredError extends Error {
    constructor(
        public readonly userId: string,
        public readonly plan: string,
    ) {
        super(`User "${userId}" must be on plan "${plan}".`);
        this.name = 'PlanRequiredError';
    }
}

export async function requirePlan(userId: string, plan: string): Promise<void> {
    const subscription = await PaymentSubscription.activeForUser(userId);
    if (!subscription || subscription.get('planSlug') !== plan) throw new PlanRequiredError(userId, plan);
}

export class ActiveSubscriptionRequiredError extends Error {
    constructor(public readonly userId: string) {
        super(`User "${userId}" must have an active subscription.`);
        this.name = 'ActiveSubscriptionRequiredError';
    }
}

export async function requireActiveSubscription(userId: string): Promise<void> {
    const subscription = await PaymentSubscription.activeForUser(userId);
    if (!subscription || !subscription.isActive()) throw new ActiveSubscriptionRequiredError(userId);
}

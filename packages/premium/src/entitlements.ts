// ============================================================
// @ottabase/premium — entitlements
// ============================================================
// Two gate shapes cover every paid add-on we have needed: "is this feature in the
// plan" and "how many of these may exist". Both resolve from the same pair of inputs
// — the package's FREE tier, and whatever the verified license adds on top — so a
// package with no license still has a defined, useful answer instead of an error.
// ============================================================

import type { PremiumGateAnswer, PremiumLicenseClaims, PremiumPackage, PremiumState } from './types';

/** States that may serve traffic. Everything else is a closed gate. */
export function isServingState(state: PremiumState): boolean {
    return state === 'active' || state === 'grace';
}

/**
 * Effective feature set: the package's free features, plus the license's, deduped.
 *
 * A NON-SERVING STATE COLLAPSES TO THE FREE TIER rather than to nothing. That is the
 * whole reason `freeFeatures` exists: when a license lapses, the customer's data stays
 * readable and the basic path keeps working — only the paid surface closes.
 */
export function resolveFeatures(pkg: PremiumPackage, claims: PremiumLicenseClaims | null, state: PremiumState) {
    const free = pkg.freeFeatures ?? [];
    if (!isServingState(state) || !claims?.features?.length) {
        return [...new Set(free)];
    }
    return [...new Set([...free, ...claims.features])];
}

/** Effective limits: free defaults, overridden per-key by the license. */
export function resolveLimits(
    pkg: PremiumPackage,
    claims: PremiumLicenseClaims | null,
    state: PremiumState,
): Record<string, number> {
    const limits: Record<string, number> = { ...(pkg.freeLimits ?? {}) };
    if (!isServingState(state) || !claims?.limits) return limits;
    for (const [key, value] of Object.entries(claims.limits)) {
        if (typeof value === 'number' && Number.isFinite(value)) limits[key] = value;
    }
    return limits;
}

/** Sentinel for an uncapped limit. Explicit, because `undefined` already means "no such limit". */
export const UNLIMITED = -1;

export interface EntitlementInput {
    pkg: PremiumPackage;
    claims: PremiumLicenseClaims | null;
    state: PremiumState;
}

/** Is `feature` unlocked? Closed for any non-serving state unless it is a free feature. */
export function checkFeature(input: EntitlementInput, feature: string): PremiumGateAnswer {
    const features = resolveFeatures(input.pkg, input.claims, input.state);
    const allowed = features.includes(feature);
    return {
        allowed,
        // Upsell only when BUYING WOULD ACTUALLY HELP. A feature the package does not
        // declare at all is a caller bug, not a sales opportunity.
        upsell: !allowed && (input.pkg.features?.includes(feature) ?? false),
        reason: allowed ? 'OK' : gateReason(input.state, 'FEATURE_NOT_IN_PLAN'),
        state: input.state,
        purchaseUrl: input.pkg.purchaseUrl,
    };
}

/**
 * Is there room for one more? `current` is the count the caller already has.
 *
 * An UNDECLARED limit is UNLIMITED, not zero: a package that never declares
 * `freeLimits.endpoints` is saying "I do not cap endpoints", and defaulting to zero
 * there would silently brick every install that forgot to declare one.
 */
export function checkLimit(input: EntitlementInput, limitKey: string, current: number): PremiumGateAnswer {
    const limits = resolveLimits(input.pkg, input.claims, input.state);
    const limit = limits[limitKey];

    if (limit === undefined || limit === UNLIMITED) {
        return { allowed: true, upsell: false, reason: 'OK', state: input.state, purchaseUrl: input.pkg.purchaseUrl };
    }

    const allowed = current < limit;
    return {
        allowed,
        // A ceiling is always something a bigger plan could raise.
        upsell: !allowed && input.state !== 'disabled',
        // LIMIT_REACHED, not the licence-level reason — unlike a feature, the ceiling IS
        // what denied this call: `limits` already collapsed to the free tier, so the caller
        // is at the limit that genuinely applies right now. The licence nuance ("…because it
        // expired") is carried by `state`, which the UI renders alongside.
        reason: allowed ? 'OK' : input.state === 'disabled' ? 'PACKAGE_DISABLED' : 'LIMIT_REACHED',
        state: input.state,
        limit,
        purchaseUrl: input.pkg.purchaseUrl,
    };
}

/**
 * Report WHY a FEATURE gate closed, preferring the licence-level cause.
 *
 * "Not in your plan" when the licence has expired is a true statement that sends the
 * operator to the wrong page; there, the licence state is the actionable half. (Limits
 * are the opposite case — see `checkLimit`.)
 */
function gateReason(state: PremiumState, fallback: PremiumGateAnswer['reason']): PremiumGateAnswer['reason'] {
    switch (state) {
        case 'expired':
            return 'LICENSE_EXPIRED';
        case 'unlicensed':
            return 'LICENSE_MISSING';
        case 'invalid':
            return 'LICENSE_SIGNATURE_INVALID';
        case 'disabled':
            return 'PACKAGE_DISABLED';
        default:
            return fallback;
    }
}

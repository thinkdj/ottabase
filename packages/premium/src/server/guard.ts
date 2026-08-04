// ============================================================
// @ottabase/premium/server — request-path gates
// ============================================================
// The authoritative half of every gate. The React helpers in `@ottabase/premium/react`
// hide buttons; THESE refuse requests. A gate enforced only in the browser stops nobody
// with a fetch call, so every paid route calls one of these.
// ============================================================

import { errorResponse } from '@ottabase/utils/http-errors';
import type { PremiumGateAnswer, PremiumReason, PremiumState } from '../types';
import type { PremiumRegistry } from '../registry';

/**
 * HTTP status for a closed gate.
 *
 * 402 PAYMENT REQUIRED for anything a purchase would fix — that is precisely what the
 * status means, and it lets a client distinguish "buy this" from "you are not allowed"
 * without string-matching an error message. 403 for the two cases money does not fix:
 * an operator-disabled package, and a gate call naming a package that is not installed.
 */
export function premiumDeniedStatus(state: PremiumState, reason: PremiumReason): number {
    if (reason === 'PACKAGE_UNKNOWN' || state === 'disabled') return 403;
    return 402;
}

const REASON_MESSAGES: Record<PremiumReason, string> = {
    OK: 'Allowed',
    IN_GRACE: 'License expired — running inside the grace period',
    LICENSE_EXPIRED: 'This feature requires an active license',
    LICENSE_MISSING: 'This feature requires a license',
    LICENSE_MALFORMED: 'The installed license key could not be read',
    LICENSE_SIGNATURE_INVALID: 'The installed license key is not valid for this package',
    LICENSE_PACKAGE_MISMATCH: 'The installed license key belongs to a different package',
    LICENSE_APP_MISMATCH: 'The installed license key is issued for a different application',
    LICENSE_NOT_YET_VALID: 'The installed license key is not valid yet',
    NO_PUBLIC_KEY: 'This package cannot verify licenses',
    PACKAGE_DISABLED: 'This package is switched off',
    PACKAGE_UNKNOWN: 'This package is not installed',
    FEATURE_NOT_IN_PLAN: 'This feature is not included in your plan',
    LIMIT_REACHED: 'You have reached the limit for your plan',
};

/**
 * Turn a closed gate into a response.
 *
 * The body carries `metadata` the client can act on — which package, which reason,
 * which limit, where to buy — because "402" alone gives a UI nothing to render. None
 * of it is sensitive: it is the customer's own entitlement state.
 */
export function premiumDeniedResponse(packageKey: string, answer: PremiumGateAnswer): Response {
    const status = premiumDeniedStatus(answer.state, answer.reason);
    return errorResponse(REASON_MESSAGES[answer.reason] ?? 'This feature is not available', status, {
        code: status === 402 ? 'PREMIUM_REQUIRED' : 'PREMIUM_UNAVAILABLE',
        hint: answer.purchaseUrl ? `Manage or purchase a license: ${answer.purchaseUrl}` : undefined,
        metadata: {
            package: packageKey,
            reason: answer.reason,
            state: answer.state,
            upsell: answer.upsell,
            ...(answer.limit !== undefined ? { limit: answer.limit } : {}),
            ...(answer.purchaseUrl ? { purchaseUrl: answer.purchaseUrl } : {}),
        },
    });
}

/**
 * Require a package to be serving. Resolves null when it is — so a handler reads:
 *
 * ```typescript
 * const denied = await requirePremium(registry, env, 'webhooks');
 * if (denied) return denied;
 * ```
 */
export async function requirePremium<Env>(
    registry: PremiumRegistry<Env>,
    env: Env,
    packageKey: string,
): Promise<Response | null> {
    const resolution = await registry.resolve(env, packageKey);
    if (!resolution) {
        return premiumDeniedResponse(packageKey, {
            allowed: false,
            upsell: false,
            reason: 'PACKAGE_UNKNOWN',
            state: 'disabled',
        });
    }
    const { state, reason } = resolution.license;
    if (state === 'active' || state === 'grace') return null;
    return premiumDeniedResponse(packageKey, {
        allowed: false,
        upsell: state !== 'disabled',
        reason,
        state,
        purchaseUrl: resolution.pkg.purchaseUrl,
    });
}

/** Require one feature of a package. Also covers the package-level gate. */
export async function requirePremiumFeature<Env>(
    registry: PremiumRegistry<Env>,
    env: Env,
    packageKey: string,
    feature: string,
): Promise<Response | null> {
    const answer = await registry.feature(env, packageKey, feature);
    return answer.allowed ? null : premiumDeniedResponse(packageKey, answer);
}

/**
 * Require room under a numeric limit.
 *
 * `current` is the caller's OWN count and must be measured server-side — passing a
 * client-supplied number here would let the client raise its own ceiling.
 */
export async function requirePremiumLimit<Env>(
    registry: PremiumRegistry<Env>,
    env: Env,
    packageKey: string,
    limitKey: string,
    current: number,
): Promise<Response | null> {
    const answer = await registry.limit(env, packageKey, limitKey, current);
    return answer.allowed ? null : premiumDeniedResponse(packageKey, answer);
}

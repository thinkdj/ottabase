// ============================================================
// @ottabase/premium — gates over a resolved status
// ============================================================
// The browser never sees a manifest, only the `PremiumPackageStatus` the server
// resolved. These evaluate the same two gate shapes against that view, so the client's
// answer and the server's answer come from ONE resolution rather than two independently
// computed opinions about the customer's plan.
//
// THEY DO NOT RE-CHECK `enabled`. The server already collapsed `features` and `limits`
// to whatever applies right now — the free tier for a lapsed licence, the paid tier for
// a live one — so re-gating on `enabled` here would disagree with the server and disable
// the button for a free-tier action the server would happily accept.
// ============================================================

import { UNLIMITED } from './entitlements';
import type { PremiumGateAnswer, PremiumPackageStatus } from './types';

/** Is `feature` unlocked, per the server-resolved status? */
export function checkFeatureFromStatus(status: PremiumPackageStatus, feature: string): PremiumGateAnswer {
    const allowed = status.features.includes(feature);
    return {
        allowed,
        upsell: !allowed && status.state !== 'disabled',
        // Prefer the licence-level cause when the licence is the problem — see `checkFeature`.
        reason: allowed ? 'OK' : status.enabled ? 'FEATURE_NOT_IN_PLAN' : status.reason,
        state: status.state,
        purchaseUrl: status.purchaseUrl,
    };
}

/** Is there room for one more? An undeclared limit is unlimited — see `checkLimit`. */
export function checkLimitFromStatus(
    status: PremiumPackageStatus,
    limitKey: string,
    current: number,
): PremiumGateAnswer {
    const limit = status.limits[limitKey];
    if (limit === undefined || limit === UNLIMITED) {
        return { allowed: true, upsell: false, reason: 'OK', state: status.state, purchaseUrl: status.purchaseUrl };
    }

    const allowed = current < limit;
    return {
        allowed,
        upsell: !allowed && status.state !== 'disabled',
        reason: allowed ? 'OK' : status.state === 'disabled' ? 'PACKAGE_DISABLED' : 'LIMIT_REACHED',
        state: status.state,
        limit,
        purchaseUrl: status.purchaseUrl,
    };
}

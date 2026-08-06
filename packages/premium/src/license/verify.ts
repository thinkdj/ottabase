// ============================================================
// @ottabase/premium — license verdict
// ============================================================
// One function turns "a string an operator pasted" into a state the rest of the
// framework can act on. Every branch fails CLOSED, and every closed branch still
// leaves the host app running — a Premium Package that cannot prove its licence simply
// contributes nothing.
// ============================================================

import type { PremiumLicenseClaims, PremiumLicenseResult, PremiumState } from '../types';
import { parseLicenseToken, verifyLicenseSignature } from './token';

/** Default days a package keeps serving after expiry. */
export const DEFAULT_GRACE_DAYS = 14;

const DAY_SECONDS = 24 * 60 * 60;

export interface VerifyLicenseOptions {
    /** Package key the license MUST name. A license for another package is `invalid`, not ignored. */
    packageKey: string;
    /** Vendor public key (base64url SPKI). Omit for an unlicensed/free package. */
    publicKey?: string;
    /** Deployment app id, checked only when the license carries an `appId` binding. */
    appId?: string;
    /** Grace window after expiry, in days. Default {@link DEFAULT_GRACE_DAYS}; 0 = hard cut-off. */
    graceDays?: number;
    /** Seconds since epoch. Injectable so tests do not depend on wall-clock time. */
    now?: number;
}

function fail(state: PremiumState, reason: PremiumLicenseResult['reason']): PremiumLicenseResult {
    return { state, reason, claims: null, expiresIn: null };
}

/** Validate the signed payload before any entitlement code consumes its fields. */
function hasValidClaims(claims: PremiumLicenseClaims): boolean {
    if (
        !claims.id ||
        !claims.pkg ||
        !claims.plan ||
        !claims.licensee ||
        !Number.isFinite(claims.iat) ||
        (claims.nbf !== undefined && !Number.isFinite(claims.nbf)) ||
        (claims.exp !== undefined && !Number.isFinite(claims.exp)) ||
        (claims.appId !== undefined && typeof claims.appId !== 'string')
    ) {
        return false;
    }
    if (
        claims.features !== undefined &&
        (!Array.isArray(claims.features) || !claims.features.every((item) => typeof item === 'string'))
    ) {
        return false;
    }
    return (
        claims.limits === undefined ||
        (claims.limits !== null &&
            typeof claims.limits === 'object' &&
            Object.values(claims.limits).every((value) => typeof value === 'number' && Number.isFinite(value)))
    );
}

/**
 * Verify a license token and produce the runtime verdict.
 *
 * Order matters and is deliberate: SIGNATURE FIRST, then package binding, then app
 * binding, then time. Checking expiry before the signature would let an unsigned
 * token's `exp` field decide which error an operator sees — small, but it is the kind
 * of detail that turns a forged token into a support ticket about "clock skew".
 */
export async function verifyLicense(
    token: string | null | undefined,
    options: VerifyLicenseOptions,
): Promise<PremiumLicenseResult> {
    const now = options.now ?? Math.floor(Date.now() / 1000);

    // No public key ⇒ nothing to verify against. The package is free by construction:
    // an in-house add-on distributed inside one organisation has no vendor to sign for it.
    if (!options.publicKey) {
        return { state: 'active', reason: 'OK', claims: null, expiresIn: null };
    }

    if (!token || !token.trim()) {
        return fail('unlicensed', 'LICENSE_MISSING');
    }

    const parsed = parseLicenseToken(token);
    if (!parsed) {
        return fail('invalid', 'LICENSE_MALFORMED');
    }

    if (!(await verifyLicenseSignature(parsed, options.publicKey))) {
        return fail('invalid', 'LICENSE_SIGNATURE_INVALID');
    }

    const claims = parsed.claims;

    if (!hasValidClaims(claims)) {
        return fail('invalid', 'LICENSE_MALFORMED');
    }

    if (claims.pkg !== options.packageKey) {
        return fail('invalid', 'LICENSE_PACKAGE_MISMATCH');
    }

    // An `appId` claim is an OPTIONAL binding. When present it is exact: a license
    // minted for 'acme-prod' must not quietly unlock 'acme-staging'.
    if (claims.appId && claims.appId !== options.appId) {
        return fail('invalid', 'LICENSE_APP_MISMATCH');
    }

    const notBefore = claims.nbf ?? claims.iat;
    if (typeof notBefore === 'number' && now < notBefore) {
        return { state: 'invalid', reason: 'LICENSE_NOT_YET_VALID', claims, expiresIn: null };
    }

    // No `exp` ⇒ perpetual. Common for "lifetime" tiers and for keys a vendor issues
    // to itself; not an oversight, so it must not be treated as "expired at 0".
    if (typeof claims.exp !== 'number') {
        return { state: 'active', reason: 'OK', claims, expiresIn: null };
    }

    const expiresIn = claims.exp - now;
    if (expiresIn >= 0) {
        return { state: 'active', reason: 'OK', claims, expiresIn };
    }

    const graceSeconds = Math.max(0, options.graceDays ?? DEFAULT_GRACE_DAYS) * DAY_SECONDS;
    if (now <= claims.exp + graceSeconds) {
        return { state: 'grace', reason: 'IN_GRACE', claims, expiresIn };
    }

    return { state: 'expired', reason: 'LICENSE_EXPIRED', claims, expiresIn };
}

/** Expiry timestamp in ms for display, or null for a perpetual/unlicensed package. */
export function licenseExpiresAt(claims: PremiumLicenseClaims | null): number | null {
    return typeof claims?.exp === 'number' ? claims.exp * 1000 : null;
}

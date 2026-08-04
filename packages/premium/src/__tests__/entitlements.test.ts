// ============================================================
// Entitlements — what a customer may do once the license verdict is in.
//
// The behaviours worth pinning are the DEFAULTS, because they decide what happens
// to a paying customer whose card expires on a Friday night: the free tier keeps
// working, the paid surface closes, and nothing throws.
// ============================================================

import { describe, expect, it } from 'vitest';
import { UNLIMITED, checkFeature, checkLimit, resolveFeatures, resolveLimits } from '../entitlements';
import { checkFeatureFromStatus, checkLimitFromStatus } from '../status-gates';
import type { PremiumLicenseClaims, PremiumPackage, PremiumPackageStatus } from '../types';

const pkg: PremiumPackage = {
    key: 'webhooks',
    name: 'Webhooks',
    version: '1.0.0',
    purchaseUrl: 'https://example.com/pricing',
    features: ['deliveries.log', 'custom-headers'],
    freeFeatures: ['endpoints.manage'],
    freeLimits: { endpoints: 1 },
};

const claims: PremiumLicenseClaims = {
    id: 'lic_1',
    pkg: 'webhooks',
    plan: 'pro',
    licensee: 'Acme',
    iat: 0,
    features: ['deliveries.log'],
    limits: { endpoints: 25 },
};

describe('resolution', () => {
    it('unions free features with the license features', () => {
        expect(resolveFeatures(pkg, claims, 'active').sort()).toEqual(['deliveries.log', 'endpoints.manage']);
    });

    it('collapses to the free tier when the license is not serving', () => {
        expect(resolveFeatures(pkg, claims, 'expired')).toEqual(['endpoints.manage']);
        expect(resolveLimits(pkg, claims, 'expired')).toEqual({ endpoints: 1 });
    });

    it('keeps the raised limits during grace', () => {
        expect(resolveLimits(pkg, claims, 'grace')).toEqual({ endpoints: 25 });
    });

    it('ignores a non-numeric limit from a license', () => {
        const bad = { ...claims, limits: { endpoints: Number.NaN } };
        expect(resolveLimits(pkg, bad, 'active')).toEqual({ endpoints: 1 });
    });
});

describe('checkFeature', () => {
    it('allows a licensed feature', () => {
        expect(checkFeature({ pkg, claims, state: 'active' }, 'deliveries.log').allowed).toBe(true);
    });

    it('allows a free feature with no license at all', () => {
        const answer = checkFeature({ pkg, claims: null, state: 'unlicensed' }, 'endpoints.manage');
        expect(answer.allowed).toBe(true);
    });

    it('upsells a declared feature the plan does not include', () => {
        const answer = checkFeature({ pkg, claims: null, state: 'unlicensed' }, 'custom-headers');
        expect(answer.allowed).toBe(false);
        expect(answer.upsell).toBe(true);
        expect(answer.purchaseUrl).toBe('https://example.com/pricing');
    });

    it('does NOT upsell a feature the package never declared — that is a caller bug', () => {
        const answer = checkFeature({ pkg, claims, state: 'active' }, 'teleportation');
        expect(answer.allowed).toBe(false);
        expect(answer.upsell).toBe(false);
    });

    it('reports the license-level reason rather than the feature-level one', () => {
        expect(checkFeature({ pkg, claims, state: 'expired' }, 'deliveries.log').reason).toBe('LICENSE_EXPIRED');
        expect(checkFeature({ pkg, claims: null, state: 'unlicensed' }, 'custom-headers').reason).toBe(
            'LICENSE_MISSING',
        );
    });
});

describe('the free tier stays usable without a license', () => {
    // This is what makes `gate: 'entitlements'` viable: a package whose routes stay
    // reachable must still answer "yes" to the free actions, or the free tier is a
    // marketing claim with no code behind it.
    it('allows a free feature and the first unit of a free limit while unlicensed', () => {
        const input = { pkg, claims: null, state: 'unlicensed' as const };
        expect(checkFeature(input, 'endpoints.manage').allowed).toBe(true);
        expect(checkLimit(input, 'endpoints', 0).allowed).toBe(true);
        expect(checkLimit(input, 'endpoints', 1).allowed).toBe(false);
    });

    it('blames the CEILING, not the license, when a limit is what denied the call', () => {
        // `limits` has already collapsed to the free tier, so the ceiling is what actually
        // applies; `state` carries the "…because it expired" nuance for the UI.
        const denied = checkLimit({ pkg, claims, state: 'expired' }, 'endpoints', 1);
        expect(denied.reason).toBe('LIMIT_REACHED');
        expect(denied.state).toBe('expired');
        expect(denied.upsell).toBe(true);
    });

    it('never upsells an operator-disabled package', () => {
        expect(checkLimit({ pkg, claims, state: 'disabled' }, 'endpoints', 5).upsell).toBe(false);
        expect(checkLimit({ pkg, claims, state: 'disabled' }, 'endpoints', 5).reason).toBe('PACKAGE_DISABLED');
    });
});

describe('checkLimit', () => {
    it('allows below the limit and refuses at it', () => {
        expect(checkLimit({ pkg, claims, state: 'active' }, 'endpoints', 24).allowed).toBe(true);
        expect(checkLimit({ pkg, claims, state: 'active' }, 'endpoints', 25).allowed).toBe(false);
    });

    it('applies the free limit once the license stops serving', () => {
        const answer = checkLimit({ pkg, claims, state: 'expired' }, 'endpoints', 1);
        expect(answer.allowed).toBe(false);
        expect(answer.limit).toBe(1);
    });

    it('treats an undeclared limit as unlimited, not as zero', () => {
        expect(checkLimit({ pkg, claims, state: 'active' }, 'nonexistent', 9999).allowed).toBe(true);
    });

    it('treats UNLIMITED as uncapped', () => {
        const unlimited = { ...claims, limits: { endpoints: UNLIMITED } };
        expect(checkLimit({ pkg, claims: unlimited, state: 'active' }, 'endpoints', 10_000).allowed).toBe(true);
    });
});

describe('status-based gates (the browser view)', () => {
    const status: PremiumPackageStatus = {
        key: 'webhooks',
        name: 'Webhooks',
        version: '1.0.0',
        state: 'active',
        reason: 'OK',
        enabled: true,
        requiresLicense: true,
        licenseSource: 'env',
        plan: 'pro',
        licensee: 'Acme',
        expiresAt: null,
        features: ['deliveries.log'],
        limits: { endpoints: 5 },
        installedVersion: '1.0.0',
        installedAt: 0,
        nav: [],
        purchaseUrl: 'https://example.com/pricing',
    };

    it('mirrors the server answer for a feature', () => {
        expect(checkFeatureFromStatus(status, 'deliveries.log').allowed).toBe(true);
        expect(checkFeatureFromStatus(status, 'custom-headers').allowed).toBe(false);
    });

    it('closes a paid feature when the license lapses, and says why', () => {
        // The server collapses `features`/`limits` to the free tier for a lapsed license,
        // so this status is what a real expired install looks like.
        const expired = {
            ...status,
            enabled: false,
            state: 'expired' as const,
            reason: 'LICENSE_EXPIRED' as const,
            features: ['endpoints.manage'],
            limits: { endpoints: 1 },
        };
        const denied = checkFeatureFromStatus(expired, 'deliveries.log');
        expect(denied.allowed).toBe(false);
        expect(denied.reason).toBe('LICENSE_EXPIRED');
    });

    it('keeps the free tier usable in the browser exactly as the server does', () => {
        // A client gate stricter than the server disables a button for an action the server
        // would accept — the free tier would be unreachable from the UI only.
        const expired = {
            ...status,
            enabled: false,
            state: 'expired' as const,
            reason: 'LICENSE_EXPIRED' as const,
            features: ['endpoints.manage'],
            limits: { endpoints: 1 },
        };
        expect(checkFeatureFromStatus(expired, 'endpoints.manage').allowed).toBe(true);
        expect(checkLimitFromStatus(expired, 'endpoints', 0).allowed).toBe(true);
        expect(checkLimitFromStatus(expired, 'endpoints', 1).reason).toBe('LIMIT_REACHED');
    });

    it('never offers an upsell for an operator-disabled package', () => {
        const disabled = {
            ...status,
            enabled: false,
            state: 'disabled' as const,
            reason: 'PACKAGE_DISABLED' as const,
            features: [],
            limits: { endpoints: 0 },
        };
        expect(checkFeatureFromStatus(disabled, 'deliveries.log').upsell).toBe(false);
        expect(checkLimitFromStatus(disabled, 'endpoints', 0).upsell).toBe(false);
    });

    it('enforces the limit it was given', () => {
        expect(checkLimitFromStatus(status, 'endpoints', 4).allowed).toBe(true);
        expect(checkLimitFromStatus(status, 'endpoints', 5).allowed).toBe(false);
        expect(checkLimitFromStatus(status, 'unknown-key', 100).allowed).toBe(true);
    });
});

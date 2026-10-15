// ============================================================
// @ottabase/premium — the Premium Package contract
// ============================================================
// A Premium Package IS an Ottabase package (`@ottabase/kernel`'s `OttaPackage`): the same
// tables, models, policies, cron, queue, events, nav and health, collected by the same
// registry. What this package adds is the commercial layer: an offline-verified license,
// entitlements (features and limits) that a license unlocks, a license-aware lifecycle,
// and route mounting behind a license gate.
// ============================================================

import type { LifecycleContext, NavContribution, OttaPackage, PackageHost, RouteContribution } from '@ottabase/kernel';
import type { Router } from '@ottabase/ottarouter';

/**
 * Runtime state of a registered Premium Package. Resolved on every request from the
 * license (env or activation store) — never cached across deployments.
 *
 * Only `active` and `grace` may serve traffic. Everything else is a closed gate, and
 * every closed gate still leaves the host app fully functional: a Premium Package that
 * cannot verify its license contributes nothing, it does not break anything.
 */
export type PremiumState =
    /** Licensed, in date, bound correctly. Routes mounted, features unlocked. */
    | 'active'
    /** Expired but inside the grace window. Still serving, loudly warned. */
    | 'grace'
    /** Past expiry + grace. Read-only intent: routes refuse with 402. */
    | 'expired'
    /** A license was supplied but failed verification (bad signature, wrong package, wrong app). */
    | 'invalid'
    /** Registered, no license supplied. The default for a fresh install. */
    | 'unlicensed'
    /** Operator switched it off in config. Never mounted, never nagged about. */
    | 'disabled';

/** Why a gate answered the way it did. Machine-readable; safe to show an operator. */
export type PremiumReason =
    | 'OK'
    | 'IN_GRACE'
    | 'LICENSE_EXPIRED'
    | 'LICENSE_MISSING'
    | 'LICENSE_MALFORMED'
    | 'LICENSE_SIGNATURE_INVALID'
    | 'LICENSE_PACKAGE_MISMATCH'
    | 'LICENSE_APP_MISMATCH'
    | 'LICENSE_NOT_YET_VALID'
    | 'NO_PUBLIC_KEY'
    | 'PACKAGE_DISABLED'
    | 'PACKAGE_UNKNOWN'
    | 'FEATURE_NOT_IN_PLAN'
    | 'LIMIT_REACHED';

/**
 * The signed half of a license. A vendor mints it; the app verifies it offline.
 *
 * DELIBERATELY SMALL: everything here is copied into every gate answer and into the
 * admin UI, so each field has to earn its place. Anything the vendor wants to track
 * (seats consumed, support tier, invoice id) belongs in the vendor's own system, not
 * in a token the customer holds.
 */
export interface PremiumLicenseClaims {
    /** License id. Opaque to the app; used by the vendor for support and revocation. */
    id: string;
    /** Package key this license unlocks. A license for package A never opens package B. */
    pkg: string;
    /** Plan name, purely descriptive ('pro', 'team', 'enterprise'). Gating uses features/limits. */
    plan: string;
    /** Who bought it. Shown in the admin UI so an operator can tell two keys apart. */
    licensee: string;
    /** Feature ids unlocked by this license, beyond the package's free features. */
    features?: string[];
    /** Numeric ceilings this license raises (or lowers) relative to the package defaults. */
    limits?: Record<string, number>;
    /** Issued-at, seconds since epoch. */
    iat: number;
    /** Not-before, seconds since epoch. Optional; defaults to `iat`. */
    nbf?: number;
    /** Expiry, seconds since epoch. OMIT for a perpetual license. */
    exp?: number;
    /**
     * Bind the license to one deployment's `appId`. Optional, and optional on purpose:
     * a vendor selling to a single customer with three environments should not have to
     * mint three keys. When present it is enforced exactly.
     */
    appId?: string;
    /** Informational seat count. NOT enforced here — the app has no way to count a vendor's seats. */
    seats?: number;
}

/** A verified license plus the verdict that produced it. */
export interface PremiumLicenseResult {
    state: PremiumState;
    reason: PremiumReason;
    claims: PremiumLicenseClaims | null;
    /** Seconds until expiry; null for a perpetual or unverified license. Negative inside grace. */
    expiresIn: number | null;
}

/** Where the license came from. Shown in the admin UI, because it decides who can change it. */
export type PremiumLicenseSource = 'env' | 'store' | null;

/** A nav entry a Premium Package contributes. The kernel's shape; kept as a name for readers. */
export type PremiumNavItem = NavContribution;

/** Lifecycle hook arguments: the kernel's context plus the verified license claims. */
export interface PremiumLifecycleContext<Env = unknown> extends LifecycleContext<Env> {
    /** Verified claims, when the transition happened with a license in hand. */
    claims: PremiumLicenseClaims | null;
}

/**
 * Lifecycle hooks. Every one is OPTIONAL and every one is best-effort: a hook that
 * throws is logged and swallowed, because a paid add-on's bookkeeping must never take
 * the host app down. Put anything that MUST succeed in a migration instead.
 */
export interface PremiumLifecycleHooks<Env = unknown> {
    /** First time this package key is seen by this deployment. Seed defaults here. */
    onInstall?: (ctx: PremiumLifecycleContext<Env>) => Promise<void> | void;
    /** Manifest version differs from the recorded one. Migrate package-owned KV/state here. */
    onUpgrade?: (ctx: PremiumLifecycleContext<Env>) => Promise<void> | void;
    /** A license became valid (activation, renewal, or grace recovery). */
    onActivate?: (ctx: PremiumLifecycleContext<Env>) => Promise<void> | void;
    /** A license stopped being valid (removed, expired past grace, or invalidated). */
    onDeactivate?: (ctx: PremiumLifecycleContext<Env> & { reason: PremiumReason }) => Promise<void> | void;
    /**
     * Explicit offboarding hook for a controlled uninstall deployment. The framework
     * cannot infer removal from a manifest that is no longer loaded, so this is never
     * exposed as a runtime admin action.
     */
    onUninstall?: (ctx: PremiumLifecycleContext<Env>) => Promise<void> | void;
}

/** How a Premium Package contributes API routes. One mount, behind the license gate. */
export interface PremiumRouteContribution<Env = unknown> extends Pick<RouteContribution<Env>, 'basePath'> {
    /**
     * Build the sub-router. Called ONCE at mount time, never per request — an ottarouter
     * Router freezes when mounted, so this must return a fresh instance.
     *
     * Receives the package host. `premiumRegistryOf(host)` returns the premium registry the
     * package was registered in, which is what lets a package's own routes call
     * `requirePremiumFeature(registry, …)` without the host app threading it through by hand.
     */
    build: (host: PackageHost<Env>) => Router<Env>;
    /**
     * How the mounted namespace is gated.
     *
     * - `'license'` (default): the WHOLE namespace requires a serving license. Right for a
     *   package with no free tier — one gate, no way to forget one.
     * - `'entitlements'`: routes mount whenever the package is not disabled, and the package
     *   enforces its own feature/limit gates. This is what makes a FREE TIER REACHABLE
     *   ("1 endpoint free, 25 on Pro") — under `'license'` an unlicensed caller gets 402 for
     *   the whole namespace and never reaches the free path. The cost is real: every paid
     *   route inside must call a guard itself, and a missed call is an unguarded paid route.
     */
    gate?: 'license' | 'entitlements';
}

/**
 * A Premium Package, as declared by its vendor: an Ottabase package plus the commercial
 * layer. Everything except `key`, `name` and `version` is optional.
 */
export interface PremiumPackage<Env = unknown> extends Omit<OttaPackage<Env>, 'routes' | 'lifecycle' | 'premium'> {
    vendor?: string;
    /** Where to buy a license. Rendered as the upsell link on every closed gate. */
    purchaseUrl?: string;

    /**
     * Base64url-encoded SPKI public key (ECDSA P-256) that signs this package's licenses.
     *
     * OMITTING THIS MAKES THE PACKAGE FREE, not open: with no key there is nothing to
     * verify against, so the package resolves to `active` with no claims. That is the
     * correct behaviour for an in-house add-on distributed inside one organisation, and
     * it is why the field is optional rather than a fake key.
     */
    licensePublicKey?: string;
    /** Days a package keeps serving after expiry. Default 14. Set 0 for a hard cut-off. */
    graceDays?: number;

    /** Feature ids this package understands. Documentation + admin UI; not a gate by itself. */
    features?: readonly string[];
    /** Features available WITHOUT a license — the free tier of a Premium Package. */
    freeFeatures?: readonly string[];
    /** Numeric ceilings that apply without a license. A license may raise them. */
    freeLimits?: Record<string, number>;

    /** API routes, mounted behind the license gate by the premium registry, not the kernel. */
    routes?: PremiumRouteContribution<Env>;
    lifecycle?: PremiumLifecycleHooks<Env>;

    /** Always `true`: tells the kernel to leave routes and lifecycle to the premium registry. */
    premium: true;
}

/** What a vendor passes to `definePremiumPackage()`; the `premium` marker is added for them. */
export type PremiumPackageInput<Env = unknown> = Omit<PremiumPackage<Env>, 'premium'>;

/** Persisted per-package state. Small on purpose — it is read on the request path. */
export interface PremiumInstallRecord {
    /** Manifest version at the last completed install/upgrade. */
    version: string;
    installedAt: number;
    updatedAt: number;
    /** License token activated through the admin API (env-supplied licenses are not stored). */
    license?: string | null;
    /** Last resolved state, for display only. Never trusted as an authorization input. */
    lastState?: PremiumState;
}

/**
 * Pluggable persistence for install records. The KV adapter is the production one;
 * the memory adapter exists so tests (and a KV-less local boot) behave identically.
 */
export interface PremiumStateStore {
    get(key: string): Promise<PremiumInstallRecord | null>;
    set(key: string, record: PremiumInstallRecord): Promise<void>;
    delete(key: string): Promise<void>;
    /** Best-effort listing for the admin UI. May return fewer keys than exist. */
    list(): Promise<string[]>;
}

/** The fully-resolved runtime view of one registered package. */
export interface PremiumPackageStatus {
    key: string;
    name: string;
    version: string;
    description?: string;
    vendor?: string;
    docsUrl?: string;
    purchaseUrl?: string;
    state: PremiumState;
    reason: PremiumReason;
    /** True for `active` and `grace` — the only two states that serve traffic. */
    enabled: boolean;
    /** Whether this package requires a license at all (false when it ships no public key). */
    requiresLicense: boolean;
    licenseSource: PremiumLicenseSource;
    plan: string | null;
    licensee: string | null;
    expiresAt: number | null;
    /** Effective features: free features plus anything the license adds. */
    features: string[];
    /** Effective limits: free limits, overridden by the license. */
    limits: Record<string, number>;
    /** Install record fields, when the package has been installed in this deployment. */
    installedVersion: string | null;
    installedAt: number | null;
    nav: PremiumNavItem[];
}

/** The answer a gate gives. Mirrors the shape `@ottabase/ottaai` uses for its own gates. */
export interface PremiumGateAnswer {
    allowed: boolean;
    /** True when showing an upgrade prompt is the right UI response. */
    upsell: boolean;
    reason: PremiumReason;
    state: PremiumState;
    /** Present for a limit check: the ceiling that applied. */
    limit?: number;
    purchaseUrl?: string;
}

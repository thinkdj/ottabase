// ============================================================
// @ottabase/premium — the registry
// ============================================================
// One object the host app builds once and hands to everything else: the router mounts
// through it, the migrations read tables from it, the admin API reads status from it,
// and every gate asks it. Registering a package is the ONLY integration step — nothing
// else in the app has to learn the package exists.
//
// An app with zero registered packages pays: one empty array, no KV reads, no routes,
// no nav entries. That is the point — the framework is inert until something is sold.
// ============================================================

import {
    collectPremiumMigrations,
    collectPremiumModels,
    collectPremiumNav,
    collectPremiumPolicies,
    collectPremiumTables,
} from './collect';
import { checkFeature, checkLimit, isServingState, resolveFeatures, resolveLimits } from './entitlements';
import { licenseExpiresAt, verifyLicense } from './license/verify';
import {
    applyDisabledLifecycle,
    applyLifecycle,
    applyUninstall,
    type PremiumLogger,
    type PremiumTransition,
} from './lifecycle';
import { createMemoryStateStore } from './state-store';
import type {
    PremiumGateAnswer,
    PremiumLicenseResult,
    PremiumLicenseSource,
    PremiumNavItem,
    PremiumPackage,
    PremiumPackageStatus,
    PremiumStateStore,
} from './types';

/** Env var holding one package's license: `PREMIUM_LICENSE_<KEY>` (key upper-snake-cased). */
export function licenseEnvKey(packageKey: string): string {
    return `PREMIUM_LICENSE_${packageKey.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
}

/** Env var that force-disables one package: `PREMIUM_PKG_<KEY>=false`. */
export function toggleEnvKey(packageKey: string): string {
    return `PREMIUM_PKG_${packageKey.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
}

/** Env var holding a JSON map of many licenses: `{"webhooks":"obp1...."}`. */
export const LICENSE_MAP_ENV_KEY = 'PREMIUM_LICENSES';

function readEnvString(env: unknown, key: string): string | undefined {
    if (!env || typeof env !== 'object') return undefined;
    const value = (env as Record<string, unknown>)[key];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export interface PremiumRegistryOptions<Env> {
    /** Manifests the app has installed. Order only affects display. */
    packages: Array<PremiumPackage<Env>>;
    /**
     * Deployment app id, enforced against a license's optional `appId` binding.
     *
     * Accepts a FUNCTION so it can be read from the request env. A host whose app id is
     * env-overridable would otherwise verify `appId`-bound licenses against the value
     * compiled into the config file — silently rejecting a correct key, or accepting one
     * minted for a different environment.
     */
    appId?: string | ((env: Env) => string | undefined);
    /**
     * Where install records live. Given a function so the host can build a KV-backed store
     * from the REQUEST env; returning null (no KV binding) falls back to memory, which keeps
     * every read/write path defined instead of conditionally absent.
     */
    getStore?: (env: Env) => PremiumStateStore | null;
    /** Packages switched off by config, in addition to the `PREMIUM_PKG_<KEY>=false` env var. */
    disabled?: string[];
    /**
     * How long a resolution is reused inside one isolate. Verification is pure, so this
     * caches a KV read and a signature check, not an authorization decision.
     *
     * The cost is bounded staleness: activating a license through the admin API busts the
     * cache in the isolate that served the request, and every other isolate follows within
     * one window. Default 60s.
     */
    cacheTtlMs?: number;
    /**
     * Stable identity for the request environment that owns this resolution cache.
     * Supply this when one registry can observe more than one app/configuration.
     */
    cacheKey?: (env: Env) => string;
    logger?: PremiumLogger;
}

/** A resolution, plus the bookkeeping that produced it. */
export interface PremiumResolution {
    pkg: PremiumPackage<unknown>;
    license: PremiumLicenseResult;
    licenseSource: PremiumLicenseSource;
    installedVersion: string | null;
    installedAt: number | null;
    transitions: PremiumTransition[];
}

interface CacheEntry {
    resolution: PremiumResolution;
    expiresAtMs: number;
}

export interface PremiumRegistry<Env = unknown> {
    /** Every registered manifest, in registration order. */
    readonly packages: ReadonlyArray<PremiumPackage<Env>>;
    get(key: string): PremiumPackage<Env> | null;
    /** Verify + reconcile one package. Cached per isolate for `cacheTtlMs`. */
    resolve(env: Env, key: string): Promise<PremiumResolution | null>;
    /** True when the package may serve traffic (`active` or `grace`). */
    isActive(env: Env, key: string): Promise<boolean>;
    status(env: Env, key: string): Promise<PremiumPackageStatus | null>;
    statuses(env: Env): Promise<PremiumPackageStatus[]>;
    /** Is a paid feature unlocked? */
    feature(env: Env, key: string, feature: string): Promise<PremiumGateAnswer>;
    /** Is there room for one more, given the caller's current count? */
    limit(env: Env, key: string, limitKey: string, current: number): Promise<PremiumGateAnswer>;
    /**
     * Store a verified, serving operator-pasted license. A rejected token returns its
     * status without replacing the currently stored key.
     */
    activate(env: Env, key: string, token: string): Promise<PremiumPackageStatus | null>;
    /** Remove a stored license. An env-supplied license is unaffected — and says so. */
    deactivate(env: Env, key: string): Promise<PremiumPackageStatus | null>;
    /**
     * Run the explicit offboarding hook before removing this package from deployment
     * configuration. This is intentionally not exposed through the admin HTTP API.
     */
    uninstall(env: Env, key: string): Promise<boolean>;
    /** Drop cached resolutions in this isolate. */
    invalidate(key?: string): void;

    // ── Contributions, for the host's own wiring ──
    tables(): Record<string, unknown>;
    migrations(): unknown[];
    models(): unknown[];
    policies(): unknown[];
    nav(): Array<PremiumNavItem & { packageKey: string }>;
}

export function createPremiumRegistry<Env = unknown>(options: PremiumRegistryOptions<Env>): PremiumRegistry<Env> {
    const packages = options.packages ?? [];
    const byKey = new Map(packages.map((pkg) => [pkg.key, pkg]));
    const disabled = new Set(options.disabled ?? []);
    const cacheTtlMs = options.cacheTtlMs ?? 60_000;
    const cache = new Map<string, CacheEntry>();
    const environmentIds = new WeakMap<object, string>();
    let nextEnvironmentId = 1;

    if (byKey.size !== packages.length) {
        const seen = new Set<string>();
        const duplicate = packages.find((pkg) => (seen.has(pkg.key) ? true : (seen.add(pkg.key), false)));
        throw new Error(`[premium] Duplicate package key "${duplicate?.key}" — each package may be registered once.`);
    }

    // One shared memory store, so a KV-less deployment still gets consistent lifecycle
    // behaviour within the isolate instead of re-running `onInstall` on every request.
    const fallbackStore = createMemoryStateStore();
    const storeFor = (env: Env): PremiumStateStore => options.getStore?.(env) ?? fallbackStore;

    function cacheKeyFor(env: Env, key: string): string {
        let environmentKey = options.cacheKey?.(env);
        if (!environmentKey && env && typeof env === 'object') {
            environmentKey = environmentIds.get(env as object);
            if (!environmentKey) {
                environmentKey = `env-${nextEnvironmentId++}`;
                environmentIds.set(env as object, environmentKey);
            }
        }
        return `${environmentKey ?? 'default'}:${key}`;
    }

    function invalidatePackage(key?: string): void {
        if (!key) {
            cache.clear();
            return;
        }
        for (const cacheKey of cache.keys()) {
            if (cacheKey.endsWith(`:${key}`)) cache.delete(cacheKey);
        }
    }

    function isDisabled(env: Env, key: string): boolean {
        if (disabled.has(key)) return true;
        const toggle = readEnvString(env, toggleEnvKey(key));
        return toggle !== undefined && (toggle.toLowerCase() === 'false' || toggle === '0');
    }

    /**
     * License lookup, in precedence order: package-specific env var, then the JSON map env
     * var, then the operator-activated value in the store.
     *
     * ENV WINS ON PURPOSE. A deploy-pinned license is the auditable one; letting an admin
     * UI silently override it would mean the key in your infrastructure config is not the
     * key actually in force.
     */
    async function findLicense(env: Env, key: string, store: PremiumStateStore) {
        const direct = readEnvString(env, licenseEnvKey(key));
        if (direct) return { token: direct, source: 'env' as PremiumLicenseSource };

        const mapRaw = readEnvString(env, LICENSE_MAP_ENV_KEY);
        if (mapRaw) {
            try {
                const parsed = JSON.parse(mapRaw) as Record<string, string>;
                const fromMap = parsed?.[key];
                if (typeof fromMap === 'string' && fromMap.trim()) {
                    return { token: fromMap.trim(), source: 'env' as PremiumLicenseSource };
                }
            } catch {
                // A malformed map must not hide a valid stored license, so fall through.
            }
        }

        const record = await store.get(key);
        if (record?.license) return { token: record.license, source: 'store' as PremiumLicenseSource };
        return { token: null, source: null as PremiumLicenseSource };
    }

    function verifyPackageLicense(env: Env, pkg: PremiumPackage<Env>, token: string | null | undefined) {
        return verifyLicense(token, {
            packageKey: pkg.key,
            publicKey: pkg.licensePublicKey,
            appId: typeof options.appId === 'function' ? options.appId(env) : options.appId,
            graceDays: pkg.graceDays,
        });
    }

    async function resolveUncached(env: Env, pkg: PremiumPackage<Env>): Promise<PremiumResolution> {
        const store = storeFor(env);

        if (isDisabled(env, pkg.key)) {
            const record = await store.get(pkg.key);
            const license = {
                state: 'disabled' as const,
                reason: 'PACKAGE_DISABLED' as const,
                claims: null,
                expiresIn: null,
            };
            const lifecycle = await applyDisabledLifecycle({ pkg, env, license, store, logger: options.logger });
            return {
                pkg: pkg as PremiumPackage<unknown>,
                license,
                licenseSource: null,
                installedVersion: lifecycle?.record.version ?? record?.version ?? null,
                installedAt: lifecycle?.record.installedAt ?? record?.installedAt ?? null,
                transitions: lifecycle?.transitions ?? [],
            };
        }

        const { token, source } = await findLicense(env, pkg.key, store);
        const license = await verifyPackageLicense(env, pkg, token);

        const { record, transitions } = await applyLifecycle({
            pkg,
            env,
            license,
            store,
            logger: options.logger,
        });

        return {
            pkg: pkg as PremiumPackage<unknown>,
            license,
            licenseSource: source,
            installedVersion: record.version,
            installedAt: record.installedAt,
            transitions,
        };
    }

    async function resolve(env: Env, key: string): Promise<PremiumResolution | null> {
        const pkg = byKey.get(key);
        if (!pkg) return null;

        const cacheKey = cacheKeyFor(env, key);
        const cached = cache.get(cacheKey);
        const now = Date.now();
        if (cached && cached.expiresAtMs > now) {
            return cached.resolution;
        }

        const resolution = await resolveUncached(env, pkg);
        cache.set(cacheKey, { resolution, expiresAtMs: now + cacheTtlMs });
        return resolution;
    }

    function toStatus(resolution: PremiumResolution): PremiumPackageStatus {
        const pkg = resolution.pkg;
        const { state, reason, claims } = resolution.license;
        return {
            key: pkg.key,
            name: pkg.name,
            version: pkg.version,
            description: pkg.description,
            vendor: pkg.vendor,
            docsUrl: pkg.docsUrl,
            purchaseUrl: pkg.purchaseUrl,
            state,
            reason,
            enabled: isServingState(state),
            requiresLicense: Boolean(pkg.licensePublicKey),
            licenseSource: resolution.licenseSource,
            plan: claims?.plan ?? null,
            licensee: claims?.licensee ?? null,
            expiresAt: licenseExpiresAt(claims),
            features: resolveFeatures(pkg, claims, state),
            limits: resolveLimits(pkg, claims, state),
            installedVersion: resolution.installedVersion,
            installedAt: resolution.installedAt,
            nav: pkg.nav ?? [],
        };
    }

    async function statusOf(env: Env, key: string): Promise<PremiumPackageStatus | null> {
        const resolution = await resolve(env, key);
        return resolution ? toStatus(resolution) : null;
    }

    async function gate(
        env: Env,
        key: string,
        run: (resolution: PremiumResolution) => PremiumGateAnswer,
    ): Promise<PremiumGateAnswer> {
        const resolution = await resolve(env, key);
        if (!resolution) {
            // An unknown key is a wiring bug, and it fails CLOSED: a typo in a gate call must
            // not silently unlock the feature it was meant to protect.
            return { allowed: false, upsell: false, reason: 'PACKAGE_UNKNOWN', state: 'disabled' };
        }
        return run(resolution);
    }

    return {
        packages,

        get(key) {
            return byKey.get(key) ?? null;
        },

        resolve,

        async isActive(env, key) {
            const resolution = await resolve(env, key);
            return resolution ? isServingState(resolution.license.state) : false;
        },

        status: statusOf,

        async statuses(env) {
            const resolved = await Promise.all(packages.map((pkg) => resolve(env, pkg.key)));
            return resolved.filter((entry): entry is PremiumResolution => entry !== null).map(toStatus);
        },

        feature(env, key, feature) {
            return gate(env, key, (resolution) =>
                checkFeature(
                    { pkg: resolution.pkg, claims: resolution.license.claims, state: resolution.license.state },
                    feature,
                ),
            );
        },

        limit(env, key, limitKey, current) {
            return gate(env, key, (resolution) =>
                checkLimit(
                    { pkg: resolution.pkg, claims: resolution.license.claims, state: resolution.license.state },
                    limitKey,
                    current,
                ),
            );
        },

        async activate(env, key, token) {
            const pkg = byKey.get(key);
            if (!pkg) return null;
            const store = storeFor(env);
            const existing = await store.get(key);

            // Verify before replacing the stored key. An activation endpoint is where a
            // tired operator pastes the wrong token; that must return an actionable 422,
            // not take a currently-working package down by overwriting its license.
            const candidate = await verifyPackageLicense(env, pkg, token.trim());
            if (!isServingState(candidate.state)) {
                return toStatus({
                    pkg: pkg as PremiumPackage<unknown>,
                    license: candidate,
                    licenseSource: null,
                    installedVersion: existing?.version ?? null,
                    installedAt: existing?.installedAt ?? null,
                    transitions: [],
                });
            }

            const now = Date.now();
            await store.set(key, {
                version: existing?.version ?? pkg.version,
                installedAt: existing?.installedAt ?? now,
                updatedAt: now,
                license: token.trim(),
                lastState: existing?.lastState,
            });
            invalidatePackage(key);
            return statusOf(env, key);
        },

        async deactivate(env, key) {
            const pkg = byKey.get(key);
            if (!pkg) return null;
            const store = storeFor(env);
            const existing = await store.get(key);
            if (existing) {
                await store.set(key, { ...existing, license: null, updatedAt: Date.now() });
            }
            invalidatePackage(key);
            return statusOf(env, key);
        },

        async uninstall(env, key) {
            const pkg = byKey.get(key);
            if (!pkg) return false;
            const resolution = await resolve(env, key);
            await applyUninstall({
                pkg,
                env,
                license: resolution?.license ?? {
                    state: 'unlicensed',
                    reason: 'LICENSE_MISSING',
                    claims: null,
                    expiresIn: null,
                },
                store: storeFor(env),
                logger: options.logger,
            });
            invalidatePackage(key);
            return true;
        },

        invalidate(key) {
            invalidatePackage(key);
        },

        // ── Contributions ─────────────────────────────────────────
        // Static: they describe what the package CAN add, and are read at boot (migrations,
        // model registry) where no request env exists to verify a license against. The
        // license gate lives on the request path, where it belongs.
        tables: () => collectPremiumTables(packages, [...disabled]),
        migrations: () => collectPremiumMigrations(packages, [...disabled]),
        models: () => collectPremiumModels(packages, [...disabled]),
        policies: () => collectPremiumPolicies(packages, [...disabled]),
        nav: () => collectPremiumNav(packages, [...disabled]),
    };
}

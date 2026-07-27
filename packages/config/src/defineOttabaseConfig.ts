// ============================================================
// defineOttabaseConfig — Validates and normalizes user config
// ============================================================
// Single source of truth for: packages, features, migrations, routes.
// ============================================================

import type {
    AuthBehaviorConfig,
    BuiltInPackageName,
    CrudHubFeatureConfig,
    OttabaseConfig,
    OttabaseConfigInput,
    OttablogFeatureConfig,
    OttablogMode,
    OttaaiFeatureConfig,
    PaginationFeatureConfig,
    ReferralsFeatureConfig,
    SpotlightFeatureConfig,
} from './ottabase-types';
import { BUILT_IN_PACKAGES, DEFAULT_REFERRAL_PARAM, normalizeReferralParam } from './ottabase-types';

const DEFAULT_REFERRALS: ReferralsFeatureConfig = {
    enabled: false,
    trackClicks: true,
    expiryDays: 30,
    referralParam: DEFAULT_REFERRAL_PARAM,
};

const DEFAULT_SPOTLIGHT: SpotlightFeatureConfig = {
    enabled: true,
    shortcuts: ['/'],
};

const DEFAULT_PAGINATION: PaginationFeatureConfig = {
    defaultPageSize: 10,
    maxPageSize: 100,
    sizeOptions: [5, 10, 20, 50, 100],
};

const DEFAULT_CRUDHUB: CrudHubFeatureConfig = {
    apiBaseUrl: '/api/crudhub',
    urlBase: 'crudhub',
    urlBaseListing: 'browse',
};

const DEFAULT_AUTH_BEHAVIOR: AuthBehaviorConfig = {
    sessionMaxAge: 30 * 24 * 60 * 60, // 30 days in seconds
    requireEmailVerified: false,
    disableCredentials: false,
    verbose: false,
};

const DEFAULT_OTTABLOG: OttablogFeatureConfig = {
    mode: 'platform',
};

/** Coerce an ottablog mode value; anything other than 'org' resolves to 'platform'. */
export function normalizeOttablogMode(value: unknown): OttablogMode {
    return value === 'org' ? 'org' : 'platform';
}

/**
 * AI provisioning defaults. FROZEN AT MAJOR — changing `mode` or `strategy` in a minor
 * silently re-points which key a tenant's calls use, with no error and no diff a consumer
 * would notice. The effective set is logged once at boot (see `worker/lib/ai.ts`).
 */
const DEFAULT_OTTAAI: OttaaiFeatureConfig = {
    mode: 'auto',
    strategy: 'user-then-org',
    appScope: 'strict',
    byokEnabled: true,
    allowOrgCredentials: true,
    // Deliberately generous per seat, deliberately tight app-wide: a single user looping is
    // an accident, a whole app sustaining 600 calls/minute on the operator's platform key is
    // an incident. Tune per product; these exist so an unconfigured deployment is not
    // unbounded.
    rateLimit: { perUser: 20, perOrganization: 120, perApp: 600 },
    gateway: null,
    platformProvider: null,
    platformModel: null,
};

/**
 * Coerce one rate-limit dimension. Negative or non-finite input falls back.
 *
 * EXPORTED so the ENV-OVERRIDE path applies the identical rule. It did not, once: config
 * clamped negatives here while `resolveConfigWithEnv` passed `parseInt` output straight
 * through, so `OTTAAI_RATE_LIMIT_PER_APP=-1` produced a negative limit that then read as
 * "dimension disabled" — silently removing the only aggregate ceiling on operator spend.
 * Two code paths, one rule.
 */
export function normalizeRateLimit(value: unknown, fallback: number): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return Math.floor(parsed);
}

/** Coerce an AI mode; anything unrecognised resolves to the default. */
export function normalizeOttaaiMode(value: unknown): OttaaiFeatureConfig['mode'] {
    return value === 'platform' || value === 'byok' || value === 'auto' ? value : DEFAULT_OTTAAI.mode;
}

/** Coerce an AI strategy; anything unrecognised resolves to the default. */
export function normalizeOttaaiStrategy(value: unknown): OttaaiFeatureConfig['strategy'] {
    return value === 'user' || value === 'org' || value === 'org-then-user' || value === 'user-then-org'
        ? value
        : DEFAULT_OTTAAI.strategy;
}

const DEFAULT_PACKAGES: Record<BuiltInPackageName, boolean> = {
    comments: true,
    ottablog: true,
    // Dormant by default: a deployment with no keys at all must boot, serve, and simply
    // not show the AI affordances. Enable it explicitly in ottabase.config.ts.
    ottaai: false,
    shortlinks: true,
    referrals: true,
};

/** Known top-level keys. Unrecognised keys trigger a console warning. */
const KNOWN_KEYS = new Set([
    'appId',
    'appName',
    'meta',
    'storage',
    'packages',
    'customPackages',
    'features',
    'email',
    'ui',
]);

/**
 * Validates and normalizes user config. Throws on missing required fields.
 * Warns on unrecognised keys.
 */
export function defineOttabaseConfig(input: OttabaseConfigInput): OttabaseConfig {
    // Required fields
    if (!input?.appId || typeof input.appId !== 'string') {
        throw new Error('ottabase.config: appId is required and must be a non-empty string');
    }
    if (!input?.appName || typeof input.appName !== 'string') {
        throw new Error('ottabase.config: appName is required and must be a non-empty string');
    }

    // Warn on unknown keys
    const inputKeys = Object.keys(input);
    for (const key of inputKeys) {
        if (!KNOWN_KEYS.has(key)) {
            console.warn(`[ottabase.config] Unrecognised key "${key}" — did you mean something else?`);
        }
    }

    // Merge packages: user overrides on top of defaults
    const packages: Record<BuiltInPackageName, boolean> = { ...DEFAULT_PACKAGES };
    if (input.packages && typeof input.packages === 'object') {
        for (const pkg of BUILT_IN_PACKAGES) {
            if (input.packages[pkg] !== undefined) {
                packages[pkg] = Boolean(input.packages[pkg]);
            }
        }
    }

    // Merge features with defaults.
    // ANNOTATED, not inferred: without the annotation TypeScript widens the appScope
    // ternary to ` string ` and the OttabaseConfig assignment below fails.
    const ottaai: OttaaiFeatureConfig = {
        mode: normalizeOttaaiMode(input.features?.ottaai?.mode ?? DEFAULT_OTTAAI.mode),
        strategy: normalizeOttaaiStrategy(input.features?.ottaai?.strategy ?? DEFAULT_OTTAAI.strategy),
        appScope: input.features?.ottaai?.appScope === 'wildcard' ? 'wildcard' : 'strict',
        byokEnabled: input.features?.ottaai?.byokEnabled ?? DEFAULT_OTTAAI.byokEnabled,
        allowOrgCredentials: input.features?.ottaai?.allowOrgCredentials ?? DEFAULT_OTTAAI.allowOrgCredentials,
        rateLimit: {
            perUser: normalizeRateLimit(input.features?.ottaai?.rateLimit?.perUser, DEFAULT_OTTAAI.rateLimit.perUser),
            perOrganization: normalizeRateLimit(
                input.features?.ottaai?.rateLimit?.perOrganization,
                DEFAULT_OTTAAI.rateLimit.perOrganization,
            ),
            perApp: normalizeRateLimit(input.features?.ottaai?.rateLimit?.perApp, DEFAULT_OTTAAI.rateLimit.perApp),
        },
        gateway: input.features?.ottaai?.gateway ?? DEFAULT_OTTAAI.gateway,
        platformProvider: input.features?.ottaai?.platformProvider ?? DEFAULT_OTTAAI.platformProvider,
        platformModel: input.features?.ottaai?.platformModel ?? DEFAULT_OTTAAI.platformModel,
    };

    const referrals = { ...DEFAULT_REFERRALS, ...input.features?.referrals };
    referrals.referralParam = normalizeReferralParam(referrals.referralParam);
    const features = {
        referrals,
        spotlight: { ...DEFAULT_SPOTLIGHT, ...input.features?.spotlight },
        pagination: { ...DEFAULT_PAGINATION, ...input.features?.pagination },
        crudHub: { ...DEFAULT_CRUDHUB, ...input.features?.crudHub },
        authBehavior: { ...DEFAULT_AUTH_BEHAVIOR, ...input.features?.authBehavior },
        ottablog: {
            ...DEFAULT_OTTABLOG,
            mode: normalizeOttablogMode(input.features?.ottablog?.mode ?? DEFAULT_OTTABLOG.mode),
        },
        ottaai,
    };

    const meta = {
        description: input.meta?.description ?? '',
        author: input.meta?.author ?? '',
        keywords: input.meta?.keywords ?? '',
        companyName: input.meta?.companyName ?? '',
        logoUrl: input.meta?.logoUrl ?? '/logo.png',
        title: input.meta?.title ?? input.appName,
        robots: input.meta?.robots ?? 'index, follow',
        tagline: input.meta?.tagline ?? '',
    };

    const config: OttabaseConfig = {
        appId: input.appId,
        appName: input.appName,
        meta,
        storage: {
            prefix: input.storage?.prefix ?? 'ottabase',
        },
        packages,
        customPackages: input.customPackages ?? {},
        features,
        email: {
            from: input.email?.from ?? 'noreply@example.com',
            sesRegion: input.email?.sesRegion ?? 'us-east-1',
        },
        ui: {
            preventFOUC: input.ui?.preventFOUC ?? false,
            preventFOUCInsideIframe: input.ui?.preventFOUCInsideIframe ?? false,
            debounceMs: input.ui?.debounceMs ?? 500,
            layout: input.ui?.layout ?? { minWidth: 320, maxWidth: 1280 },
            enforceGoogleFonts: input.ui?.enforceGoogleFonts ?? true,
        },
    };

    return config;
}

/**
 * Check if a built-in package is enabled.
 */
export function isPackageEnabled(config: OttabaseConfig, packageName: BuiltInPackageName): boolean {
    return config.packages[packageName] === true;
}

/**
 * Check if a custom package is registered.
 */
export function isCustomPackageEnabled(config: OttabaseConfig, packageName: string): boolean {
    return packageName in config.customPackages && !!config.customPackages[packageName];
}

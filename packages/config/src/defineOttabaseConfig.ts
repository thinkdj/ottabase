// ============================================================
// defineOttabaseConfig — Validates and normalizes user config
// ============================================================
// Single source of truth for: packages, features, migrations, routes.
// ============================================================

import type {
    OttabaseConfig,
    OttabaseConfigInput,
    ReferralsFeatureConfig,
    SpotlightFeatureConfig,
    PaginationFeatureConfig,
    CrudHubFeatureConfig,
    AuthBehaviorConfig,
    BuiltInPackageName,
} from './ottabase-types';
import { BUILT_IN_PACKAGES } from './ottabase-types';

const DEFAULT_REFERRALS: ReferralsFeatureConfig = {
    enabled: false,
    trackClicks: true,
    expiryDays: 30,
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

const DEFAULT_PACKAGES: Record<BuiltInPackageName, boolean> = {
    ottablog: true,
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

    // Merge features with defaults
    const features = {
        referrals: { ...DEFAULT_REFERRALS, ...input.features?.referrals },
        spotlight: { ...DEFAULT_SPOTLIGHT, ...input.features?.spotlight },
        pagination: { ...DEFAULT_PAGINATION, ...input.features?.pagination },
        crudHub: { ...DEFAULT_CRUDHUB, ...input.features?.crudHub },
        authBehavior: { ...DEFAULT_AUTH_BEHAVIOR, ...input.features?.authBehavior },
    };

    const meta = {
        description: input.meta?.description ?? '',
        author: input.meta?.author ?? '',
        keywords: input.meta?.keywords ?? '',
        companyName: input.meta?.companyName ?? '',
        logoUrl: input.meta?.logoUrl ?? '/logo.png',
        title: input.meta?.title ?? input.appName,
        robots: input.meta?.robots ?? 'index, follow',
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

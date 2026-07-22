// ============================================================
// Ottabase Config Types — Dynamic package & feature configuration
// ============================================================
// Used by defineOttabaseConfig() for single-source-of-truth config
// that drives: migrations, routes, features, and UI.
// ============================================================

export interface OttabaseMeta {
    description?: string;
    author?: string;
    keywords?: string;
    companyName?: string;
    /** Logo URL (default: '/logo.png') */
    logoUrl?: string;
    /** Page title (default: appName) */
    title?: string;
    /** Robots directive (default: 'index, follow') */
    robots?: string;
}

export interface ReferralsFeatureConfig {
    enabled: boolean;
    trackClicks: boolean;
    expiryDays: number;
    /**
     * URL query-param key that carries an inbound referral code, e.g. `ref` in
     * `https://app.example.com/?ref=johndoe`. Change it to rebrand share links
     * (`?invite=`, `?r=`, …). Overridable per deploy via the REFERRAL_PARAM env var.
     * Default: `ref`.
     */
    referralParam: string;
}

/** Default inbound referral query-param key. */
export const DEFAULT_REFERRAL_PARAM = 'ref';

/**
 * Normalize a referral param key to something URL-safe. A query-param name with
 * spaces/`=`/`&`/`?`/`#` would break link building and parsing, so anything that
 * isn't a letter, digit, underscore, or hyphen falls back to the default.
 */
export function normalizeReferralParam(value: string | undefined | null): string {
    if (typeof value !== 'string') return DEFAULT_REFERRAL_PARAM;
    const trimmed = value.trim();
    return /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : DEFAULT_REFERRAL_PARAM;
}

export interface SpotlightFeatureConfig {
    enabled: boolean;
    shortcuts: string[];
}

export interface PaginationFeatureConfig {
    defaultPageSize: number;
    maxPageSize: number;
    sizeOptions: number[];
}

export interface CrudHubFeatureConfig {
    apiBaseUrl: string;
    urlBase: string;
    urlBaseListing: 'list' | 'browse';
}

export interface AuthBehaviorConfig {
    sessionMaxAge: number;
    requireEmailVerified: boolean;
    disableCredentials: boolean;
    verbose: boolean;
}

/**
 * Blog tenancy mode.
 * - 'platform' (default): one blog per app, owned by the platform. Today's behavior, unchanged.
 * - 'org': each organization gets its own blog namespace — org-scoped slugs, taxonomy, and theme.
 *   Rows with a null organizationId remain platform-owned content.
 */
export type OttablogMode = 'platform' | 'org';

export interface OttablogFeatureConfig {
    mode: OttablogMode;
}

export interface OttabaseFeaturesConfig {
    referrals?: ReferralsFeatureConfig;
    spotlight?: SpotlightFeatureConfig;
    pagination?: PaginationFeatureConfig;
    crudHub?: CrudHubFeatureConfig;
    authBehavior?: AuthBehaviorConfig;
    ottablog?: Partial<OttablogFeatureConfig>;
}

export interface OttabaseEmailConfig {
    from: string;
    sesRegion?: string;
}

export interface OttabaseUIConfig {
    preventFOUC?: boolean;
    preventFOUCInsideIframe?: boolean;
    debounceMs?: number;
    layout?: { minWidth: number; maxWidth: number };
    enforceGoogleFonts?: boolean;
}

/**
 * Sentinel value for the x-org-id header / org selection meaning "act in PLATFORM
 * scope" (organizationId NULL — platform-owned rows such as the platform's own
 * blog in org mode). Honored server-side only for platform admins; never a valid
 * organization id. Shared by the API client, the org switcher, and the worker.
 */
export const PLATFORM_ORG_SENTINEL = 'platform';

/** Built-in package keys. Extend when adding new built-in packages. brandEngine is core, not a package. */
export const BUILT_IN_PACKAGES = ['comments', 'ottablog', 'referrals', 'shortlinks'] as const;

export type BuiltInPackageName = (typeof BUILT_IN_PACKAGES)[number];

/** Custom package config: maps package key to its table definitions (for migrations). */
export interface CustomPackageConfig {
    tables: Record<string, unknown>;
    migrations?: unknown[];
}

/** User input for defineOttabaseConfig — partial, with optional packages. */
export interface OttabaseConfigInput {
    appId: string;
    appName: string;
    meta?: OttabaseMeta;
    storage?: { prefix?: string };
    packages?: Partial<Record<BuiltInPackageName, boolean>>;
    customPackages?: Record<string, CustomPackageConfig>;
    features?: OttabaseFeaturesConfig;
    email?: OttabaseEmailConfig;
    ui?: OttabaseUIConfig;
}

/** Resolved full config — all optional fields have defaults. */
export interface OttabaseConfig {
    appId: string;
    appName: string;
    meta: {
        description: string;
        author: string;
        keywords: string;
        companyName: string;
        logoUrl: string;
        title: string;
        robots: string;
    };
    storage: { prefix: string };
    packages: Record<BuiltInPackageName, boolean>;
    customPackages: Record<string, CustomPackageConfig>;
    features: {
        referrals: ReferralsFeatureConfig;
        spotlight: SpotlightFeatureConfig;
        pagination: PaginationFeatureConfig;
        crudHub: CrudHubFeatureConfig;
        authBehavior: AuthBehaviorConfig;
        ottablog: OttablogFeatureConfig;
    };
    email: OttabaseEmailConfig;
    ui: OttabaseUIConfig;
}

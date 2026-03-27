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

export interface OttabaseFeaturesConfig {
    referrals?: ReferralsFeatureConfig;
    spotlight?: SpotlightFeatureConfig;
    pagination?: PaginationFeatureConfig;
    crudHub?: CrudHubFeatureConfig;
    authBehavior?: AuthBehaviorConfig;
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
    };
    email: OttabaseEmailConfig;
    ui: OttabaseUIConfig;
}

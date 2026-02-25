export type SupportedUIFramework = 'mantine' | 'shadcn' | 'chakra' | 'mui' | 'tremor';

export interface AppMeta {
    appName: string;
    logoUrl: string;
    title: string;
    author: string;
    description: string;
    keywords: string;
    robots: string;
    copyrightText: string;
    companyName: string;
}

export type ThemeColors = Record<
    string,
    [string, string, string, string, string, string, string, string, string, string]
>;

export interface SpotlightConfig {
    enabled: boolean;
    shortcuts: string[];
}

export interface UILayout {
    minWidth: number;
    maxWidth: number;
}

export interface CrudHubConfig {
    apiBaseUrl: string;
    urlBase: string;
    urlBaseListing: 'list' | 'browse';
}

export interface AuthConfig {
    signInUrl: string;
    signOutUrl: string;
    preLaunchOptIn: boolean;
}

export interface PaginationConfig {
    defaultPageSize: number;
    maxPageSize: number;
    sizeOptions: number[];
}

export interface ReferralsConfig {
    enabled: boolean;
    trackClicks: boolean;
    expiryDays: number;
}

export interface AppConfig {
    /** Unique app identifier for multi-app database sharing */
    appId: string;
    meta: AppMeta;
    uiFramework: SupportedUIFramework;

    // UI Configuration
    ui: {
        preventFOUC: boolean;
        preventFOUCInsideIframe: boolean;
        debounceMs: number;
        layout: UILayout;
        enforceGoogleFonts: boolean;
    };

    // Theme Configuration
    theme: {
        colorDefault: string;
        colors: ThemeColors;
    };

    // Storage Configuration
    storage: {
        prefix: string;
    };

    // API Configuration
    api: {
        serverErrorHttpCode: number;
    };

    // Feature Configuration
    features: {
        /** Scope database queries/inserts by appId (for multi-app DB sharing) */
        scopeByAppId: boolean;
        spotlight: SpotlightConfig;
        crudHub: CrudHubConfig;
        auth: AuthConfig;
        pagination: PaginationConfig;
        referrals: ReferralsConfig;
    };

    // Model Configuration
    model: {
        defaultRelKey: string;
    };
}

export interface ConfigOptions {
    appName?: string;
    /** Unique app identifier for multi-app database sharing */
    appId?: string;
    defaults?: {
        meta?: Partial<AppMeta>;
        uiFramework?: SupportedUIFramework;
        ui?: Partial<AppConfig['ui']>;
        theme?: Partial<AppConfig['theme']>;
        storage?: Partial<AppConfig['storage']>;
        api?: Partial<AppConfig['api']>;
        features?: {
            /** Scope database queries/inserts by appId */
            scopeByAppId?: boolean;
            spotlight?: Partial<SpotlightConfig>;
            crudHub?: Partial<CrudHubConfig>;
            auth?: Partial<AuthConfig>;
            pagination?: Partial<PaginationConfig>;
            referrals?: Partial<ReferralsConfig>;
        };
        model?: Partial<AppConfig['model']>;
    };
    envPrefix?: string;
}

// ============================================================
// OttabaseUserConfig – the shape of `ottabase.config.ts`
// ============================================================

/** Built-in feature packages shipped with the monorepo */
export type BuiltinPackageName = 'ottablog' | 'shortlinks' | 'referrals' | 'brandEngine';

/**
 * A custom or premium package registration.
 * Tables are Drizzle table objects keyed by any string.
 * Keep table imports server-side (worker) only.
 */
export interface OttabaseCustomPackage {
    /** Drizzle table schema objects for this package (server-side only) */
    tables: Record<string, unknown>;
}

/**
 * Top-level user configuration for the Ottabase monorepo app.
 * Lives in `ottabase.config.ts` at the app root.
 *
 * This is the SINGLE file users edit.  Framework files can be freely
 * updated (git pull / zip replace) without touching this file.
 */
export interface OttabaseUserConfig {
    /** Unique app identifier (used for storage prefix, API headers, etc.) */
    appId: string;

    /** Human-readable app name */
    appName: string;

    /** SEO / branding metadata */
    meta?: Partial<Omit<AppMeta, 'appName'>>;

    /** UI / layout defaults */
    ui?: Partial<AppConfig['ui']>;

    /** Theme defaults */
    theme?: {
        /** Default active color name (must match a key in `theme.colors`) */
        colorDefault?: string;
        /** Custom Mantine-style 10-shade color palettes */
        colors?: ThemeColors;
    };

    /** Storage key prefix for localStorage/sessionStorage */
    storage?: Partial<AppConfig['storage']>;

    /**
     * Toggle built-in packages on/off.
     * Missing keys default to `false` (disabled).
     */
    packages?: Partial<Record<BuiltinPackageName, boolean>>;

    /**
     * Register custom or premium packages.
     * The key becomes the package name in the migration registry.
     * Table schemas should only be imported in server/worker code.
     *
     * @example
     * ```ts
     * customPackages: {
     *   myPremiumFeature: {
     *     tables: { premiumTable },
     *   },
     * }
     * ```
     */
    customPackages?: Record<string, OttabaseCustomPackage>;

    /** Fine-grained feature configuration */
    features?: {
        referrals?: Partial<ReferralsConfig>;
        spotlight?: Partial<SpotlightConfig>;
        pagination?: Partial<PaginationConfig>;
        crudHub?: Partial<CrudHubConfig>;
        auth?: Partial<AuthConfig>;
    };
}

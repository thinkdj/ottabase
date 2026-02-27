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

    // Theme Configuration (optional — Mantine demo uses @ottabase/ui-mantine; core uses BrandEngine)
    theme?: {
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

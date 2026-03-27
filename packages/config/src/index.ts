// Ottabase config (dynamic packages, features, routes)
export { defineOttabaseConfig, isPackageEnabled, isCustomPackageEnabled } from './defineOttabaseConfig';
export type {
    OttabaseConfig,
    OttabaseConfigInput,
    OttabaseMeta,
    ReferralsFeatureConfig,
    SpotlightFeatureConfig,
    PaginationFeatureConfig,
    CrudHubFeatureConfig,
    AuthBehaviorConfig,
    CustomPackageConfig,
    BuiltInPackageName,
    OttabaseFeaturesConfig,
    OttabaseEmailConfig,
    OttabaseUIConfig,
} from './ottabase-types';
export { BUILT_IN_PACKAGES } from './ottabase-types';
export { resolveConfigWithEnv, type EnvLike } from './resolveConfigWithEnv';

// Export types
export type {
    AppConfig,
    AppMeta,
    AuthConfig,
    ConfigOptions,
    CrudHubConfig,
    PaginationConfig,
    ReferralsConfig,
    SpotlightConfig,
    SupportedUIFramework,
    ThemeColors,
    UILayout,
} from './types';

// Export main functions
export { createAppConfig, createStorageKey, createThemeColors, getCurrentYear } from './createAppConfig';

// Import for internal use
import type { SupportedUIFramework, ThemeColors } from './types';

// Export constants and defaults
export const DEFAULT_UI_FRAMEWORK: SupportedUIFramework = 'mantine';
export const DEFAULT_APP_ID = 'ottabase-template-app';

export const DEFAULT_THEME_COLORS: ThemeColors = {
    primary: [
        '#f7eefb',
        '#ebdaf2',
        '#d6b0e6',
        '#c085dc',
        '#ae60d2',
        '#a349cc',
        '#9e3dca',
        '#8a30b3',
        '#7b29a0',
        '#6b218d',
    ],
    tremorBlue: [
        '#e5f3ff',
        '#cee2ff',
        '#9ec2fd',
        '#6aa1fa',
        '#3e84f6',
        '#2272f5',
        '#0d69f5',
        '#0058db',
        '#004ec5',
        '#0043af',
    ],
};

export const DEFAULT_UI_CONFIG = {
    preventFOUC: false,
    preventFOUCInsideIframe: false,
    debounceMs: 500,
    layout: {
        minWidth: 320,
        maxWidth: 1280,
    },
    enforceGoogleFonts: true,
} as const;

export const DEFAULT_SPOTLIGHT_CONFIG = {
    enabled: true,
    shortcuts: ['mod + K', 'mod + ?', '?', 'mod + /', '/'],
} as const;

export const DEFAULT_CRUDHUB_CONFIG = {
    apiBaseUrl: '/api/crudhub',
    urlBase: 'crudhub',
    urlBaseListing: 'browse' as const,
} as const;

export const DEFAULT_AUTH_CONFIG = {
    signInUrl: '/api/auth/signin',
    signOutUrl: '/api/auth/signout',
    preLaunchOptIn: false,
} as const;

export const DEFAULT_PAGINATION_CONFIG = {
    defaultPageSize: 10,
    maxPageSize: 100,
    sizeOptions: [5, 10, 20, 50, 100],
} as const;

export const DEFAULT_REFERRALS_CONFIG = {
    enabled: false,
    trackClicks: true,
    expiryDays: 30,
} as const;

// Common storage keys
export const STORAGE_KEYS = {
    THEME: 'theme',
    COLOR_SCHEME: 'color-scheme',
    USER_PREFERENCES: 'user-preferences',
    SIDEBAR_STATE: 'sidebar-state',
    SPOTLIGHT_HISTORY: 'spotlight-history',
    PAGINATION_SIZE: 'pagination-size',
} as const;

export { ENV_KEYS } from './env-keys';

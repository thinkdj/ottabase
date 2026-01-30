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

export const ENV_KEYS = {
    // App Identity
    APP_ID: 'APP_ID',

    // App Meta
    APP_NAME: 'APP_NAME',
    APP_TITLE: 'APP_TITLE',
    APP_DESCRIPTION: 'APP_DESCRIPTION',
    APP_LOGO_URL: 'APP_LOGO_URL',
    APP_AUTHOR: 'APP_AUTHOR',
    APP_KEYWORDS: 'APP_KEYWORDS',
    APP_COMPANY_NAME: 'APP_COMPANY_NAME',

    // UI Framework
    UI_FRAMEWORK: 'UI_FRAMEWORK',

    // UI Configuration
    PREVENT_FOUC: 'PREVENT_FOUC',
    PREVENT_FOUC_INSIDE_IFRAME: 'PREVENT_FOUC_INSIDE_IFRAME',
    UI_DEBOUNCE_MS: 'UI_DEBOUNCE_MS',
    ENFORCE_GOOGLE_FONTS: 'ENFORCE_GOOGLE_FONTS',

    // Theme
    THEME_COLOR_DEFAULT: 'THEME_COLOR_DEFAULT',

    // Features
    SPOTLIGHT_ENABLED: 'SPOTLIGHT_ENABLED',
    PRE_LAUNCH_OPT_IN: 'PRE_LAUNCH_OPT_IN',

    // API
    SERVER_ERROR_HTTP_CODE: 'SERVER_ERROR_HTTP_CODE',

    // CrudHub
    CRUDHUB_API_BASE_URL: 'CRUDHUB_API_BASE_URL',
    CRUDHUB_URL_BASE: 'CRUDHUB_URL_BASE',
    CRUDHUB_URL_BASE_LISTING: 'CRUDHUB_URL_BASE_LISTING',

    // Auth
    AUTH_SIGN_IN_URL: 'AUTH_SIGN_IN_URL',
    AUTH_SIGN_OUT_URL: 'AUTH_SIGN_OUT_URL',

    // Pagination
    PAGE_SIZE_DEFAULT: 'PAGE_SIZE_DEFAULT',
    PAGE_SIZE_MAX: 'PAGE_SIZE_MAX',

    // Referrals
    REFERRALS_ENABLED: 'REFERRALS_ENABLED',
    REFERRALS_TRACK_CLICKS: 'REFERRALS_TRACK_CLICKS',
    REFERRALS_EXPIRY_DAYS: 'REFERRALS_EXPIRY_DAYS',

    // Model
    MODEL_DEFAULT_REL_KEY: 'MODEL_DEFAULT_REL_KEY',

    // Storage
    STORAGE_PREFIX: 'STORAGE_PREFIX',
} as const;

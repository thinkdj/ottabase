import {
    createAppConfig,
    createThemeColors,
    DEFAULT_THEME_COLORS,
    OttabaseUserConfig,
    userConfigToOptions,
} from '@ottabase/config';
import userConfig from '../../../ottabase.config';

// Cast through OttabaseUserConfig to allow optional `colors` access on the
// narrowed type returned by defineOttabaseConfig.
const typedConfig = userConfig as OttabaseUserConfig;
const options = userConfigToOptions(typedConfig);

// Convert the root user config into createAppConfig options.
// userConfigToOptions bridges OttabaseUserConfig → ConfigOptions.
export const appConfig = createAppConfig({
    ...options,
    defaults: {
        ...options.defaults,
        // Merge in the full theme color palette (not settable via env vars)
        theme: {
            colorDefault: typedConfig.theme?.colorDefault ?? 'tremorBlue',
            colors: createThemeColors({
                ...DEFAULT_THEME_COLORS,
                ...typedConfig.theme?.colors,
            }),
        },
        model: {
            defaultRelKey: 'defaults',
        },
    },
});

// Freeze the config to prevent runtime mutations
Object.freeze(appConfig);

// Meta
export const APP_META = appConfig.meta;
export const UI_FRAMEWORK_DEFAULT = appConfig.uiFramework;

// App Info
export const APP_ID = appConfig.appId;
export const APP_NAME = APP_META.appName;
export const APP_TITLE = APP_META.title;
export const APP_DESCRIPTION = APP_META.description;

// UI
export const PREVENT_FOUC = appConfig.ui.preventFOUC;
export const PREVENT_FOUC_INSIDE_IFRAME = appConfig.ui.preventFOUCInsideIframe;
export const UI_DEBOUNCE_MS = appConfig.ui.debounceMs;
export const UI_LAYOUT = appConfig.ui.layout;
export const ENFORCE_GOOGLE_FONTS = appConfig.ui.enforceGoogleFonts;

// Storage
export const PREFIX_STORAGE_APP = `${appConfig.storage.prefix}.`;
export const STORAGE_PREFIX = appConfig.storage.prefix;

// API
export const SERVER_ERROR_HTTP_CODE = appConfig.api.serverErrorHttpCode;

// CrudHub
export const CRUDHUB_API_BASE_URL = appConfig.features.crudHub.apiBaseUrl;
export const CRUDHUB_URL_BASE = appConfig.features.crudHub.urlBase;
export const CRUDHUB_URL_BASE_LISTING = appConfig.features.crudHub.urlBaseListing;

// Model
export const MODEL_DEFAULT_REL_KEY = appConfig.model.defaultRelKey;

// Pagination
export const PAGE_SIZE_DEFAULT = appConfig.features.pagination.defaultPageSize;
export const PAGE_SIZE_MAX = appConfig.features.pagination.maxPageSize;
export const PAGE_SIZE_OPTIONS = appConfig.features.pagination.sizeOptions;

// Spotlight
export const SPOTLIGHT_CONFIG = appConfig.features.spotlight;

// Referrals
export const REFERRALS_CONFIG = appConfig.features.referrals;

// Auth behaviour
export const AUTH_BEHAVIOR_CONFIG = appConfig.features.authBehavior;

// Email (non-secret)
export const EMAIL_CONFIG = appConfig.email;

// Theme / Colors
export const THEME_COLOR_DEFAULT = appConfig.theme.colorDefault;
export const THEME_COLORS = appConfig.theme.colors;

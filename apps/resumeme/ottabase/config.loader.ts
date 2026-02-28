// ============================================================
// Config Loader — Single source: ottabase.config.ts
// ============================================================
// Precedence: ENV VAR >> config file >> default
// Secrets (AUTH_SECRET, OAuth keys, API keys) = env only, never in config.
//
// IMPORTANT — Static vs env-aware usage:
// - Exports below (APP_META, PACKAGES_ENABLED, etc.) use base config at module load.
// - Worker routes call getOttabaseConfig(env) and receive env overrides per request.
// - Client runs in browser with no access to Cloudflare env; uses static exports.
// - For per-request client config (multi-tenant), add GET /api/config returning resolved config.
// ============================================================

import {
    resolveConfigWithEnv,
    type AppConfig,
    type AppMeta,
    type EnvLike,
    type OttabaseConfig,
} from '@ottabase/config';
import ottabaseConfig from './ottabase.config';

const baseCfg = ottabaseConfig as OttabaseConfig;

/**
 * Resolved Ottabase config. Precedence: ENV >> config >> default.
 * Pass env (e.g. Cloudflare request env) when available for env overrides.
 */
export function getOttabaseConfig(env?: EnvLike): OttabaseConfig {
    return env ? resolveConfigWithEnv(baseCfg, env) : baseCfg;
}

// ── Derived: AppMeta (for Logo, headers, etc.) ──
const APP_META: AppMeta = {
    appName: baseCfg.appName,
    logoUrl: baseCfg.meta.logoUrl,
    title: baseCfg.meta.title,
    author: baseCfg.meta.author,
    description: baseCfg.meta.description,
    keywords: baseCfg.meta.keywords,
    robots: baseCfg.meta.robots,
    copyrightText: `© 2020-${new Date().getFullYear()} ${baseCfg.meta.companyName || baseCfg.meta.author}`,
    companyName: baseCfg.meta.companyName,
};

// ── Derived: appConfig (AppConfig shape for Logo, Providers) ──
export const appConfig: AppConfig = {
    appId: baseCfg.appId,
    meta: APP_META,
    uiFramework: 'mantine',
    ui: {
        preventFOUC: baseCfg.ui?.preventFOUC ?? false,
        preventFOUCInsideIframe: baseCfg.ui?.preventFOUCInsideIframe ?? false,
        debounceMs: baseCfg.ui?.debounceMs ?? 500,
        layout: baseCfg.ui?.layout ?? { minWidth: 320, maxWidth: 1280 },
        enforceGoogleFonts: baseCfg.ui?.enforceGoogleFonts ?? true,
    },
    storage: { prefix: baseCfg.storage.prefix },
    api: { serverErrorHttpCode: 500 },
    features: {
        scopeByAppId: false,
        spotlight: baseCfg.features.spotlight,
        crudHub: baseCfg.features.crudHub,
        auth: {
            signInUrl: '/api/auth/signin',
            signOutUrl: '/api/auth/signout',
            preLaunchOptIn: false,
        },
        pagination: baseCfg.features.pagination,
        referrals: baseCfg.features.referrals,
    },
    model: { defaultRelKey: 'defaults' },
};

Object.freeze(appConfig);

// ── Convenience exports (all from ottabase.config) ──
export { APP_META };
export const UI_FRAMEWORK_DEFAULT = appConfig.uiFramework;
export const APP_ID = appConfig.appId;
export const APP_NAME = APP_META.appName;
export const APP_TITLE = APP_META.title;
export const APP_DESCRIPTION = APP_META.description;

export const PREVENT_FOUC = appConfig.ui.preventFOUC;
export const PREVENT_FOUC_INSIDE_IFRAME = appConfig.ui.preventFOUCInsideIframe;
export const UI_DEBOUNCE_MS = appConfig.ui.debounceMs;
export const UI_LAYOUT = appConfig.ui.layout;
export const ENFORCE_GOOGLE_FONTS = appConfig.ui.enforceGoogleFonts;

export const PREFIX_STORAGE_APP = `${appConfig.storage.prefix}.`;
export const STORAGE_PREFIX = appConfig.storage.prefix;

export const SERVER_ERROR_HTTP_CODE = appConfig.api.serverErrorHttpCode;

export const CRUDHUB_API_BASE_URL = appConfig.features.crudHub.apiBaseUrl;
export const CRUDHUB_URL_BASE = appConfig.features.crudHub.urlBase;
export const CRUDHUB_URL_BASE_LISTING = appConfig.features.crudHub.urlBaseListing;

export const MODEL_DEFAULT_REL_KEY = appConfig.model.defaultRelKey;

export const PAGE_SIZE_DEFAULT = appConfig.features.pagination.defaultPageSize;
export const PAGE_SIZE_MAX = appConfig.features.pagination.maxPageSize;
export const PAGE_SIZE_OPTIONS = appConfig.features.pagination.sizeOptions;

export const SPOTLIGHT_CONFIG = appConfig.features.spotlight;
export const REFERRALS_CONFIG = appConfig.features.referrals;

// ── Package toggles (SSOT from ottabase.config.ts) ──
export const PACKAGES_ENABLED = baseCfg.packages;

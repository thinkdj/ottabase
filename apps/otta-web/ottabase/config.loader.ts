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
    tagline: baseCfg.meta.tagline,
    copyrightText: `© 2020-${new Date().getFullYear()} ${baseCfg.meta.companyName || baseCfg.meta.author}`,
    companyName: baseCfg.meta.companyName,
};

// ── Derived: appConfig (AppConfig shape for Logo, Providers) ──
export const appConfig: AppConfig = {
    appId: baseCfg.appId,
    meta: APP_META,
    uiFramework: 'mantine',
    ui: {
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
export const APP_ID = appConfig.appId;
export const APP_NAME = APP_META.appName;

export const REFERRALS_CONFIG = appConfig.features.referrals;
/**
 * AI provisioning dials, for the CLIENT.
 *
 * Non-secret only, and only ever a UX affordance: the authoritative gate is
 * `requireByok` on the server, implemented by the same resolver as the runtime path.
 * A browser-side flag stops nobody with a fetch call.
 */
export const OTTAAI_CONFIG = baseCfg.features.ottaai;

// Which packages are installed is not config: see ottabase/packages.ts (server) and
// src/ottabase/config/packages.ts (client), which derive PACKAGES_ENABLED from the one list.
export const MEDIA_LIBRARY_ENABLED = true; // Media is a core table, always available

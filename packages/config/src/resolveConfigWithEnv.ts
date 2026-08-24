// ============================================================
// Config Resolution — ENV >> config file >> default
// ============================================================
// Non-secret values: env var overrides config, config overrides default.
// Secrets (AUTH_SECRET, OAuth keys, API keys) must come from env only.
// ============================================================

import {
    normalizeOttaaiMode,
    normalizeOttaaiStrategy,
    normalizeOttablogMode,
    normalizeRateLimit,
} from './defineOttabaseConfig';
import { ENV_KEYS } from './env-keys';
import type { BuiltInPackageName, OttabaseConfig } from './ottabase-types';
import { BUILT_IN_PACKAGES, normalizeReferralParam } from './ottabase-types';

const PACKAGE_ENV_KEYS: Record<BuiltInPackageName, string> = {
    comments: ENV_KEYS.OTTABASE_PKG_COMMENTS,
    ottablog: ENV_KEYS.OTTABASE_PKG_OTTABLOG,
    ottaai: ENV_KEYS.OTTABASE_PKG_OTTAAI,
    shortlinks: ENV_KEYS.OTTABASE_PKG_SHORTLINKS,
    referrals: ENV_KEYS.OTTABASE_PKG_REFERRALS,
};

/** Env-like object (Cloudflare env, process.env, etc.). */
export type EnvLike = object;

function str(env: EnvLike | undefined, key: string): string | undefined {
    if (!env) return undefined;
    const v = Reflect.get(env, key);
    return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function bool(env: EnvLike | undefined, key: string): boolean | undefined {
    const v = str(env, key);
    if (v === undefined) return undefined;
    return v.toLowerCase() === 'true' || v === '1';
}

function num(env: EnvLike | undefined, key: string): number | undefined {
    const v = str(env, key);
    if (v === undefined) return undefined;
    const n = parseInt(v, 10);
    return isNaN(n) ? undefined : n;
}

/**
 * Merge env overrides onto config. Precedence: ENV >> config >> default.
 * Pass env when available (e.g. Cloudflare request env); omitting env returns config as-is.
 */
export function resolveConfigWithEnv(config: OttabaseConfig, env?: EnvLike): OttabaseConfig {
    if (!env) return config;

    const appId = str(env, ENV_KEYS.APP_ID) ?? config.appId;
    const appName = str(env, ENV_KEYS.APP_NAME) ?? config.appName;

    // Merge package toggles: ENV overrides config (OTTABASE_PKG_OTTABLOG, etc.)
    const packages = { ...config.packages };
    for (const pkg of BUILT_IN_PACKAGES) {
        const v = bool(env, PACKAGE_ENV_KEYS[pkg]);
        if (v !== undefined) packages[pkg] = v;
    }

    return {
        ...config,
        appId,
        appName,
        packages,
        meta: {
            ...config.meta,
            description: str(env, ENV_KEYS.APP_DESCRIPTION) ?? config.meta.description,
            author: str(env, ENV_KEYS.APP_AUTHOR) ?? config.meta.author,
            keywords: str(env, ENV_KEYS.APP_KEYWORDS) ?? config.meta.keywords,
            companyName: str(env, ENV_KEYS.APP_COMPANY_NAME) ?? config.meta.companyName,
            logoUrl: str(env, ENV_KEYS.APP_LOGO_URL) ?? config.meta.logoUrl,
            title: str(env, ENV_KEYS.APP_TITLE) ?? config.meta.title,
            robots: str(env, ENV_KEYS.APP_ROBOTS) ?? config.meta.robots,
        },
        storage: {
            prefix: str(env, ENV_KEYS.STORAGE_PREFIX) ?? config.storage.prefix,
        },
        features: {
            ...config.features,
            referrals: {
                enabled: bool(env, ENV_KEYS.REFERRALS_ENABLED) ?? config.features.referrals.enabled,
                trackClicks: bool(env, ENV_KEYS.REFERRALS_TRACK_CLICKS) ?? config.features.referrals.trackClicks,
                expiryDays: num(env, ENV_KEYS.REFERRALS_EXPIRY_DAYS) ?? config.features.referrals.expiryDays,
                referralParam: normalizeReferralParam(
                    str(env, ENV_KEYS.REFERRAL_PARAM) ?? config.features.referrals.referralParam,
                ),
            },
            spotlight: {
                ...config.features.spotlight,
                enabled: bool(env, ENV_KEYS.SPOTLIGHT_ENABLED) ?? config.features.spotlight.enabled,
            },
            pagination: {
                defaultPageSize: num(env, ENV_KEYS.PAGE_SIZE_DEFAULT) ?? config.features.pagination.defaultPageSize,
                maxPageSize: num(env, ENV_KEYS.PAGE_SIZE_MAX) ?? config.features.pagination.maxPageSize,
                sizeOptions: config.features.pagination.sizeOptions,
            },
            crudHub: {
                apiBaseUrl: str(env, ENV_KEYS.CRUDHUB_API_BASE_URL) ?? config.features.crudHub.apiBaseUrl,
                urlBase: str(env, ENV_KEYS.CRUDHUB_URL_BASE) ?? config.features.crudHub.urlBase,
                urlBaseListing:
                    (str(env, ENV_KEYS.CRUDHUB_URL_BASE_LISTING) as 'list' | 'browse') ??
                    config.features.crudHub.urlBaseListing,
            },
            authBehavior: {
                sessionMaxAge: num(env, 'AUTH_SESSION_MAX_AGE') ?? config.features.authBehavior.sessionMaxAge,
                requireEmailVerified:
                    bool(env, 'AUTH_REQUIRE_EMAIL_VERIFIED') ?? config.features.authBehavior.requireEmailVerified,
                disableCredentials:
                    bool(env, 'AUTH_DISABLE_CREDENTIALS') ?? config.features.authBehavior.disableCredentials,
                verbose: bool(env, 'AUTH_VERBOSE') ?? config.features.authBehavior.verbose,
            },
            ottablog: {
                mode: normalizeOttablogMode(str(env, ENV_KEYS.OTTABLOG_MODE) ?? config.features.ottablog.mode),
            },
            ottaai: {
                mode: normalizeOttaaiMode(str(env, ENV_KEYS.OTTAAI_MODE) ?? config.features.ottaai.mode),
                strategy: normalizeOttaaiStrategy(
                    str(env, ENV_KEYS.OTTAAI_STRATEGY) ?? config.features.ottaai.strategy,
                ),
                appScope:
                    (str(env, ENV_KEYS.OTTAAI_APP_SCOPE) ?? config.features.ottaai.appScope) === 'wildcard'
                        ? 'wildcard'
                        : 'strict',
                byokEnabled: bool(env, ENV_KEYS.OTTAAI_BYOK_ENABLED) ?? config.features.ottaai.byokEnabled,
                allowOrgCredentials:
                    bool(env, ENV_KEYS.OTTAAI_ALLOW_ORG_CREDENTIALS) ?? config.features.ottaai.allowOrgCredentials,
                rateLimit: {
                    // Env-overridable so an operator can tighten a live deployment WITHOUT a
                    // redeploy — which is what you want at 2am when one account is looping.
                    //
                    // NORMALISED THROUGH THE SAME FUNCTION as the config path: `num()` returns
                    // whatever `parseInt` produced, including negatives, and a negative limit
                    // reads downstream as "dimension disabled". An invalid override therefore
                    // falls back to the configured value rather than silently uncapping.
                    perUser: normalizeRateLimit(
                        num(env, ENV_KEYS.OTTAAI_RATE_LIMIT_PER_USER),
                        config.features.ottaai.rateLimit.perUser,
                    ),
                    perOrganization: normalizeRateLimit(
                        num(env, ENV_KEYS.OTTAAI_RATE_LIMIT_PER_ORG),
                        config.features.ottaai.rateLimit.perOrganization,
                    ),
                    perApp: normalizeRateLimit(
                        num(env, ENV_KEYS.OTTAAI_RATE_LIMIT_PER_APP),
                        config.features.ottaai.rateLimit.perApp,
                    ),
                },
                gateway: str(env, ENV_KEYS.OTTAAI_GATEWAY) ?? config.features.ottaai.gateway,
                platformProvider:
                    str(env, ENV_KEYS.OTTAAI_PLATFORM_PROVIDER) ?? config.features.ottaai.platformProvider,
                platformModel: str(env, ENV_KEYS.OTTAAI_PLATFORM_MODEL) ?? config.features.ottaai.platformModel,
            },
        },
        email: {
            from: str(env, 'EMAIL_FROM') ?? config.email.from,
            sesRegion: str(env, 'AWS_REGION') ?? config.email.sesRegion,
        },
        ui: {
            ...config.ui,
            preventFOUC: bool(env, ENV_KEYS.PREVENT_FOUC) ?? config.ui?.preventFOUC,
            preventFOUCInsideIframe:
                bool(env, ENV_KEYS.PREVENT_FOUC_INSIDE_IFRAME) ?? config.ui?.preventFOUCInsideIframe,
            debounceMs: num(env, ENV_KEYS.UI_DEBOUNCE_MS) ?? config.ui?.debounceMs,
            enforceGoogleFonts: bool(env, ENV_KEYS.ENFORCE_GOOGLE_FONTS) ?? config.ui?.enforceGoogleFonts,
        },
    };
}

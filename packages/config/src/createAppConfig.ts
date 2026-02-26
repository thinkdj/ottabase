import { AppConfig, AppMeta, ConfigOptions, OttabaseUserConfig, SupportedUIFramework, ThemeColors } from './types';

/**
 * Creates app configuration by merging environment variables with defaults
 * @param options Configuration options including app name and defaults
 * @returns Complete app configuration
 */
export function createAppConfig(options: ConfigOptions = {}): AppConfig {
    const {
        appName = 'Ottabase App',
        appId = 'ottabase-template-app',
        defaults = {},
        envPrefix = '', // No prefix by default (Cloudflare/TanStack compatible)
    } = options;

    // Helper function to get environment variable with fallback
    const getEnv = (key: string, fallback: string): string => {
        if (typeof process !== 'undefined' && process.env) {
            return process.env[`${envPrefix}${key}`] ?? fallback;
        }
        return fallback;
    };

    // Helper function to get boolean environment variable
    const getBoolEnv = (key: string, fallback: boolean): boolean => {
        if (typeof process !== 'undefined' && process.env) {
            const value = process.env[`${envPrefix}${key}`];
            if (value !== undefined) {
                return value.toLowerCase() === 'true';
            }
        }
        return fallback;
    };

    // Helper function to get number environment variable
    const getNumberEnv = (key: string, fallback: number): number => {
        if (typeof process !== 'undefined' && process.env) {
            const value = process.env[`${envPrefix}${key}`];
            if (value !== undefined) {
                const parsed = parseInt(value, 10);
                return isNaN(parsed) ? fallback : parsed;
            }
        }
        return fallback;
    };

    // Create app meta configuration
    const meta: AppMeta = {
        appName: getEnv('APP_NAME', defaults.meta?.appName ?? appName),
        logoUrl: getEnv('APP_LOGO_URL', defaults.meta?.logoUrl ?? '/logo.png'),
        title: getEnv('APP_TITLE', defaults.meta?.title ?? getEnv('APP_NAME', appName)),
        author: getEnv('APP_AUTHOR', defaults.meta?.author ?? '@thinkdj'),
        description: getEnv(
            'APP_DESCRIPTION',
            defaults.meta?.description ?? `A modern web application built with ${appName}`,
        ),
        keywords: getEnv('APP_KEYWORDS', defaults.meta?.keywords ?? 'React, Next.js, TypeScript, Mantine, Tailwind'),
        robots: getEnv('APP_ROBOTS', defaults.meta?.robots ?? 'index, follow'),
        copyrightText: getEnv(
            'APP_COPYRIGHT_TEXT',
            defaults.meta?.copyrightText ?? `© 2020-${new Date().getFullYear()} @thinkdj`,
        ),
        companyName: getEnv('APP_COMPANY_NAME', defaults.meta?.companyName ?? ''),
    };

    // Default theme colors
    const defaultThemeColors: ThemeColors = {
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

    // Create complete app configuration
    const config: AppConfig = {
        appId: getEnv('APP_ID', appId),
        meta,
        uiFramework: getEnv('UI_FRAMEWORK', defaults.uiFramework ?? 'mantine') as SupportedUIFramework,

        ui: {
            preventFOUC: getBoolEnv('PREVENT_FOUC', defaults.ui?.preventFOUC ?? false),
            preventFOUCInsideIframe: getBoolEnv(
                'PREVENT_FOUC_INSIDE_IFRAME',
                defaults.ui?.preventFOUCInsideIframe ?? false,
            ),
            debounceMs: getNumberEnv('UI_DEBOUNCE_MS', defaults.ui?.debounceMs ?? 500),
            layout: {
                minWidth: getNumberEnv('UI_LAYOUT_MIN_WIDTH', defaults.ui?.layout?.minWidth ?? 320),
                maxWidth: getNumberEnv('UI_LAYOUT_MAX_WIDTH', defaults.ui?.layout?.maxWidth ?? 1280),
            },
            enforceGoogleFonts: getBoolEnv('ENFORCE_GOOGLE_FONTS', defaults.ui?.enforceGoogleFonts ?? true),
        },

        theme: {
            colorDefault: getEnv('THEME_COLOR_DEFAULT', defaults.theme?.colorDefault ?? 'tremorBlue'),
            colors: defaults.theme?.colors ?? defaultThemeColors,
        },

        storage: {
            prefix: getEnv('STORAGE_PREFIX', defaults.storage?.prefix ?? appName.toLowerCase().replace(/\s+/g, '-')),
        },

        api: {
            serverErrorHttpCode: getNumberEnv('SERVER_ERROR_HTTP_CODE', defaults.api?.serverErrorHttpCode ?? 500),
        },

        features: {
            scopeByAppId: getBoolEnv('SCOPE_BY_APP_ID', defaults.features?.scopeByAppId ?? false),
            spotlight: {
                enabled: getBoolEnv('SPOTLIGHT_ENABLED', defaults.features?.spotlight?.enabled ?? true),
                shortcuts: defaults.features?.spotlight?.shortcuts ?? ['mod + K', 'mod + ?', '?', 'mod + /', '/'],
            },
            crudHub: {
                apiBaseUrl: getEnv('CRUDHUB_API_BASE_URL', defaults.features?.crudHub?.apiBaseUrl ?? '/api/crudhub'),
                urlBase: getEnv('CRUDHUB_URL_BASE', defaults.features?.crudHub?.urlBase ?? 'crudhub'),
                urlBaseListing: getEnv(
                    'CRUDHUB_URL_BASE_LISTING',
                    defaults.features?.crudHub?.urlBaseListing ?? 'browse',
                ) as 'list' | 'browse',
            },
            auth: {
                signInUrl: getEnv('AUTH_SIGN_IN_URL', defaults.features?.auth?.signInUrl ?? '/api/auth/signin'),
                signOutUrl: getEnv('AUTH_SIGN_OUT_URL', defaults.features?.auth?.signOutUrl ?? '/api/auth/signout'),
                preLaunchOptIn: getBoolEnv('PRE_LAUNCH_OPT_IN', defaults.features?.auth?.preLaunchOptIn ?? false),
            },
            pagination: {
                defaultPageSize: getNumberEnv(
                    'PAGE_SIZE_DEFAULT',
                    defaults.features?.pagination?.defaultPageSize ?? 10,
                ),
                maxPageSize: getNumberEnv('PAGE_SIZE_MAX', defaults.features?.pagination?.maxPageSize ?? 100),
                sizeOptions: defaults.features?.pagination?.sizeOptions ?? [5, 10, 20, 50, 100],
            },
            referrals: {
                enabled: getBoolEnv('REFERRALS_ENABLED', defaults.features?.referrals?.enabled ?? false),
                trackClicks: getBoolEnv('REFERRALS_TRACK_CLICKS', defaults.features?.referrals?.trackClicks ?? true),
                expiryDays: getNumberEnv('REFERRALS_EXPIRY_DAYS', defaults.features?.referrals?.expiryDays ?? 30),
            },
            authBehavior: {
                sessionMaxAge: getNumberEnv(
                    'AUTH_SESSION_MAX_AGE',
                    defaults.features?.authBehavior?.sessionMaxAge ?? 30 * 24 * 60 * 60,
                ),
                requireEmailVerified: getBoolEnv(
                    'AUTH_REQUIRE_EMAIL_VERIFIED',
                    defaults.features?.authBehavior?.requireEmailVerified ?? false,
                ),
                disableCredentials: getBoolEnv(
                    'AUTH_DISABLE_CREDENTIALS',
                    defaults.features?.authBehavior?.disableCredentials ?? false,
                ),
                verbose: getBoolEnv('AUTH_VERBOSE', defaults.features?.authBehavior?.verbose ?? false),
            },
        },

        email: {
            from: getEnv('EMAIL_FROM', defaults.email?.from ?? 'noreply@example.com'),
            sesRegion: getEnv('AWS_REGION', defaults.email?.sesRegion ?? 'us-east-1'),
        },

        model: {
            defaultRelKey: getEnv('MODEL_DEFAULT_REL_KEY', defaults.model?.defaultRelKey ?? 'defaults'),
        },
    };

    return config;
}

/**
 * Creates a storage key with the app prefix
 * @param config App configuration
 * @param key Storage key
 * @returns Prefixed storage key
 */
export function createStorageKey(config: AppConfig, key: string): string {
    return `${config.storage.prefix}.${key}`;
}

/**
 * Gets the current year for copyright text
 * @returns Current year
 */
export function getCurrentYear(): number {
    return new Date().getFullYear();
}

/**
 * Creates theme colors configuration
 * @param colors Custom theme colors
 * @returns Theme colors configuration
 */
export function createThemeColors(colors: ThemeColors = {}): ThemeColors {
    const defaultColors: ThemeColors = {
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

    return { ...defaultColors, ...colors };
}

// ── Config validation ────────────────────────────────────────────────────────

/** Known keys at each level of OttabaseUserConfig. `true` = open-ended (no nested check). */
const VALID_TOP_KEYS = new Set([
    'appId',
    'appName',
    'meta',
    'ui',
    'theme',
    'storage',
    'packages',
    'customPackages',
    'features',
    'email',
]);

const VALID_NESTED_KEYS: Record<string, Set<string>> = {
    meta: new Set(['description', 'author', 'keywords', 'robots', 'copyrightText', 'companyName', 'logoUrl', 'title']),
    ui: new Set(['preventFOUC', 'preventFOUCInsideIframe', 'debounceMs', 'layout', 'enforceGoogleFonts']),
    'ui.layout': new Set(['minWidth', 'maxWidth']),
    theme: new Set(['colorDefault', 'colors']),
    storage: new Set(['prefix']),
    packages: new Set(['ottablog', 'shortlinks', 'referrals', 'brandEngine']),
    features: new Set(['referrals', 'spotlight', 'pagination', 'crudHub', 'auth', 'authBehavior']),
    'features.referrals': new Set(['enabled', 'trackClicks', 'expiryDays']),
    'features.spotlight': new Set(['enabled', 'shortcuts']),
    'features.pagination': new Set(['defaultPageSize', 'maxPageSize', 'sizeOptions']),
    'features.crudHub': new Set(['apiBaseUrl', 'urlBase', 'urlBaseListing']),
    'features.auth': new Set(['signInUrl', 'signOutUrl', 'preLaunchOptIn']),
    'features.authBehavior': new Set(['sessionMaxAge', 'requireEmailVerified', 'disableCredentials', 'verbose']),
    email: new Set(['from', 'sesRegion']),
};

function checkUnknownKeys(obj: Record<string, unknown>, validKeys: Set<string>, path: string): string[] {
    const warnings: string[] = [];
    for (const key of Object.keys(obj)) {
        if (!validKeys.has(key)) {
            warnings.push(`Unknown key "${path ? path + '.' : ''}${key}" — possible typo (will be ignored)`);
        }
    }
    return warnings;
}

/**
 * Validates an OttabaseUserConfig at runtime.
 * Throws on missing required fields; returns warnings for unknown keys.
 */
export function validateOttabaseConfig(config: Record<string, unknown>): string[] {
    const warnings: string[] = [];

    // ── Required fields ──────────────────────────────────────
    if (!config.appId || typeof config.appId !== 'string') {
        throw new Error('ottabase.config.ts: "appId" is required and must be a non-empty string');
    }
    if (!config.appName || typeof config.appName !== 'string') {
        throw new Error('ottabase.config.ts: "appName" is required and must be a non-empty string');
    }

    // ── Top-level unknown keys ───────────────────────────────
    warnings.push(...checkUnknownKeys(config, VALID_TOP_KEYS, ''));

    // ── Nested unknown keys (2 levels deep) ──────────────────
    for (const [topKey, value] of Object.entries(config)) {
        if (value && typeof value === 'object' && !Array.isArray(value) && VALID_NESTED_KEYS[topKey]) {
            warnings.push(...checkUnknownKeys(value as Record<string, unknown>, VALID_NESTED_KEYS[topKey], topKey));

            // Go one more level for features.* and ui.layout
            for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
                const deepPath = `${topKey}.${nestedKey}`;
                if (
                    nestedValue &&
                    typeof nestedValue === 'object' &&
                    !Array.isArray(nestedValue) &&
                    VALID_NESTED_KEYS[deepPath]
                ) {
                    warnings.push(
                        ...checkUnknownKeys(
                            nestedValue as Record<string, unknown>,
                            VALID_NESTED_KEYS[deepPath],
                            deepPath,
                        ),
                    );
                }
            }
        }
    }

    return warnings;
}

/**
 * Helper for `ottabase.config.ts`.
 * Provides TypeScript autocomplete and **runtime validation** — throws on
 * missing required fields and warns on unrecognised keys (likely typos).
 *
 * @example
 * ```ts
 * // ottabase.config.ts
 * import { defineOttabaseConfig } from '@ottabase/config';
 *
 * export default defineOttabaseConfig({
 *   appId: 'my-app',
 *   appName: 'My SaaS App',
 *   packages: { ottablog: true, shortlinks: true, referrals: true },
 * });
 * ```
 */
export function defineOttabaseConfig<T extends OttabaseUserConfig>(config: T): T {
    const warnings = validateOttabaseConfig(config as unknown as Record<string, unknown>);
    for (const w of warnings) {
        console.warn(`[ottabase] ${w}`);
    }
    return config;
}

/**
 * Converts an `OttabaseUserConfig` into `ConfigOptions` accepted by `createAppConfig`.
 * Use this inside `src/ottabase/config/app.config.ts` to bridge the two.
 */
export function userConfigToOptions(userConfig: OttabaseUserConfig): ConfigOptions {
    return {
        appId: userConfig.appId,
        appName: userConfig.appName,
        defaults: {
            meta: userConfig.meta,
            ui: userConfig.ui,
            theme: userConfig.theme,
            storage: userConfig.storage,
            features: userConfig.features
                ? {
                      referrals: userConfig.features.referrals,
                      spotlight: userConfig.features.spotlight,
                      pagination: userConfig.features.pagination,
                      crudHub: userConfig.features.crudHub,
                      auth: userConfig.features.auth,
                      authBehavior: userConfig.features.authBehavior,
                  }
                : undefined,
            email: userConfig.email,
        },
    };
}

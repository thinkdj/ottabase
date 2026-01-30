import { AppConfig, AppMeta, ConfigOptions, SupportedUIFramework, ThemeColors } from './types';

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

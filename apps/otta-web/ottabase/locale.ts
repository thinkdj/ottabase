/**
 * Language and region defaults for this app. Shared by the worker (validation, sign-up defaults)
 * and the browser (i18n config, the Language and region card). Plain values, no imports.
 */

/** Languages this app ships translations for. A user's `locale` must start with one of these. */
export const SUPPORTED_LANGUAGES = ['en', 'es', 'fr', 'de'] as const;

/** Used when a person has no locale and the request gives none. */
export const DEFAULT_LOCALE = 'en';

/** Used when a person has no timezone and the request gives none. */
export const DEFAULT_TIMEZONE = 'UTC';

/**
 * Regions offered per language in the Language and region picker. The region only drives
 * number and date formats, so a short, familiar list per language is enough.
 */
export const LOCALE_REGIONS: Record<(typeof SUPPORTED_LANGUAGES)[number], readonly string[]> = {
    en: ['US', 'GB', 'IN', 'AU', 'CA', 'IE', 'NZ', 'SG', 'ZA'],
    es: ['ES', 'MX', 'AR', 'CO', 'CL', 'US'],
    fr: ['FR', 'CA', 'BE', 'CH'],
    de: ['DE', 'AT', 'CH'],
};

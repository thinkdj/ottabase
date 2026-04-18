import i18n, { type Resource } from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import deCommon from './locales/de/common.json';
import enCommon from './locales/en/common.json';
import esCommon from './locales/es/common.json';
import frCommon from './locales/fr/common.json';

// Import utilities
import { deepMerge } from './utils/deepMerge';

export const defaultNS = 'common';

export const resources = {
    en: {
        common: enCommon,
    },
    es: {
        common: esCommon,
    },
    fr: {
        common: frCommon,
    },
    de: {
        common: deCommon,
    },
} as const;

export type SupportedLanguage = keyof typeof resources;

export const supportedLanguages: SupportedLanguage[] = ['en', 'es', 'fr', 'de'];

export const languageNames: Record<SupportedLanguage, string> = {
    en: 'English',
    es: 'Español',
    fr: 'Français',
    de: 'Deutsch',
};

/** Default localStorage key for language persistence */
export const DEFAULT_LANGUAGE_STORAGE_KEY = 'ottabase.language';

export interface InitI18nOptions {
    /**
     * Default/fallback language when none is detected or persisted.
     * Precedence: localStorage → navigator → defaultLanguage. So defaultLanguage does not override detection.
     */
    defaultLanguage?: SupportedLanguage;
    /** Languages the app allows (constrains package supportedLanguages). If omitted, all package languages are used. */
    supportedLngs?: readonly string[];
    /** Fallback language when a translation is missing. Defaults to defaultLanguage or 'en'. */
    fallbackLng?: string;
    debug?: boolean;
    resources?: Resource;
    /** localStorage key for language detection/cache. Default: ottabase.language */
    lookupLocalStorage?: string;
}

let detectorAdded = false;

// Initialize i18next (without React bindings). Returns Promise so callers can await language/detection.
export const initI18n = async (options?: InitI18nOptions): Promise<typeof i18n> => {
    // Skip if already initialized (do not override language - preserve existing)
    if (i18n.isInitialized) {
        return i18n;
    }

    // Merge default resources with provided resources (only on first init)
    const finalResources = options?.resources ? deepMerge(resources, options.resources) : resources;

    const effectiveSupportedLngs = (
        options?.supportedLngs?.length ? [...options.supportedLngs] : supportedLanguages
    ) as string[];
    const effectiveFallbackLng = options?.fallbackLng ?? options?.defaultLanguage ?? 'en';

    // Add detector only once (safe when tests reset isInitialized and call init again)
    if (!detectorAdded) {
        i18n.use(LanguageDetector);
        detectorAdded = true;
    }

    await i18n.init({
        resources: finalResources,
        defaultNS,
        fallbackLng: effectiveFallbackLng,
        lng: undefined, // Let detector run first; defaultLanguage used only when nothing detected
        debug: options?.debug || false,
        interpolation: {
            escapeValue: false, // React already escapes values
        },
        supportedLngs: effectiveSupportedLngs,
        load: 'languageOnly', // Use only base language code (en, not en-US)
        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
            lookupLocalStorage: options?.lookupLocalStorage ?? DEFAULT_LANGUAGE_STORAGE_KEY,
        },
    });

    // Normalize to base code when detector returns a region (e.g. en-US -> en)
    if (i18n.language) {
        const base = i18n.language.split('-')[0];
        if (effectiveSupportedLngs.includes(base) && base !== i18n.language) {
            await i18n.changeLanguage(base);
        }
    }

    // Use defaultLanguage only when no valid language was detected or persisted (act as fallback, not override)
    const currentBase = i18n.language?.split('-')[0];
    const hasValidDetected = currentBase && effectiveSupportedLngs.includes(currentBase);
    if (options?.defaultLanguage && !hasValidDetected) {
        await i18n.changeLanguage(options.defaultLanguage);
    }

    return i18n;
};

export { i18n };
export default i18n;

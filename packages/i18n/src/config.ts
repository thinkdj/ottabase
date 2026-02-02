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

export interface InitI18nOptions {
    defaultLanguage?: SupportedLanguage;
    debug?: boolean;
    resources?: Resource;
}

// Initialize i18next (without React bindings). Returns Promise so callers can await language/detection.
export const initI18n = async (options?: InitI18nOptions): Promise<typeof i18n> => {
    // Skip if already initialized (do not override language - preserve existing)
    if (i18n.isInitialized) {
        return i18n;
    }

    // Merge default resources with provided resources (only on first init)
    const finalResources = options?.resources ? deepMerge(resources, options.resources) : resources;

    // Always use detector so changeLanguage() caches to localStorage
    i18n.use(LanguageDetector);

    await i18n.init({
        resources: finalResources,
        defaultNS,
        fallbackLng: options?.defaultLanguage || 'en',
        lng: options?.defaultLanguage ?? undefined,
        debug: options?.debug || false,
        interpolation: {
            escapeValue: false, // React already escapes values
        },
        supportedLngs: supportedLanguages,
        load: 'languageOnly', // Use only base language code (en, not en-US)
        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
            lookupLocalStorage: 'i18nextLng',
        },
    });

    // Normalize to base code when detector returns a region (e.g. en-US -> en)
    if (i18n.language) {
        const base = i18n.language.split('-')[0] as SupportedLanguage;
        if (supportedLanguages.includes(base) && base !== i18n.language) {
            await i18n.changeLanguage(base);
        }
    }

    // Force language when defaultLanguage was explicitly passed (in case init didn't set it)
    if (options?.defaultLanguage && i18n.language !== options.defaultLanguage) {
        await i18n.changeLanguage(options.defaultLanguage);
    }

    return i18n;
};

export { i18n };
export default i18n;

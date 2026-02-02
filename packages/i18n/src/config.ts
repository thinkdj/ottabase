import deepmerge from 'deepmerge';
import i18n, { type Resource } from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import deCommon from './locales/de/common.json';
import enCommon from './locales/en/common.json';
import esCommon from './locales/es/common.json';
import frCommon from './locales/fr/common.json';

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

// Initialize i18next (without React bindings)
export const initI18n = (options?: InitI18nOptions) => {
    // Skip if already initialized
    if (i18n.isInitialized) {
        return i18n;
    }

    // Merge default resources with provided resources (only on first init)
    const finalResources = options?.resources ? deepmerge(resources, options.resources) : resources;

    i18n.use(LanguageDetector).init({
        resources: finalResources,
        defaultNS,
        fallbackLng: options?.defaultLanguage || 'en',
        lng: options?.defaultLanguage,
        debug: options?.debug || false,
        interpolation: {
            escapeValue: false, // React already escapes values
        },
        supportedLngs: supportedLanguages,
        load: 'languageOnly', // Load only 'en' for 'en-US', 'en-GB', etc.
        detection: {
            order: ['localStorage', 'navigator'],
            caches: ['localStorage'],
            lookupLocalStorage: 'i18nextLng',
        },
    });

    return i18n;
};

export { i18n };
export default i18n;

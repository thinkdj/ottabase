import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translation files
import enCommon from './locales/en/common.json';
import esCommon from './locales/es/common.json';
import frCommon from './locales/fr/common.json';
import deCommon from './locales/de/common.json';

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

// Initialize i18next (without React bindings)
export const initI18n = (options?: { defaultLanguage?: SupportedLanguage; debug?: boolean }) => {
    i18n.use(LanguageDetector).init({
        resources,
        defaultNS,
        fallbackLng: options?.defaultLanguage || 'en',
        lng: options?.defaultLanguage,
        debug: options?.debug || false,
        interpolation: {
            escapeValue: false, // React already escapes values
        },
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

import type { SupportedLanguage } from '@ottabase/i18n/react';

/**
 * i18n Configuration
 * Defines the language settings for the application
 */
export interface I18nConfig {
    /** Default language to use on first load */
    defaultLanguage: SupportedLanguage;

    /**
     * Languages offered in the header switcher (a subset of the package languages). The switcher
     * only appears with two or more, so add a language once the app's own strings are translated,
     * not just the package's common ones.
     */
    enabledLanguages: SupportedLanguage[];

    /** Fallback language when translation is missing */
    fallbackLanguage: SupportedLanguage;
}

/**
 * Default i18n configuration
 */
export const i18nConfig: I18nConfig = {
    defaultLanguage: 'en',
    enabledLanguages: ['en'],
    fallbackLanguage: 'en',
};

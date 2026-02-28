import type { SupportedLanguage } from '@ottabase/i18n/react';

/**
 * i18n Configuration
 * Defines the language settings for the application
 */
export interface I18nConfig {
    /** Default language to use on first load */
    defaultLanguage: SupportedLanguage;

    /** Languages enabled for this app (subset of package languages) */
    enabledLanguages: SupportedLanguage[];

    /** Fallback language when translation is missing */
    fallbackLanguage: SupportedLanguage;
}

/**
 * Default i18n configuration
 */
export const i18nConfig: I18nConfig = {
    defaultLanguage: 'en',
    enabledLanguages: ['en', 'es', 'fr', 'de'],
    fallbackLanguage: 'en',
};

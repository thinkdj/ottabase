import type { SupportedLanguage } from '@ottabase/i18n/react';
import { DEFAULT_LOCALE, SUPPORTED_LANGUAGES } from '../../../ottabase/locale';

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
    defaultLanguage: DEFAULT_LOCALE as SupportedLanguage,
    // One list for the worker (locale validation, sign-up defaults) and the browser: ottabase/locale.ts
    enabledLanguages: [...SUPPORTED_LANGUAGES] as SupportedLanguage[],
    fallbackLanguage: DEFAULT_LOCALE as SupportedLanguage,
};

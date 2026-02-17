/**
 * @ottabase/i18n - Internationalization (i18n) package for Ottabase monorepo
 *
 * This package provides i18next configuration and utilities for internationalization.
 *
 * @example
 * ```ts
 * // For non-React usage
 * import { initI18n, i18n } from '@ottabase/i18n';
 * initI18n({ defaultLanguage: 'en' });
 * const translated = i18n.t('common:welcome');
 * ```
 *
 * @example
 * ```tsx
 * // For React apps
 * import { I18nProvider, useTranslation } from '@ottabase/i18n/react';
 *
 * function App() {
 *   return (
 *     <I18nProvider defaultLanguage="en">
 *       <YourApp />
 *     </I18nProvider>
 *   );
 * }
 *
 * function Component() {
 *   const { t } = useTranslation('common');
 *   return <h1>{t('welcome')}</h1>;
 * }
 * ```
 */

export {
    defaultNS,
    i18n,
    initI18n,
    DEFAULT_LANGUAGE_STORAGE_KEY,
    languageNames,
    resources,
    supportedLanguages,
    type InitI18nOptions,
    type SupportedLanguage,
} from './config';

import { type ReactNode, Suspense } from 'react';
import { initReactI18next, I18nextProvider } from 'react-i18next';
import { i18n, initI18n, type SupportedLanguage } from './config';

// Initialize i18next with React bindings
export const initReactI18n = (options?: { defaultLanguage?: SupportedLanguage; debug?: boolean }) => {
    // Only initialize if not already initialized
    if (!i18n.isInitialized) {
        i18n.use(initReactI18next);
        initI18n(options);
    }
    return i18n;
};

export interface I18nProviderProps {
    children: ReactNode;
    defaultLanguage?: SupportedLanguage;
    debug?: boolean;
    fallback?: ReactNode;
}

/**
 * I18nProvider wraps your app with i18next context
 *
 * @example
 * ```tsx
 * import { I18nProvider } from '@ottabase/i18n/react';
 *
 * function App() {
 *   return (
 *     <I18nProvider defaultLanguage="en">
 *       <YourApp />
 *     </I18nProvider>
 *   );
 * }
 * ```
 */
export function I18nProvider({ children, defaultLanguage, debug, fallback = null }: I18nProviderProps) {
    const i18nInstance = initReactI18n({ defaultLanguage, debug });

    return (
        <I18nextProvider i18n={i18nInstance}>
            <Suspense fallback={fallback}>{children}</Suspense>
        </I18nextProvider>
    );
}

// Re-export commonly used hooks and functions from react-i18next
export { useTranslation, Trans } from 'react-i18next';

// Re-export config utilities
export { i18n, resources, supportedLanguages, languageNames, type SupportedLanguage } from './config';

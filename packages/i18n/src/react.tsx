import { type ReactNode, Suspense } from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { i18n, initI18n, type InitI18nOptions } from './config';

// Initialize i18next with React bindings
export const initReactI18n = (options?: InitI18nOptions) => {
    if (!i18n.isInitialized) {
        // CRITICAL: Must add React plugin BEFORE calling initI18n
        i18n.use(initReactI18next);
        initI18n(options);
    }
    return i18n;
};

export interface I18nProviderProps extends InitI18nOptions {
    children: ReactNode;
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
export function I18nProvider({ children, defaultLanguage, debug, resources, fallback = null }: I18nProviderProps) {
    const i18nInstance = initReactI18n({ defaultLanguage, debug, resources });

    return (
        <I18nextProvider i18n={i18nInstance}>
            <Suspense fallback={fallback}>{children}</Suspense>
        </I18nextProvider>
    );
}

// Re-export commonly used hooks and functions from react-i18next
export { Trans, useTranslation } from 'react-i18next';

// Re-export config utilities
export { i18n, languageNames, resources, supportedLanguages, type SupportedLanguage } from './config';

import './types';

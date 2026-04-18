import { type ReactNode, Suspense, useEffect, useState } from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { i18n, initI18n, type InitI18nOptions } from './config';

// Initialize i18next with React bindings. Returns Promise so provider can wait for language/detection.
export const initReactI18n = async (options?: InitI18nOptions): Promise<typeof i18n> => {
    if (!i18n.isInitialized) {
        // CRITICAL: Must add React plugin BEFORE calling initI18n
        i18n.use(initReactI18next);
        await initI18n(options);
        return i18n;
    }
    // Already initialized: only apply defaultLanguage when current language is not in supported set (e.g. in tests)
    if (options?.defaultLanguage && options.supportedLngs?.length) {
        const currentBase = i18n.language?.split('-')[0];
        if (!currentBase || !options.supportedLngs.includes(currentBase)) {
            await i18n.changeLanguage(options.defaultLanguage);
        }
    } else if (options?.defaultLanguage && i18n.language !== options.defaultLanguage) {
        await i18n.changeLanguage(options.defaultLanguage);
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
export function I18nProvider({
    children,
    defaultLanguage,
    supportedLngs,
    fallbackLng,
    debug,
    resources,
    lookupLocalStorage,
    fallback = null,
}: I18nProviderProps) {
    const [ready, setReady] = useState(false);

    // Re-run when config that can affect init or already-initialized behavior changes.
    // resources omitted: often an inline object (new ref each render); apply once on mount or memoize in caller.
    useEffect(() => {
        initReactI18n({
            defaultLanguage,
            supportedLngs,
            fallbackLng,
            debug,
            resources,
            lookupLocalStorage,
        }).then(() => setReady(true));
    }, [defaultLanguage, supportedLngs, fallbackLng, debug, lookupLocalStorage]);

    if (!ready) {
        return <>{fallback}</>;
    }

    return (
        <I18nextProvider i18n={i18n}>
            <Suspense fallback={fallback}>{children}</Suspense>
        </I18nextProvider>
    );
}

// Re-export commonly used hooks and functions from react-i18next
export { Trans, useTranslation } from 'react-i18next';

// Re-export config utilities
export { i18n, languageNames, resources, supportedLanguages, type SupportedLanguage } from './config';

import './types';

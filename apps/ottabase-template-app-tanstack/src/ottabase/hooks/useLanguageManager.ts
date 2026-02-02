import { useTranslation } from '@ottabase/i18n/react';
import { useAtom } from 'jotai';
import { useEffect } from 'react';
import { languageAtom } from '../state/appState';

const LANGUAGE_STORAGE_KEY = 'ottabase-language';

/**
 * Syncs language between i18n and global state (Jotai atom).
 * Persists language to localStorage so appState.language stays the single source of truth.
 */
export function useLanguageManager(): void {
    const [language, setLanguage] = useAtom(languageAtom);
    const { i18n } = useTranslation();

    // Hydrate atom from localStorage once on mount (languageAtom is createAtom, no built-in persistence)
    useEffect(() => {
        const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (stored) {
            setLanguage(stored);
        }
    }, [setLanguage]);

    // Persist atom to localStorage when it changes
    useEffect(() => {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    }, [language]);

    // Sync atom -> i18n
    useEffect(() => {
        if (i18n.language !== language) {
            i18n.changeLanguage(language);
        }
    }, [language, i18n]);

    // Sync i18n -> atom (when changed via i18n directly)
    useEffect(() => {
        const handleLanguageChange = (lng: string) => {
            if (lng !== language) {
                setLanguage(lng);
            }
        };

        i18n.on('languageChanged', handleLanguageChange);

        return () => {
            i18n.off('languageChanged', handleLanguageChange);
        };
    }, [i18n, language, setLanguage]);
}

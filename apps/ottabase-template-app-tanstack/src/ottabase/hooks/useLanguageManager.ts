import { useTranslation } from '@ottabase/i18n/react';
import { useAtom } from 'jotai';
import { useEffect } from 'react';
import { languageAtom } from '../state/appState';

/**
 * Syncs language between i18n and global state (Jotai atom)
 * Similar to useThemeManager - keeps i18n and state in sync
 */
export function useLanguageManager(): void {
    const [language, setLanguage] = useAtom(languageAtom);
    const { i18n } = useTranslation();

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

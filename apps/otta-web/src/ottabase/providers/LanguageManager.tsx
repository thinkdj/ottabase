import { useLanguageManager } from '../hooks/useLanguageManager';

/**
 * LanguageManager component
 * Manages the syncing of language state between i18n and global state
 */
export function LanguageManager() {
    useLanguageManager();
    return null;
}

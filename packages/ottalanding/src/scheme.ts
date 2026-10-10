// Visitor light/dark choice: stored in localStorage, applied as `data-scheme` on <html>.

import { sanitizeJsonForScript } from '@ottabase/utils/sanitize';

export const SCHEME_STORAGE_KEY = 'ottalanding.scheme';

/**
 * Inline <head> script that applies the visitor's saved scheme before first paint, so a
 * dark-mode visitor never sees a light flash. Without a saved choice the theme's default
 * (rendered server-side as `data-scheme`) stays.
 */
export function schemeInitScript(): string {
    return `try{var s=localStorage.getItem(${sanitizeJsonForScript(SCHEME_STORAGE_KEY)});if(s==='light'||s==='dark')document.documentElement.setAttribute('data-scheme',s)}catch(e){}`;
}

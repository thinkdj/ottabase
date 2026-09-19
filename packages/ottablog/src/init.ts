/**
 * @ottabase/ottablog - Initialization
 *
 * Initialize default theme and setup hooks/plugins
 */

import { registerTheme, setActiveTheme } from './themes';
import { defaultTheme } from './themes/default';
import { linenTheme } from './themes/linen';
import { minimalTheme } from './themes/minimal';

/**
 * Initialize ottablog with default theme
 */
export function initOttablog(options?: { defaultThemeId?: string }) {
    // Register default theme
    registerTheme(defaultTheme);

    // Register minimal theme
    registerTheme(minimalTheme);

    // Register linen (personal blog) theme
    registerTheme(linenTheme);

    // Set active theme
    setActiveTheme(options?.defaultThemeId || 'linen');
}

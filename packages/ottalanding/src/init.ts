/**
 * @ottabase/ottalanding — Initialization
 *
 * Call initOttaLanding() at app startup to register default themes.
 * Custom themes can be registered before or after init.
 */

import { setActiveLandingTheme } from './themes/registry';

export interface OttaLandingInitOptions {
    /** Default theme ID to activate (defaults to first registered theme) */
    defaultThemeId?: string;
}

/**
 * Initialize ottalanding.
 *
 * This is intentionally minimal — themes are registered by the consuming
 * app via registerLandingTheme(). This function just sets the active theme.
 *
 * @example
 * ```ts
 * import { initOttaLanding, registerLandingTheme } from '@ottabase/ottalanding';
 * import { atlasTheme } from './themes/atlas';
 *
 * registerLandingTheme(atlasTheme);
 * initOttaLanding({ defaultThemeId: 'atlas' });
 * ```
 */
export function initOttaLanding(options?: OttaLandingInitOptions) {
    if (options?.defaultThemeId) {
        setActiveLandingTheme(options.defaultThemeId);
    }
}

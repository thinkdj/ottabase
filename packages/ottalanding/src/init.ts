/**
 * @ottabase/ottalanding — Initialization
 *
 * Call initOttaLanding() at app startup to register built-in themes.
 * Custom themes can be registered before or after init.
 */

import { atlasTheme } from './themes/atlas';
import { monoTheme } from './themes/mono';
import { saasTheme } from './themes/saas';
import { registerLandingTheme, setActiveLandingTheme } from './themes/registry';

export interface OttaLandingInitOptions {
    /** Default theme ID to activate (defaults to 'atlas') */
    defaultThemeId?: string;
}

/**
 * Initialize ottalanding — registers built-in themes and sets the active one.
 *
 * @example
 * ```ts
 * import { initOttaLanding } from '@ottabase/ottalanding';
 *
 * initOttaLanding(); // registers atlas + mono, activates atlas
 * initOttaLanding({ defaultThemeId: 'mono' }); // activates mono instead
 * ```
 */
export function initOttaLanding(options?: OttaLandingInitOptions) {
    registerLandingTheme(atlasTheme);
    registerLandingTheme(monoTheme);
    registerLandingTheme(saasTheme);
    setActiveLandingTheme(options?.defaultThemeId || 'atlas');
}

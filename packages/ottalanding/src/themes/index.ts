/**
 * @ottabase/ottalanding — Theme System
 */

export * from './types';
export {
    getAllLandingThemes,
    getActiveLandingTheme,
    getLandingTheme,
    hasLandingTheme,
    landingThemeRegistry,
    registerLandingTheme,
    setActiveLandingTheme,
} from './registry';
export { renderPage, renderSection } from './renderer';

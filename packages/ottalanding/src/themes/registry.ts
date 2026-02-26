/**
 * @ottabase/ottalanding — Theme Registry
 *
 * Global registry for landing page themes.
 * Follows the same pattern as @ottabase/ottablog theme registry.
 */

import type { LandingTheme, LandingThemeRegistry } from './types';

class LandingThemeRegistryImpl implements LandingThemeRegistry {
    private themes: Map<string, LandingTheme> = new Map();
    private activeThemeId: string | null = null;

    register(theme: LandingTheme): void {
        if (!theme.metadata?.id) {
            throw new Error('Landing theme must have a metadata.id');
        }
        this.themes.set(theme.metadata.id, theme);
    }

    get(id: string): LandingTheme | null {
        return this.themes.get(id) || null;
    }

    getAll(): LandingTheme[] {
        return Array.from(this.themes.values());
    }

    setActive(id: string): boolean {
        if (!this.themes.has(id)) {
            return false;
        }
        this.activeThemeId = id;
        return true;
    }

    getActive(): LandingTheme | null {
        if (!this.activeThemeId) return null;
        return this.themes.get(this.activeThemeId) || null;
    }

    has(id: string): boolean {
        return this.themes.has(id);
    }
}

/** Global landing theme registry instance */
export const landingThemeRegistry: LandingThemeRegistry = new LandingThemeRegistryImpl();

/** Register a landing theme */
export const registerLandingTheme = (theme: LandingTheme) => landingThemeRegistry.register(theme);

/** Get a landing theme by ID */
export const getLandingTheme = (id: string) => landingThemeRegistry.get(id);

/** Get all registered landing themes */
export const getAllLandingThemes = () => landingThemeRegistry.getAll();

/** Set the active landing theme */
export const setActiveLandingTheme = (id: string) => landingThemeRegistry.setActive(id);

/** Get the active landing theme */
export const getActiveLandingTheme = () => landingThemeRegistry.getActive();

/** Check if a landing theme exists */
export const hasLandingTheme = (id: string) => landingThemeRegistry.has(id);

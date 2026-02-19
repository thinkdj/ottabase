/**
 * @ottabase/ottablog - Theme Registry
 */

import type { Theme, ThemeRegistry } from './types';

/**
 * Theme Registry Implementation
 */
class ThemeRegistryImpl implements ThemeRegistry {
    private themes: Map<string, Theme> = new Map();
    private activeThemeId: string | null = null;

    /**
     * Register a theme
     */
    register(theme: Theme): void {
        if (!theme.metadata?.id) {
            throw new Error('Theme must have a metadata.id');
        }
        this.themes.set(theme.metadata.id, theme);
    }

    /**
     * Get theme by ID
     */
    get(id: string): Theme | null {
        return this.themes.get(id) || null;
    }

    /**
     * Get all themes
     */
    getAll(): Theme[] {
        return Array.from(this.themes.values());
    }

    /**
     * Set active theme
     */
    setActive(id: string): boolean {
        if (!this.themes.has(id)) {
            return false;
        }
        this.activeThemeId = id;
        return true;
    }

    /**
     * Get active theme
     */
    getActive(): Theme | null {
        if (!this.activeThemeId) {
            return null;
        }
        return this.themes.get(this.activeThemeId) || null;
    }

    /**
     * Check if theme exists
     */
    has(id: string): boolean {
        return this.themes.has(id);
    }
}

/**
 * Global theme registry instance
 */
export const themeRegistry: ThemeRegistry = new ThemeRegistryImpl();

/**
 * Convenience functions
 */
export const registerTheme = (theme: Theme) => themeRegistry.register(theme);
export const getTheme = (id: string) => themeRegistry.get(id);
export const getAllThemes = () => themeRegistry.getAll();
export const setActiveTheme = (id: string) => themeRegistry.setActive(id);
export const getActiveTheme = () => themeRegistry.getActive();
export const hasTheme = (id: string) => themeRegistry.has(id);

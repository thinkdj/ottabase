/**
 * @ottabase/ottablog - Studio Manager
 *
 * Manages blog themes and plugins state (DB-backed).
 * Syncs DB state to in-memory theme/plugin registries.
 */

import { OttablogPlugin, OttablogTheme } from '../ottaorm-models';
import { activatePlugin } from '../plugins';
import { setActiveTheme } from '../themes';

export interface StudioThemeState {
    id: string;
    themeId: string;
    name: string;
    description: string | null;
    isActive: boolean;
    config: Record<string, unknown> | null;
}

export interface StudioPluginState {
    id: string;
    pluginId: string;
    name: string;
    description: string | null;
    enabled: boolean;
    config: Record<string, unknown> | null;
}

export interface StudioState {
    activeThemeId: string | null;
    themes: StudioThemeState[];
    plugins: StudioPluginState[];
}

/**
 * Studio Manager - syncs DB theme/plugin state to registries
 */
export class StudioManager {
    /**
     * Load DB state and apply to theme/plugin registries (active theme, enabled plugins).
     * Call this before rendering or when handling studio API requests.
     */
    static async initialize(appId: string | null = null): Promise<void> {
        // Apply active theme
        const activeTheme = await OttablogTheme.active({ appId: appId ?? undefined });
        if (activeTheme) {
            setActiveTheme(activeTheme.get('themeId') as string);
        }

        // Activate enabled plugins (by id only; config is applied on client when loading state)
        const enabledPlugins = await OttablogPlugin.enabled({ appId: appId ?? undefined });
        for (const row of enabledPlugins) {
            await activatePlugin(row.get('pluginId') as string);
        }
    }

    /**
     * Get current studio state for admin UI (themes + plugins from DB).
     */
    static async getState(appId: string | null = null): Promise<StudioState> {
        const [themesRows, pluginsRows] = await Promise.all([
            OttablogTheme.where({ ...(appId ? { appId } : {}) }, { orderBy: 'name', orderDirection: 'asc' }),
            OttablogPlugin.where({ ...(appId ? { appId } : {}) }, { orderBy: 'name', orderDirection: 'asc' }),
        ]);

        const activeThemeRow = themesRows.find((t) => t.get('isActive'));
        const activeThemeId = activeThemeRow ? (activeThemeRow.get('themeId') as string) : null;

        const themes: StudioThemeState[] = themesRows.map((t) => ({
            id: t.get('id') as string,
            themeId: t.get('themeId') as string,
            name: t.get('name') as string,
            description: (t.get('description') as string) ?? null,
            isActive: (t.get('isActive') as boolean) ?? false,
            config: (t.get('config') as Record<string, unknown>) ?? null,
        }));

        const plugins: StudioPluginState[] = pluginsRows.map((p) => ({
            id: p.get('id') as string,
            pluginId: p.get('pluginId') as string,
            name: p.get('name') as string,
            description: (p.get('description') as string) ?? null,
            enabled: (p.get('enabled') as boolean) ?? false,
            config: (p.get('config') as Record<string, unknown>) ?? null,
        }));

        return { activeThemeId, themes, plugins };
    }
}

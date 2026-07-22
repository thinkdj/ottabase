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
    version: string | null;
    author: string | null;
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
     * Pass organizationId (id or null) to scope to a single tenant's blog in org mode;
     * omit it (undefined) for platform mode.
     */
    static async initialize(appId: string | null = null, organizationId?: string | null): Promise<void> {
        // Apply active theme
        const activeTheme = await OttablogTheme.active({ appId: appId ?? undefined, organizationId });
        if (activeTheme) {
            setActiveTheme(activeTheme.get('themeId') as string);
        }

        // Activate enabled plugins (by id only; config is applied on client when loading state)
        const enabledPlugins = await OttablogPlugin.enabled({ appId: appId ?? undefined, organizationId });
        for (const row of enabledPlugins) {
            await activatePlugin(row.get('pluginId') as string);
        }
    }

    /**
     * Get current studio state for admin UI (themes + plugins from DB).
     * Pass organizationId (id or null) to scope to a single tenant's blog in org mode.
     */
    static async getState(appId: string | null = null, organizationId?: string | null): Promise<StudioState> {
        const scope: Record<string, unknown> = { ...(appId ? { appId } : {}) };
        if (organizationId !== undefined) scope.organizationId = organizationId;
        const [themesRows, pluginsRows] = await Promise.all([
            OttablogTheme.where(scope, { orderBy: 'name', orderDirection: 'asc' }),
            OttablogPlugin.where(scope, { orderBy: 'name', orderDirection: 'asc' }),
        ]);

        const activeThemeRow = themesRows.find((t) => t.get('isActive'));
        const activeThemeId = activeThemeRow ? (activeThemeRow.get('themeId') as string) : null;

        const themes: StudioThemeState[] = themesRows.map((t) => ({
            id: t.get('id') as string,
            themeId: t.get('themeId') as string,
            name: t.get('name') as string,
            description: (t.get('description') as string) ?? null,
            version: (t.get('version') as string) ?? null,
            author: (t.get('author') as string) ?? null,
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

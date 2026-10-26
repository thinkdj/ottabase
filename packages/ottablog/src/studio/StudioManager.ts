/**
 * @ottabase/ottablog - Studio Manager
 *
 * Manages blog themes and plugins state (DB-backed).
 * Syncs DB state to in-memory theme/plugin registries.
 */

import { OttablogPlugin, OttablogSettings, OttablogTheme } from '../ottaorm-models';
import { activatePlugin } from '../plugins/registry';
import { setActiveTheme } from '../themes/registry';
import type { BlogScope } from '../types';

export interface StudioThemeState {
    id: string;
    themeId: string;
    name: string;
    description: string | null;
    version: string | null;
    author: string | null;
    isActive: boolean;
    config: Record<string, unknown> | null;
    /** Sparse brand-token overrides for the blog room (see theme-tokens.ts). */
    tokens: { light?: Record<string, string>; dark?: Record<string, string> } | null;
}

export interface StudioPluginState {
    id: string;
    pluginId: string;
    name: string;
    description: string | null;
    enabled: boolean;
    config: Record<string, unknown> | null;
}

export interface StudioLanguageState {
    defaultLanguage: string;
    supportedLanguages: { code: string; name: string; nativeName?: string }[];
    fallbackToDefault: boolean;
}

export interface StudioState {
    activeThemeId: string | null;
    themes: StudioThemeState[];
    plugins: StudioPluginState[];
    languageConfig: StudioLanguageState;
}

/**
 * Studio Manager - syncs DB theme/plugin state to registries
 */
export class StudioManager {
    /**
     * Load one blog's DB state into the in-memory theme/plugin registries (active theme, enabled
     * plugins). Plugin config is applied on the client when it loads the state.
     */
    static async initialize(scope: BlogScope): Promise<void> {
        const activeTheme = await OttablogTheme.active(scope);
        if (activeTheme) {
            setActiveTheme(activeTheme.get('themeId') as string);
        }

        const enabledPlugins = await OttablogPlugin.enabled(scope);
        for (const row of enabledPlugins) {
            await activatePlugin(row.get('pluginId') as string);
        }
    }

    /** One blog's Studio state: its themes, plugins and language policy. */
    static async getState(scope: BlogScope): Promise<StudioState> {
        const [themesRows, pluginsRows, settings] = await Promise.all([
            OttablogTheme.where({ ...scope }, { orderBy: 'name', orderDirection: 'asc' }),
            OttablogPlugin.where({ ...scope }, { orderBy: 'name', orderDirection: 'asc' }),
            OttablogSettings.forBlog(scope),
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
            tokens: (t.get('tokens') as StudioThemeState['tokens']) ?? null,
        }));

        const plugins: StudioPluginState[] = pluginsRows.map((p) => ({
            id: p.get('id') as string,
            pluginId: p.get('pluginId') as string,
            name: p.get('name') as string,
            description: (p.get('description') as string) ?? null,
            enabled: (p.get('enabled') as boolean) ?? false,
            config: (p.get('config') as Record<string, unknown>) ?? null,
        }));

        const languageConfig = settings?.config() ?? {
            defaultLanguage: 'en',
            supportedLanguages: [{ code: 'en', name: 'English', nativeName: 'English' }],
            fallbackToDefault: true,
        };

        return { activeThemeId, themes, plugins, languageConfig };
    }
}

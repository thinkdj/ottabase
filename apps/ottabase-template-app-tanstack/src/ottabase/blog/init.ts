/**
 * Ottablog Initialization for TanStack App
 *
 * Initialize themes, plugins, and hooks. Optionally loads studio state from API
 * and applies active theme and enabled plugins (with config).
 */

import {
    activatePlugin,
    contentInjectorPlugin,
    createContentInjectorPlugin,
    initOttablog,
    registerPlugin,
    setActiveTheme,
    type StudioPluginState,
    type StudioState,
    type StudioThemeState,
} from '@ottabase/ottablog';
import { api } from '@/lib/api';

/**
 * Register default themes and the content injector plugin (in-memory).
 */
function registerBlogThemesAndPlugins() {
    initOttablog({ defaultThemeId: 'default' });

    const plugin = contentInjectorPlugin.end(
        '<div class="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 my-4 rounded"><p class="text-sm text-blue-800 dark:text-blue-200"><strong>Note:</strong> This content was injected by the Content Injector Plugin!</p></div>',
        {
            position: 'end',
            priority: 10,
            enabled: true,
            contentTypes: [],
        },
    );
    registerPlugin(plugin);
}

/**
 * Fetch studio state from API and apply active theme, enabled plugins, and configs.
 */
export async function applyStudioStateFromApi() {
    try {
        const state = await api<StudioState>('/api/blog/studio/state');
        if (state.activeThemeId) {
            setActiveTheme(state.activeThemeId);
        }
        for (const theme of state.themes || []) {
            if ((theme as StudioThemeState).isActive && (theme as StudioThemeState).themeId) {
                setActiveTheme((theme as StudioThemeState).themeId);
                break;
            }
        }
        for (const row of state.plugins || []) {
            const p = row as StudioPluginState;
            if (!p.enabled) continue;
            const config = (p.config || {}) as Record<string, unknown>;
            if (p.pluginId === 'content-injector-plugin') {
                const plugin = createContentInjectorPlugin({
                    content: (config.content as string) ?? '',
                    position: (config.position as 'beginning' | 'end' | 'random') ?? 'end',
                    contentTypes: (config.contentTypes as string[]) ?? [],
                    priority: (config.priority as number) ?? 10,
                    enabled: true,
                });
                registerPlugin(plugin);
            }
            await activatePlugin(p.pluginId);
        }
    } catch (err) {
        console.warn('Could not load blog studio state:', err);
    }
}

/**
 * Initialize ottablog system: register themes/plugins, then load and apply DB studio state.
 */
export async function initBlogSystem() {
    registerBlogThemesAndPlugins();
    await applyStudioStateFromApi();
    console.log('✅ Ottablog initialized with hooks, themes, and plugins (database-backed)');
}

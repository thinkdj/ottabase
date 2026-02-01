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
    hasPlugin,
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

        // Apply active theme (use activeThemeId as source of truth)
        if (state.activeThemeId) {
            setActiveTheme(state.activeThemeId);
        }

        // Apply enabled plugins with their configurations
        for (const row of state.plugins || []) {
            const p = row as StudioPluginState;
            if (!p.enabled) continue;

            const config = (p.config || {}) as Record<string, unknown>;

            // Handle content-injector-plugin
            if (p.pluginId === 'content-injector-plugin') {
                // Only register if not already registered (prevents duplicate registration)
                if (!hasPlugin(p.pluginId)) {
                    const plugin = createContentInjectorPlugin({
                        content: (config.content as string) ?? '',
                        position: (config.position as 'beginning' | 'end' | 'random') ?? 'end',
                        contentTypes: (config.contentTypes as string[]) ?? [],
                        priority: (config.priority as number) ?? 10,
                        enabled: true,
                    });
                    registerPlugin(plugin);
                }
            }

            // Add similar handling for other plugins here in the future

            // Activate the plugin
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

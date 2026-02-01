/**
 * Ottablog Initialization for TanStack App
 *
 * Initialize themes, plugins, and hooks. Loads active theme and enabled plugins from DB via API.
 */

import { initOttablog, registerPlugin, activatePlugin, setActiveTheme, postContentPlugin } from '@ottabase/ottablog';

const DEFAULT_PLUGIN_CONTENT =
    '<div class="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 my-4 rounded"><p class="text-sm text-blue-800 dark:text-blue-200"><strong>Note:</strong> This content was injected by the Post Content Plugin!</p></div>';

const defaultPluginOptions = {
    position: 'end' as const,
    priority: 10,
    enabled: true,
    contentTypes: [] as string[],
    postIds: [] as string[],
};

/** State from API (active theme + enabled plugins + plugin configs) */
interface ExtensibilityState {
    activeThemeId?: string | null;
    enabledPluginIds?: string[];
    pluginConfigs?: Record<string, Record<string, unknown>>;
}

/**
 * Register themes and plugins only (no fetch). Used by the worker before ExtensibilityManager.initialize().
 */
export function registerBlogThemesAndPlugins() {
    initOttablog({ defaultThemeId: 'default' });
    const defaultPlugin = postContentPlugin.end(DEFAULT_PLUGIN_CONTENT, defaultPluginOptions);
    registerPlugin(defaultPlugin);
}

/**
 * Initialize ottablog system: register themes/plugins, then load state from DB and apply (client only).
 */
export async function initBlogSystem() {
    registerBlogThemesAndPlugins();

    try {
        const base = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
        const res = await fetch(`${base}/api/blog/extensibility/state`);
        if (!res.ok) return;
        const data = (await res.json()) as ExtensibilityState;
        const activeThemeId = data.activeThemeId ?? 'default';
        const enabledPluginIds = data.enabledPluginIds ?? [];
        const pluginConfigs = data.pluginConfigs ?? {};

        // Apply active theme from DB
        setActiveTheme(activeThemeId);

        // Apply post-content-plugin config from DB if present
        const postContentConfig = pluginConfigs['post-content-plugin'];
        if (postContentConfig && typeof postContentConfig === 'object') {
            const opts = {
                content: (postContentConfig.content as string) ?? DEFAULT_PLUGIN_CONTENT,
                position: (postContentConfig.position as 'beginning' | 'end' | 'random') ?? 'end',
                priority: typeof postContentConfig.priority === 'number' ? postContentConfig.priority : 10,
                enabled: postContentConfig.enabled !== false,
                contentTypes: Array.isArray(postContentConfig.contentTypes) ? postContentConfig.contentTypes : [],
                postIds: Array.isArray(postContentConfig.postIds) ? postContentConfig.postIds : [],
            };
            const plugin = postContentPlugin.end(opts.content, opts);
            registerPlugin(plugin);
        }

        // Activate only plugins that are enabled in DB
        for (const pluginId of enabledPluginIds) {
            try {
                await activatePlugin(pluginId);
            } catch {
                // Plugin may not exist in registry; ignore
            }
        }
    } catch {
        // If API fails (e.g. offline), keep default theme and no plugins active
    }

    console.log('✅ Ottablog initialized with hooks, themes, and plugins');
}

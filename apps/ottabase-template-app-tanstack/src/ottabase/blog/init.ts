/**
 * Ottablog Initialization for TanStack App
 *
 * Initialize themes, plugins, and hooks. Optionally loads studio state from API
 * and applies active theme and enabled plugins (with config).
 */

import { api } from '@/lib/api';
import {
    activatePlugin,
    contentInjectorPlugin,
    createContentInjectorPlugin,
    deactivatePlugin,
    getTheme,
    hasPlugin,
    initOttablog,
    registerPlugin,
    registerTheme,
    setActiveTheme,
    type StudioPluginState,
    type StudioState,
} from '@ottabase/ottablog';

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

/** In-flight promise so concurrent calls (e.g. Strict Mode double effect) share one request */
let studioStateFetchPromise: Promise<StudioState | null> | null = null;

/** Delay before clearing in-flight ref so a concurrent caller (same tick / next microtask) still sees the promise */
const STUDIO_STATE_DEDUPE_CLEAR_MS = 50;

/**
 * Fetch studio state from API and apply active theme, enabled plugins, and configs.
 * Concurrent calls share the same in-flight request (avoids 2x from React Strict Mode).
 * Clear is delayed so a very fast response does not set the ref to null before a second caller checks it.
 */
export async function applyStudioStateFromApi() {
    if (studioStateFetchPromise) {
        const state = await studioStateFetchPromise;
        if (state) await applyState(state);
        return;
    }
    studioStateFetchPromise = (async () => {
        try {
            const state = await api<StudioState>('/api/blog/studio/state');
            await applyState(state);
            return state;
        } catch (err) {
            console.warn('Could not load blog studio state:', err);
            return null;
        } finally {
            setTimeout(() => {
                studioStateFetchPromise = null;
            }, STUDIO_STATE_DEDUPE_CLEAR_MS);
        }
    })();
    await studioStateFetchPromise;
}

async function applyState(state: StudioState) {
    // Apply active theme (use activeThemeId as source of truth)
    if (state.activeThemeId) {
        setActiveTheme(state.activeThemeId);
    }

    // Merge DB-stored config (classes overrides) into the active in-memory theme
    for (const t of state.themes || []) {
        const dbClasses = (t.config as Record<string, unknown> | null)?.classes as Record<string, string> | undefined;
        if (!dbClasses) continue;

        const theme = getTheme(t.themeId);
        if (!theme) continue;

        // Re-register with merged config — DB classes override built-in defaults
        registerTheme({
            ...theme,
            config: {
                ...theme.config,
                classes: { ...theme.config?.classes, ...dbClasses },
            },
        });
    }

    // Deactivate content-injector when it's disabled in studio state (so default static plugin doesn't run)
    for (const row of state.plugins || []) {
        const p = row as StudioPluginState;
        if (p.enabled || p.pluginId !== 'content-injector-plugin') continue;
        if (hasPlugin(p.pluginId)) {
            await deactivatePlugin(p.pluginId);
        }
    }

    // Apply enabled plugins with their configurations
    for (const row of state.plugins || []) {
        const p = row as StudioPluginState;
        if (!p.enabled) continue;

        const config = (p.config || {}) as Record<string, unknown>;

        // Handle content-injector-plugin: always use config from API (replace default static plugin)
        if (p.pluginId === 'content-injector-plugin') {
            if (hasPlugin(p.pluginId)) {
                await deactivatePlugin(p.pluginId);
            }
            const plugin = createContentInjectorPlugin({
                content: (config.content as string) ?? '',
                position: (config.position as 'beginning' | 'end' | 'random') ?? 'end',
                contentTypes: (config.contentTypes as string[]) ?? [],
                priority: (config.priority as number) ?? 10,
                enabled: true,
            });
            registerPlugin(plugin);
        }

        // Add similar handling for other plugins here in the future

        // Activate the plugin
        await activatePlugin(p.pluginId);
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

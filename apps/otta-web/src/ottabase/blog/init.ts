/**
 * Ottablog on the client: the built-in themes, and one blog's Studio state applied over them.
 *
 * Themes and plugins live in one in-memory registry while the app serves several blogs (the site
 * blog and each organization's). Applying a blog's state therefore starts from the built-in
 * defaults every time: nothing one blog configured ever renders on another.
 */

import {
    activatePlugin,
    blogThemeTokensToCss,
    createContentInjectorPlugin,
    deactivatePlugin,
    getActivePlugins,
    getTheme,
    registerPlugin,
    registerTheme,
    setActiveTheme,
    type BlogThemeTokens,
    type StudioState,
} from '@ottabase/ottablog';
import { initOttablog } from '@ottabase/ottablog/renderer';

/**
 * Style-element id shared with the edge injector (worker/lib/blog-theme-inject.ts).
 * The client REPLACES the element's content instead of adding a second tag, so the
 * edge-painted state and the client-applied state can never disagree: the same
 * contract the brand engine uses for #brand-critical.
 */
const BLOG_THEME_STYLE_ID = 'ottablog-theme-scope';

function applyBlogThemeTokens(tokens: BlogThemeTokens | null | undefined): void {
    if (typeof document === 'undefined') return;
    const css = blogThemeTokensToCss(tokens);
    let el = document.getElementById(BLOG_THEME_STYLE_ID) as HTMLStyleElement | null;
    if (!css) {
        // Sparse law: no tokens means no room CSS at all (remove any stale edge tag).
        el?.remove();
        return;
    }
    if (!el) {
        el = document.createElement('style');
        el.id = BLOG_THEME_STYLE_ID;
        document.head.appendChild(el);
    }
    if (el.textContent !== css) el.textContent = css;
}

/**
 * Apply one blog's public Studio state: its active theme (with stored class overrides and brand
 * tokens) and its enabled plugins with their configuration. Null applies the defaults alone.
 */
export async function applyBlogState(state: Pick<StudioState, 'activeThemeId' | 'themes' | 'plugins'> | null) {
    // Pristine built-in themes, the default active, every plugin off.
    initOttablog({ defaultThemeId: 'default' });
    for (const plugin of getActivePlugins()) await deactivatePlugin(plugin.metadata.id);

    // Stored class overrides re-register a theme with its built-in config merged under them.
    for (const row of state?.themes ?? []) {
        const classes = (row.config as Record<string, unknown> | null)?.classes as Record<string, string> | undefined;
        const theme = classes ? getTheme(row.themeId) : null;
        if (!theme) continue;
        registerTheme({ ...theme, config: { ...theme.config, classes: { ...theme.config?.classes, ...classes } } });
    }
    if (state?.activeThemeId) setActiveTheme(state.activeThemeId);
    const active = state?.themes.find((row) => row.themeId === state.activeThemeId);
    applyBlogThemeTokens((active?.tokens as BlogThemeTokens | null | undefined) ?? null);

    for (const row of state?.plugins ?? []) {
        if (!row.enabled) continue;
        const config = (row.config ?? {}) as Record<string, unknown>;
        if (row.pluginId === 'content-injector-plugin') {
            registerPlugin(
                createContentInjectorPlugin({
                    content: (config.content as string) ?? '',
                    position: (config.position as 'beginning' | 'end' | 'random') ?? 'end',
                    contentTypes: (config.contentTypes as string[]) ?? [],
                    priority: (config.priority as number) ?? 10,
                    enabled: true,
                }),
            );
        }
        await activatePlugin(row.pluginId);
    }
}

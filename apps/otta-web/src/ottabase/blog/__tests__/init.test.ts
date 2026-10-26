/**
 * applyBlogState: one blog's Studio state over the built-in defaults. Blogs share one in-memory
 * registry, so each apply must start clean: nothing one blog enabled may run on another.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { registry, initOttablog } = vi.hoisted(() => ({
    registry: {
        active: new Set<string>(),
        activeTheme: 'default',
        themes: new Map<string, { metadata: { id: string }; config?: { classes?: Record<string, string> } }>(),
        registered: [] as unknown[],
    },
    initOttablog: vi.fn(),
}));

vi.mock('@ottabase/ottablog', () => ({
    activatePlugin: vi.fn(async (id: string) => registry.active.add(id)),
    deactivatePlugin: vi.fn(async (id: string) => registry.active.delete(id)),
    getActivePlugins: () => [...registry.active].map((id) => ({ metadata: { id } })),
    getTheme: (id: string) => registry.themes.get(id) ?? null,
    registerTheme: (theme: { metadata: { id: string } }) => registry.themes.set(theme.metadata.id, theme),
    setActiveTheme: (id: string) => (registry.activeTheme = id),
    registerPlugin: (plugin: unknown) => registry.registered.push(plugin),
    createContentInjectorPlugin: (options: unknown) => ({ options }),
    blogThemeTokensToCss: (tokens: unknown) => (tokens ? '[data-brand-scope="blog"]{--primary: 1 2% 3%;}' : ''),
}));

vi.mock('@ottabase/ottablog/renderer', () => ({
    initOttablog: (options: { defaultThemeId: string }) => {
        initOttablog(options);
        // The pristine built-ins, as the real initOttablog registers them.
        registry.themes.set('default', { metadata: { id: 'default' }, config: { classes: { title: 'text-2xl' } } });
        registry.themes.set('minimal', { metadata: { id: 'minimal' } });
        registry.activeTheme = options.defaultThemeId;
    },
}));

import { applyBlogState } from '../init';

const theme = (themeId: string, extra: Record<string, unknown> = {}) =>
    ({ id: themeId, themeId, name: themeId, isActive: false, config: null, tokens: null, ...extra }) as never;
const plugin = (pluginId: string, enabled: boolean, config: Record<string, unknown> | null = null) =>
    ({ id: pluginId, pluginId, name: pluginId, enabled, config }) as never;

describe('applyBlogState', () => {
    beforeEach(() => {
        registry.active.clear();
        registry.themes.clear();
        registry.registered = [];
        document.getElementById('ottablog-theme-scope')?.remove();
    });

    it("applies a blog's theme, class overrides, tokens and enabled plugins", async () => {
        await applyBlogState({
            activeThemeId: 'default',
            themes: [theme('default', { config: { classes: { title: 'text-4xl' } }, tokens: { light: { x: '1' } } })],
            plugins: [plugin('content-injector-plugin', true, { content: 'Hi', position: 'beginning' })],
        });

        expect(registry.activeTheme).toBe('default');
        expect(registry.themes.get('default')?.config?.classes).toEqual({ title: 'text-4xl' });
        expect(document.getElementById('ottablog-theme-scope')?.textContent).toContain('--primary');
        expect(registry.active.has('content-injector-plugin')).toBe(true);
        expect(registry.registered).toEqual([
            { options: expect.objectContaining({ content: 'Hi', position: 'beginning', enabled: true }) },
        ]);
    });

    it('starts the next blog from the defaults: no plugin, override or tokens carry over', async () => {
        await applyBlogState({
            activeThemeId: 'minimal',
            themes: [
                theme('default', { config: { classes: { title: 'text-4xl' } } }),
                theme('minimal', { tokens: { light: { x: '1' } } }),
            ],
            plugins: [plugin('content-injector-plugin', true)],
        });

        await applyBlogState({ activeThemeId: null, themes: [], plugins: [] });

        expect(initOttablog).toHaveBeenLastCalledWith({ defaultThemeId: 'default' });
        expect(registry.activeTheme).toBe('default');
        expect(registry.themes.get('default')?.config?.classes).toEqual({ title: 'text-2xl' });
        expect(registry.active.size).toBe(0);
        expect(document.getElementById('ottablog-theme-scope')).toBeNull();
    });

    it('applies the defaults alone when the state is unavailable', async () => {
        registry.active.add('content-injector-plugin');

        await applyBlogState(null);

        expect(registry.activeTheme).toBe('default');
        expect(registry.active.size).toBe(0);
    });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../ottaorm-models', () => ({
    OttablogTheme: { active: vi.fn(), where: vi.fn() },
    OttablogPlugin: { enabled: vi.fn(), where: vi.fn() },
    OttablogSettings: { forBlog: vi.fn(async () => null) },
}));
// StudioManager imports these from the pure registry modules (not the UI-tainted barrels),
// so the mocks must target the registries to intercept the calls.
vi.mock('../../themes/registry', () => ({ setActiveTheme: vi.fn() }));
vi.mock('../../plugins/registry', () => ({ activatePlugin: vi.fn() }));

import { activatePlugin } from '../../plugins/registry';
import { setActiveTheme } from '../../themes/registry';
import { OttablogPlugin, OttablogTheme } from '../../ottaorm-models';
import { StudioManager } from '../StudioManager';

const SITE = { appId: 'app1', organizationId: null };

function modelRow<T>(fields: Record<string, unknown>): T {
    return { get: (key: string) => fields[key] } as T;
}

describe('StudioManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns full state from the model layer', async () => {
        vi.mocked(OttablogTheme.where).mockResolvedValue([
            modelRow<OttablogTheme>({
                id: 't1',
                themeId: 'default',
                name: 'Default',
                isActive: true,
                config: null,
                tokens: { light: { '--x': '1' } },
            }),
        ]);
        vi.mocked(OttablogPlugin.where).mockResolvedValue([
            modelRow<OttablogPlugin>({ id: 'p1', pluginId: 'plug', name: 'Plug', enabled: true, config: null }),
        ]);

        const state = await StudioManager.getState(SITE);

        expect(state.activeThemeId).toBe('default');
        expect(state.themes[0]?.tokens).toEqual({ light: { '--x': '1' } });
        expect(state.plugins).toHaveLength(1);
        // One blog's rows only: the site blog, never every blog of the app.
        expect(OttablogTheme.where).toHaveBeenCalledWith(SITE, expect.anything());
    });

    it('propagates model query failures instead of reporting an empty Studio', async () => {
        const databaseError = new Error('D1 unavailable');
        vi.mocked(OttablogTheme.where).mockRejectedValue(databaseError);
        vi.mocked(OttablogPlugin.where).mockResolvedValue([]);

        await expect(StudioManager.getState(SITE)).rejects.toBe(databaseError);
    });

    it('propagates initialization failures instead of silently using stale registries', async () => {
        const databaseError = new Error('RLS context missing');
        vi.mocked(OttablogTheme.active).mockRejectedValue(databaseError);

        await expect(StudioManager.initialize(SITE)).rejects.toBe(databaseError);
        expect(setActiveTheme).not.toHaveBeenCalled();
        expect(OttablogPlugin.enabled).not.toHaveBeenCalled();
    });

    it('applies the active theme and enabled plugins', async () => {
        vi.mocked(OttablogTheme.active).mockResolvedValue(modelRow<OttablogTheme>({ themeId: 'minimal' }));
        vi.mocked(OttablogPlugin.enabled).mockResolvedValue([
            modelRow<OttablogPlugin>({ pluginId: 'content-injector-plugin' }),
        ]);

        await StudioManager.initialize(SITE);

        expect(setActiveTheme).toHaveBeenCalledWith('minimal');
        expect(activatePlugin).toHaveBeenCalledWith('content-injector-plugin');
    });
});

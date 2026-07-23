import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../ottaorm-models', () => ({
    OttablogTheme: { active: vi.fn(), where: vi.fn() },
    OttablogPlugin: { enabled: vi.fn(), where: vi.fn() },
}));
vi.mock('../../themes', () => ({ setActiveTheme: vi.fn() }));
vi.mock('../../plugins', () => ({ activatePlugin: vi.fn() }));

import { activatePlugin } from '../../plugins';
import { setActiveTheme } from '../../themes';
import { OttablogPlugin, OttablogTheme } from '../../ottaorm-models';
import { StudioManager } from '../StudioManager';

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

        const state = await StudioManager.getState('app1');

        expect(state.activeThemeId).toBe('default');
        expect(state.themes[0]?.tokens).toEqual({ light: { '--x': '1' } });
        expect(state.plugins).toHaveLength(1);
    });

    it('propagates model query failures instead of reporting an empty Studio', async () => {
        const databaseError = new Error('D1 unavailable');
        vi.mocked(OttablogTheme.where).mockRejectedValue(databaseError);
        vi.mocked(OttablogPlugin.where).mockResolvedValue([]);

        await expect(StudioManager.getState('app1')).rejects.toBe(databaseError);
    });

    it('propagates initialization failures instead of silently using stale registries', async () => {
        const databaseError = new Error('RLS context missing');
        vi.mocked(OttablogTheme.active).mockRejectedValue(databaseError);

        await expect(StudioManager.initialize('app1')).rejects.toBe(databaseError);
        expect(setActiveTheme).not.toHaveBeenCalled();
        expect(OttablogPlugin.enabled).not.toHaveBeenCalled();
    });

    it('applies the active theme and enabled plugins', async () => {
        vi.mocked(OttablogTheme.active).mockResolvedValue(modelRow<OttablogTheme>({ themeId: 'minimal' }));
        vi.mocked(OttablogPlugin.enabled).mockResolvedValue([
            modelRow<OttablogPlugin>({ pluginId: 'content-injector-plugin' }),
        ]);

        await StudioManager.initialize('app1');

        expect(setActiveTheme).toHaveBeenCalledWith('minimal');
        expect(activatePlugin).toHaveBeenCalledWith('content-injector-plugin');
    });
});

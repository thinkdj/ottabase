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

function themeRow(fields: Record<string, unknown>) {
    return { get: (key: string) => fields[key] };
}

describe('StudioManager — malformed-row resilience', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getState', () => {
        it('degrades themes to [] when the themes query throws (e.g. bad JSON in tokens/config)', async () => {
            (OttablogTheme.where as any).mockRejectedValue(new SyntaxError('"tokens" is not valid JSON'));
            (OttablogPlugin.where as any).mockResolvedValue([]);

            const state = await StudioManager.getState('app1');

            expect(state.themes).toEqual([]);
            expect(state.activeThemeId).toBeNull();
        });

        it('degrades plugins to [] when the plugins query throws, without affecting themes', async () => {
            (OttablogTheme.where as any).mockResolvedValue([
                themeRow({ id: 't1', themeId: 'default', name: 'Default', isActive: true, tokens: null, config: null }),
            ]);
            (OttablogPlugin.where as any).mockRejectedValue(new SyntaxError('bad JSON'));

            const state = await StudioManager.getState('app1');

            expect(state.plugins).toEqual([]);
            expect(state.activeThemeId).toBe('default');
        });

        it('returns full state on the happy path (no degrade)', async () => {
            (OttablogTheme.where as any).mockResolvedValue([
                themeRow({
                    id: 't1',
                    themeId: 'default',
                    name: 'Default',
                    isActive: true,
                    config: null,
                    tokens: { light: { '--x': '1' } },
                }),
            ]);
            (OttablogPlugin.where as any).mockResolvedValue([
                themeRow({ id: 'p1', pluginId: 'plug', name: 'Plug', enabled: true, config: null }),
            ]);

            const state = await StudioManager.getState('app1');

            expect(state.activeThemeId).toBe('default');
            expect(state.themes).toHaveLength(1);
            expect(state.themes[0].tokens).toEqual({ light: { '--x': '1' } });
            expect(state.plugins).toHaveLength(1);
        });
    });

    describe('initialize', () => {
        it('does not throw and skips setActiveTheme when the active-theme lookup throws', async () => {
            (OttablogTheme.active as any).mockRejectedValue(new SyntaxError('bad JSON'));
            (OttablogPlugin.enabled as any).mockResolvedValue([]);

            await expect(StudioManager.initialize('app1')).resolves.toBeUndefined();
            expect(setActiveTheme).not.toHaveBeenCalled();
        });

        it('does not throw and skips activatePlugin when the enabled-plugins lookup throws', async () => {
            (OttablogTheme.active as any).mockResolvedValue(null);
            (OttablogPlugin.enabled as any).mockRejectedValue(new SyntaxError('bad JSON'));

            await expect(StudioManager.initialize('app1')).resolves.toBeUndefined();
            expect(activatePlugin).not.toHaveBeenCalled();
        });

        it('applies active theme and enabled plugins on the happy path', async () => {
            (OttablogTheme.active as any).mockResolvedValue(themeRow({ themeId: 'minimal' }));
            (OttablogPlugin.enabled as any).mockResolvedValue([themeRow({ pluginId: 'content-injector-plugin' })]);

            await StudioManager.initialize('app1');

            expect(setActiveTheme).toHaveBeenCalledWith('minimal');
            expect(activatePlugin).toHaveBeenCalledWith('content-injector-plugin');
        });
    });
});

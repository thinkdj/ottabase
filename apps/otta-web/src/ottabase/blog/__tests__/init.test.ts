/**
 * Blog init tests
 *
 * Tests for applyStudioStateFromApi in-flight deduplication (concurrent calls share one request).
 * Run from repo root: pnpm test --filter=@ottabase/otta-web
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApi = vi.fn();
const mockSetActiveTheme = vi.fn();
const mockDeactivatePlugin = vi.fn();
const mockHasPlugin = vi.fn();
const mockCreateContentInjectorPlugin = vi.fn();
const mockRegisterPlugin = vi.fn();
const mockActivatePlugin = vi.fn();

vi.mock('@/lib/api', () => ({
    api: (...args: unknown[]) => mockApi(...args),
}));

vi.mock('@ottabase/ottablog', () => ({
    setActiveTheme: (id: string) => mockSetActiveTheme(id),
    deactivatePlugin: (id: string) => mockDeactivatePlugin(id),
    hasPlugin: (id: string) => mockHasPlugin(id),
    createContentInjectorPlugin: (opts: unknown) => mockCreateContentInjectorPlugin(opts),
    registerPlugin: (plugin: unknown) => mockRegisterPlugin(plugin),
    activatePlugin: (id: string) => mockActivatePlugin(id),
    initOttablog: vi.fn(),
    contentInjectorPlugin: { end: vi.fn() },
}));

describe('blog init applyStudioStateFromApi', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();
        mockHasPlugin.mockReturnValue(false);
        mockApi.mockImplementation(
            () =>
                new Promise((resolve) => {
                    setTimeout(() => resolve({ activeThemeId: 'default', plugins: [] }), 5);
                }),
        );
    });

    it('concurrent calls should share one API request (dedupe)', async () => {
        const { applyStudioStateFromApi } = await import('../init');

        const p1 = applyStudioStateFromApi();
        const p2 = applyStudioStateFromApi();

        await Promise.all([p1, p2]);

        expect(mockApi).toHaveBeenCalledTimes(1);
        expect(mockApi).toHaveBeenCalledWith('/api/blog/studio/state', { skipUnauthorizedHandler: true });
    });

    it('sequential calls after first completes should each make a new request', async () => {
        const { applyStudioStateFromApi } = await import('../init');

        await applyStudioStateFromApi();
        // Wait longer than STUDIO_STATE_DEDUPE_CLEAR_MS (50ms) so the in-flight ref is cleared
        await new Promise((r) => setTimeout(r, 60));
        await applyStudioStateFromApi();

        expect(mockApi).toHaveBeenCalledTimes(2);
    });
});

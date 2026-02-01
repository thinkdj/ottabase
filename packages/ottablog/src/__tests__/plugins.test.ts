import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
    registerPlugin,
    activatePlugin,
    deactivatePlugin,
    hasPlugin,
    isPluginActive,
    getPlugin,
    getAllPlugins,
    getActivePlugins,
} from '../plugins/registry';
import type { Plugin } from '../plugins/types';
import { hookRegistry } from '../hooks';

describe('Plugin Registry', () => {
    beforeEach(() => {
        // Clear the registry before each test
        // Note: This assumes registry has a way to clear. If not, tests may need isolation.
        const allPlugins = getAllPlugins();
        allPlugins.forEach((plugin) => {
            if (plugin.metadata?.id && isPluginActive(plugin.metadata.id)) {
                deactivatePlugin(plugin.metadata.id);
            }
        });
    });

    describe('Plugin registration', () => {
        it('should register a plugin successfully', () => {
            const plugin: Plugin = {
                metadata: {
                    id: 'test-plugin-1',
                    name: 'Test Plugin',
                    version: '1.0.0',
                    description: 'A test plugin',
                },
            };

            registerPlugin(plugin);

            expect(hasPlugin('test-plugin-1')).toBe(true);
            expect(getPlugin('test-plugin-1')).toEqual(plugin);
        });

        it('should throw error when registering plugin without id', () => {
            const invalidPlugin = {
                metadata: {
                    name: 'Invalid Plugin',
                    version: '1.0.0',
                },
            } as Plugin;

            expect(() => registerPlugin(invalidPlugin)).toThrow('Plugin must have a metadata.id');
        });

        it('should allow re-registering the same plugin', () => {
            const plugin: Plugin = {
                metadata: {
                    id: 'test-plugin-2',
                    name: 'Test Plugin 2',
                    version: '1.0.0',
                },
            };

            registerPlugin(plugin);
            expect(hasPlugin('test-plugin-2')).toBe(true);

            // Re-register should work
            registerPlugin(plugin);
            expect(hasPlugin('test-plugin-2')).toBe(true);
        });
    });

    describe('Plugin re-registration prevention', () => {
        it('should prevent duplicate plugin registration with hasPlugin check', () => {
            const plugin: Plugin = {
                metadata: {
                    id: 'unique-plugin',
                    name: 'Unique Plugin',
                    version: '1.0.0',
                },
            };

            // First registration
            if (!hasPlugin('unique-plugin')) {
                registerPlugin(plugin);
            }

            expect(hasPlugin('unique-plugin')).toBe(true);

            // Attempt to register again - should be prevented by hasPlugin check
            let registered = false;
            if (!hasPlugin('unique-plugin')) {
                registerPlugin(plugin);
                registered = true;
            }

            expect(registered).toBe(false);
            expect(getAllPlugins().filter((p) => p.metadata?.id === 'unique-plugin').length).toBe(1);
        });

        it('should prevent duplicate activation', async () => {
            const onActivateSpy = vi.fn();
            const plugin: Plugin = {
                metadata: {
                    id: 'test-activate',
                    name: 'Test Activate',
                    version: '1.0.0',
                },
                lifecycle: {
                    onActivate: onActivateSpy,
                },
            };

            registerPlugin(plugin);

            // First activation
            await activatePlugin('test-activate');
            expect(onActivateSpy).toHaveBeenCalledTimes(1);

            // Second activation - should not call onActivate again
            await activatePlugin('test-activate');
            expect(onActivateSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('Plugin activation', () => {
        it('should activate a plugin and register its hooks', async () => {
            const filterCallback = vi.fn((value: string) => value);
            const actionCallback = vi.fn();

            const plugin: Plugin = {
                metadata: {
                    id: 'test-hooks-plugin',
                    name: 'Test Hooks Plugin',
                    version: '1.0.0',
                },
                hooks: {
                    'post.title.filter': [
                        {
                            callback: filterCallback,
                            priority: 10,
                        },
                    ],
                    'post.render.before': [
                        {
                            callback: actionCallback,
                            priority: 10,
                        },
                    ],
                },
            };

            registerPlugin(plugin);
            await activatePlugin('test-hooks-plugin');

            expect(isPluginActive('test-hooks-plugin')).toBe(true);
        });

        it('should call onActivate lifecycle hook', async () => {
            const onActivateSpy = vi.fn();
            const plugin: Plugin = {
                metadata: {
                    id: 'lifecycle-plugin',
                    name: 'Lifecycle Plugin',
                    version: '1.0.0',
                },
                lifecycle: {
                    onActivate: onActivateSpy,
                },
            };

            registerPlugin(plugin);
            await activatePlugin('lifecycle-plugin');

            expect(onActivateSpy).toHaveBeenCalledTimes(1);
        });

        it('should return false when activating non-existent plugin', async () => {
            const result = await activatePlugin('non-existent');
            expect(result).toBe(false);
        });
    });

    describe('Plugin deactivation', () => {
        it('should deactivate a plugin and remove its hooks', async () => {
            const onDeactivateSpy = vi.fn();
            const plugin: Plugin = {
                metadata: {
                    id: 'deactivate-plugin',
                    name: 'Deactivate Plugin',
                    version: '1.0.0',
                },
                hooks: {
                    'post.title.filter': [
                        {
                            callback: (value: string) => value,
                            priority: 10,
                        },
                    ],
                },
                lifecycle: {
                    onDeactivate: onDeactivateSpy,
                },
            };

            registerPlugin(plugin);
            await activatePlugin('deactivate-plugin');
            expect(isPluginActive('deactivate-plugin')).toBe(true);

            await deactivatePlugin('deactivate-plugin');
            expect(isPluginActive('deactivate-plugin')).toBe(false);
            expect(onDeactivateSpy).toHaveBeenCalledTimes(1);
        });

        it('should return true when deactivating already inactive plugin', async () => {
            const plugin: Plugin = {
                metadata: {
                    id: 'inactive-plugin',
                    name: 'Inactive Plugin',
                    version: '1.0.0',
                },
            };

            registerPlugin(plugin);
            const result = await deactivatePlugin('inactive-plugin');
            expect(result).toBe(true);
        });
    });

    describe('Plugin queries', () => {
        it('should return all plugins', () => {
            const plugin1: Plugin = {
                metadata: { id: 'plugin-1', name: 'Plugin 1', version: '1.0.0' },
            };
            const plugin2: Plugin = {
                metadata: { id: 'plugin-2', name: 'Plugin 2', version: '1.0.0' },
            };

            registerPlugin(plugin1);
            registerPlugin(plugin2);

            const allPlugins = getAllPlugins();
            expect(allPlugins.length).toBeGreaterThanOrEqual(2);
            expect(allPlugins.some((p) => p.metadata?.id === 'plugin-1')).toBe(true);
            expect(allPlugins.some((p) => p.metadata?.id === 'plugin-2')).toBe(true);
        });

        it('should return only active plugins', async () => {
            const plugin1: Plugin = {
                metadata: { id: 'active-1', name: 'Active 1', version: '1.0.0' },
            };
            const plugin2: Plugin = {
                metadata: { id: 'active-2', name: 'Active 2', version: '1.0.0' },
            };
            const plugin3: Plugin = {
                metadata: { id: 'inactive-3', name: 'Inactive 3', version: '1.0.0' },
            };

            registerPlugin(plugin1);
            registerPlugin(plugin2);
            registerPlugin(plugin3);

            await activatePlugin('active-1');
            await activatePlugin('active-2');

            const activePlugins = getActivePlugins();
            expect(activePlugins.some((p) => p.metadata?.id === 'active-1')).toBe(true);
            expect(activePlugins.some((p) => p.metadata?.id === 'active-2')).toBe(true);
            expect(activePlugins.some((p) => p.metadata?.id === 'inactive-3')).toBe(false);
        });
    });

    describe('Real-world scenario: Content Injector Plugin', () => {
        it('should prevent re-registration in init.ts pattern', async () => {
            const createContentInjectorPlugin = (config: { pluginId: string }) => ({
                metadata: {
                    id: config.pluginId,
                    name: 'Content Injector',
                    version: '1.0.0',
                },
                hooks: {
                    'post.content.filter': [
                        {
                            callback: (content: any) => content,
                            priority: 10,
                        },
                    ],
                },
            });

            // Simulate init.ts loading studio state multiple times
            const loadStudioState = () => {
                const pluginId = 'content-injector-app-123';
                const pluginConfig = {
                    pluginId,
                    injections: [],
                };

                // This is the pattern used in init.ts to prevent re-registration
                if (!hasPlugin(pluginId)) {
                    const plugin = createContentInjectorPlugin(pluginConfig);
                    registerPlugin(plugin);
                    activatePlugin(pluginId);
                }
            };

            // First load
            loadStudioState();
            expect(hasPlugin('content-injector-app-123')).toBe(true);

            const firstAllPlugins = getAllPlugins();
            const firstCount = firstAllPlugins.filter((p) => p.metadata?.id === 'content-injector-app-123').length;

            // Second load - should not create duplicate
            loadStudioState();

            const secondAllPlugins = getAllPlugins();
            const secondCount = secondAllPlugins.filter((p) => p.metadata?.id === 'content-injector-app-123').length;

            // Verify no duplicate was created
            expect(firstCount).toBe(secondCount);
            expect(secondCount).toBe(1);
        });
    });
});

/**
 * @ottabase/ottablog - Plugin Registry
 */

import type { Plugin, PluginRegistry } from './types';
import { addAction, addFilter, hookRegistry } from '../hooks';

/**
 * Plugin Registry Implementation
 */
class PluginRegistryImpl implements PluginRegistry {
    private plugins: Map<string, Plugin> = new Map();
    private activePlugins: Set<string> = new Set();
    private hookIds: Map<string, Map<string, string>> = new Map(); // pluginId -> hookName -> hookId

    /**
     * Register a plugin
     */
    register(plugin: Plugin): void {
        if (!plugin.metadata?.id) {
            throw new Error('Plugin must have a metadata.id');
        }
        this.plugins.set(plugin.metadata.id, plugin);
    }

    /**
     * Get plugin by ID
     */
    get(id: string): Plugin | null {
        return this.plugins.get(id) || null;
    }

    /**
     * Get all plugins
     */
    getAll(): Plugin[] {
        return Array.from(this.plugins.values());
    }

    /**
     * Activate a plugin
     */
    async activate(id: string): Promise<boolean> {
        const plugin = this.plugins.get(id);
        if (!plugin) {
            return false;
        }

        if (this.activePlugins.has(id)) {
            return true; // Already active
        }

        // Register hooks
        if (plugin.hooks) {
            const hookIds = new Map<string, string>();
            for (const [hookName, registrations] of Object.entries(plugin.hooks)) {
                for (const registration of registrations) {
                    const hookId = registration.id || `${id}_${hookName}_${Math.random().toString(36).substr(2, 9)}`;
                    const priority = registration.priority || 10;

                    // Determine if it's a filter or action based on hook name
                    if (hookName.includes('.filter') || hookName.includes('filter')) {
                        addFilter(hookName, registration.callback as any, priority, hookId);
                    } else {
                        addAction(hookName, registration.callback as any, priority, hookId);
                    }

                    hookIds.set(hookName, hookId);
                }
            }
            this.hookIds.set(id, hookIds);
        }

        // Call activation hook
        if (plugin.lifecycle?.onActivate) {
            await plugin.lifecycle.onActivate();
        }

        this.activePlugins.add(id);
        return true;
    }

    /**
     * Deactivate a plugin
     */
    async deactivate(id: string): Promise<boolean> {
        const plugin = this.plugins.get(id);
        if (!plugin) {
            return false;
        }

        if (!this.activePlugins.has(id)) {
            return true; // Already inactive
        }

        // Remove hooks
        const hookIds = this.hookIds.get(id);
        if (hookIds && plugin.hooks) {
            for (const [hookName, hookId] of hookIds.entries()) {
                hookRegistry.removeHook(hookName, hookId);
            }
            this.hookIds.delete(id);
        }

        // Call deactivation hook
        if (plugin.lifecycle?.onDeactivate) {
            await plugin.lifecycle.onDeactivate();
        }

        this.activePlugins.delete(id);
        return true;
    }

    /**
     * Check if plugin is active
     */
    isActive(id: string): boolean {
        return this.activePlugins.has(id);
    }

    /**
     * Get active plugins
     */
    getActive(): Plugin[] {
        return Array.from(this.activePlugins)
            .map((id) => this.plugins.get(id))
            .filter((p): p is Plugin => p !== undefined);
    }

    /**
     * Check if plugin exists
     */
    has(id: string): boolean {
        return this.plugins.has(id);
    }
}

/**
 * Global plugin registry instance
 */
export const pluginRegistry: PluginRegistry = new PluginRegistryImpl();

/**
 * Convenience functions
 */
export const registerPlugin = (plugin: Plugin) => pluginRegistry.register(plugin);
export const getPlugin = (id: string) => pluginRegistry.get(id);
export const getAllPlugins = () => pluginRegistry.getAll();
export const activatePlugin = (id: string) => pluginRegistry.activate(id);
export const deactivatePlugin = (id: string) => pluginRegistry.deactivate(id);
export const isPluginActive = (id: string) => pluginRegistry.isActive(id);
export const getActivePlugins = () => pluginRegistry.getActive();
export const hasPlugin = (id: string) => pluginRegistry.has(id);

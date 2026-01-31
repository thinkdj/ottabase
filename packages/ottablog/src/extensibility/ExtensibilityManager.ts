/**
 * @ottabase/ottablog - Extensibility Manager
 *
 * WordPress-style unified interface for managing themes and plugins.
 * Handles syncing registry with database, activation/deactivation, and configuration.
 */

import { OttablogPlugin } from '../ottaorm-models/OttablogPlugin';
import { OttablogTheme } from '../ottaorm-models/OttablogTheme';
import { pluginRegistry, type Plugin } from '../plugins';
import { themeRegistry, type Theme } from '../themes';

export interface ExtensibilityOptions {
    /** App ID for multi-tenant support */
    appId?: string;
}

/**
 * Extensibility Manager - WordPress-style theme/plugin management
 */
export class ExtensibilityManager {
    private appId?: string;

    constructor(options?: ExtensibilityOptions) {
        this.appId = options?.appId;
    }

    // ============================================================
    // THEME MANAGEMENT
    // ============================================================

    /**
     * Sync registered themes with database
     * Creates/updates theme records from registry
     */
    async syncThemes(): Promise<void> {
        const registeredThemes = themeRegistry.getAll();

        for (const theme of registeredThemes) {
            const themeId = theme.metadata.id;
            let dbTheme = await OttablogTheme.findByThemeId(themeId, { appId: this.appId });

            if (!dbTheme) {
                // Create new theme record
                dbTheme = await OttablogTheme.create({
                    themeId,
                    name: theme.metadata.name,
                    description: theme.metadata.description || null,
                    version: theme.metadata.version || null,
                    author: theme.metadata.author || null,
                    url: theme.metadata.url || null,
                    screenshot: theme.metadata.screenshot || null,
                    isActive: false,
                    config: null,
                    appId: this.appId || null,
                });
            } else {
                // Update metadata from registry (preserve isActive and config)
                const isActive = dbTheme.get('isActive') as boolean;
                const config = dbTheme.get('config') as Record<string, unknown> | null;

                dbTheme.set('name', theme.metadata.name);
                if (theme.metadata.description) dbTheme.set('description', theme.metadata.description);
                if (theme.metadata.version) dbTheme.set('version', theme.metadata.version);
                if (theme.metadata.author) dbTheme.set('author', theme.metadata.author);
                if (theme.metadata.url) dbTheme.set('url', theme.metadata.url);
                if (theme.metadata.screenshot) dbTheme.set('screenshot', theme.metadata.screenshot);
                dbTheme.set('isActive', isActive);
                dbTheme.set('config', config);

                await dbTheme.save();
            }
        }
    }

    /**
     * Activate a theme
     * Updates database and registry
     */
    async activateTheme(themeId: string): Promise<boolean> {
        // Check if theme exists in registry
        if (!themeRegistry.has(themeId)) {
            throw new Error(`Theme "${themeId}" not found in registry`);
        }

        // Sync themes first to ensure DB is up to date
        await this.syncThemes();

        // Find theme in database
        const dbTheme = await OttablogTheme.findByThemeId(themeId, { appId: this.appId });
        if (!dbTheme) {
            throw new Error(`Theme "${themeId}" not found in database. Run syncThemes() first.`);
        }

        // Activate theme (this will deactivate others)
        await dbTheme.activate({ appId: this.appId });

        // Update registry
        themeRegistry.setActive(themeId);

        return true;
    }

    /**
     * Deactivate active theme
     */
    async deactivateTheme(themeId: string): Promise<boolean> {
        const dbTheme = await OttablogTheme.findByThemeId(themeId, { appId: this.appId });
        if (!dbTheme) {
            return false;
        }

        await dbTheme.deactivate();
        return true;
    }

    /**
     * Get active theme
     */
    async getActiveTheme(): Promise<OttablogTheme | null> {
        return OttablogTheme.active({ appId: this.appId });
    }

    /**
     * Update theme configuration
     */
    async updateThemeConfig(themeId: string, config: Record<string, unknown>): Promise<boolean> {
        const dbTheme = await OttablogTheme.findByThemeId(themeId, { appId: this.appId });
        if (!dbTheme) {
            throw new Error(`Theme "${themeId}" not found`);
        }

        await dbTheme.updateConfig(config);
        return true;
    }

    /**
     * Merge theme configuration (preserves existing keys)
     */
    async mergeThemeConfig(themeId: string, config: Record<string, unknown>): Promise<boolean> {
        const dbTheme = await OttablogTheme.findByThemeId(themeId, { appId: this.appId });
        if (!dbTheme) {
            throw new Error(`Theme "${themeId}" not found`);
        }

        await dbTheme.mergeConfig(config);
        return true;
    }

    /**
     * Get theme configuration
     */
    async getThemeConfig(themeId: string): Promise<Record<string, unknown> | null> {
        const dbTheme = await OttablogTheme.findByThemeId(themeId, { appId: this.appId });
        if (!dbTheme) {
            return null;
        }

        return (dbTheme.get('config') as Record<string, unknown>) || null;
    }

    /**
     * Get all themes (from database)
     */
    async getAllThemes() {
        const query: Record<string, unknown> = {};
        if (this.appId) query.appId = this.appId;

        return OttablogTheme.where(query, {
            orderBy: 'name',
            orderDirection: 'asc',
        });
    }

    // ============================================================
    // PLUGIN MANAGEMENT
    // ============================================================

    /**
     * Sync registered plugins with database
     * Creates/updates plugin records from registry
     */
    async syncPlugins(): Promise<void> {
        const registeredPlugins = pluginRegistry.getAll();

        for (const plugin of registeredPlugins) {
            const pluginId = plugin.metadata.id;
            let dbPlugin = await OttablogPlugin.findByPluginId(pluginId, { appId: this.appId });

            if (!dbPlugin) {
                // Create new plugin record
                dbPlugin = await OttablogPlugin.create({
                    pluginId,
                    name: plugin.metadata.name,
                    description: plugin.metadata.description || null,
                    version: plugin.metadata.version || null,
                    author: plugin.metadata.author || null,
                    url: plugin.metadata.url || null,
                    enabled: false,
                    config: null,
                    appId: this.appId || null,
                });
            } else {
                // Update metadata from registry (preserve enabled and config)
                const enabled = dbPlugin.get('enabled') as boolean;
                const config = dbPlugin.get('config') as Record<string, unknown> | null;

                dbPlugin.set('name', plugin.metadata.name);
                if (plugin.metadata.description) dbPlugin.set('description', plugin.metadata.description);
                if (plugin.metadata.version) dbPlugin.set('version', plugin.metadata.version);
                if (plugin.metadata.author) dbPlugin.set('author', plugin.metadata.author);
                if (plugin.metadata.url) dbPlugin.set('url', plugin.metadata.url);
                dbPlugin.set('enabled', enabled);
                dbPlugin.set('config', config);

                await dbPlugin.save();
            }
        }
    }

    /**
     * Enable a plugin
     * Updates database and registry
     */
    async enablePlugin(pluginId: string): Promise<boolean> {
        // Check if plugin exists in registry
        if (!pluginRegistry.has(pluginId)) {
            throw new Error(`Plugin "${pluginId}" not found in registry`);
        }

        // Sync plugins first to ensure DB is up to date
        await this.syncPlugins();

        // Find plugin in database
        const dbPlugin = await OttablogPlugin.findByPluginId(pluginId, { appId: this.appId });
        if (!dbPlugin) {
            throw new Error(`Plugin "${pluginId}" not found in database. Run syncPlugins() first.`);
        }

        // Enable plugin in database
        await dbPlugin.enable();

        // Activate plugin in registry
        await pluginRegistry.activate(pluginId);

        return true;
    }

    /**
     * Disable a plugin
     * Updates database and registry
     */
    async disablePlugin(pluginId: string): Promise<boolean> {
        // Find plugin in database
        const dbPlugin = await OttablogPlugin.findByPluginId(pluginId, { appId: this.appId });
        if (!dbPlugin) {
            return false;
        }

        // Disable plugin in database
        await dbPlugin.disable();

        // Deactivate plugin in registry
        await pluginRegistry.deactivate(pluginId);

        return true;
    }

    /**
     * Get enabled plugins
     */
    async getEnabledPlugins() {
        return OttablogPlugin.enabled({ appId: this.appId });
    }

    /**
     * Check if plugin is enabled
     */
    async isPluginEnabled(pluginId: string): Promise<boolean> {
        const dbPlugin = await OttablogPlugin.findByPluginId(pluginId, { appId: this.appId });
        return dbPlugin ? (dbPlugin.get('enabled') as boolean) : false;
    }

    /**
     * Update plugin configuration
     */
    async updatePluginConfig(pluginId: string, config: Record<string, unknown>): Promise<boolean> {
        const dbPlugin = await OttablogPlugin.findByPluginId(pluginId, { appId: this.appId });
        if (!dbPlugin) {
            throw new Error(`Plugin "${pluginId}" not found`);
        }

        await dbPlugin.updateConfig(config);
        return true;
    }

    /**
     * Merge plugin configuration (preserves existing keys)
     */
    async mergePluginConfig(pluginId: string, config: Record<string, unknown>): Promise<boolean> {
        const dbPlugin = await OttablogPlugin.findByPluginId(pluginId, { appId: this.appId });
        if (!dbPlugin) {
            throw new Error(`Plugin "${pluginId}" not found`);
        }

        await dbPlugin.mergeConfig(config);
        return true;
    }

    /**
     * Get plugin configuration
     */
    async getPluginConfig(pluginId: string): Promise<Record<string, unknown> | null> {
        const dbPlugin = await OttablogPlugin.findByPluginId(pluginId, { appId: this.appId });
        if (!dbPlugin) {
            return null;
        }

        return (dbPlugin.get('config') as Record<string, unknown>) || null;
    }

    /**
     * Get all plugins (from database)
     */
    async getAllPlugins() {
        const query: Record<string, unknown> = {};
        if (this.appId) query.appId = this.appId;

        return OttablogPlugin.where(query, {
            orderBy: 'name',
            orderDirection: 'asc',
        });
    }

    // ============================================================
    // INITIALIZATION & SYNC
    // ============================================================

    /**
     * Initialize extensibility system
     * Syncs themes and plugins, activates enabled plugins, sets active theme
     */
    async initialize(): Promise<void> {
        // Sync themes and plugins
        await this.syncThemes();
        await this.syncPlugins();

        // Activate enabled plugins
        const enabledPlugins = await this.getEnabledPlugins();
        for (const plugin of enabledPlugins) {
            const pluginId = plugin.get('pluginId') as string;
            try {
                await pluginRegistry.activate(pluginId);
            } catch (error) {
                console.warn(`Failed to activate plugin "${pluginId}":`, error);
            }
        }

        // Set active theme
        const activeTheme = await this.getActiveTheme();
        if (activeTheme) {
            const themeId = activeTheme.get('themeId') as string;
            themeRegistry.setActive(themeId);
        }
    }

    /**
     * Sync everything (themes + plugins)
     */
    async syncAll(): Promise<void> {
        await this.syncThemes();
        await this.syncPlugins();
    }
}

/**
 * Create a new ExtensibilityManager instance
 */
export function createExtensibilityManager(options?: ExtensibilityOptions): ExtensibilityManager {
    return new ExtensibilityManager(options);
}

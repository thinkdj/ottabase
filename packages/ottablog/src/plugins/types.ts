/**
 * @ottabase/ottablog - Plugin System Types
 */

import type { ReactNode } from 'react';
import type { BlogPostData } from '../components/BlogRenderer';
import type { HookName } from '../hooks/types';

/**
 * Plugin metadata
 */
export interface PluginMetadata {
    /** Unique plugin identifier */
    id: string;
    /** Plugin name */
    name: string;
    /** Plugin description */
    description?: string;
    /** Plugin version */
    version?: string;
    /** Plugin author */
    author?: string;
    /** Plugin URL */
    url?: string;
    /** Plugin tags */
    tags?: string[];
}

/**
 * Plugin activation/deactivation hooks
 */
export interface PluginLifecycle {
    /** Called when plugin is activated */
    onActivate?: () => void | Promise<void>;
    /** Called when plugin is deactivated */
    onDeactivate?: () => void | Promise<void>;
}

/**
 * Plugin hook registrations
 */
export interface PluginHooks {
    /** Hook name -> callback mappings */
    [hook: HookName]: Array<{
        callback: (...args: unknown[]) => unknown | Promise<unknown>;
        priority?: number;
        id?: string;
    }>;
}

/**
 * Complete plugin definition
 */
export interface Plugin {
    /** Plugin metadata */
    metadata: PluginMetadata;
    /** Plugin lifecycle hooks */
    lifecycle?: PluginLifecycle;
    /** Hook registrations */
    hooks?: PluginHooks;
    /** Custom render functions (optional) */
    renderers?: {
        [key: string]: (post: BlogPostData, ...args: unknown[]) => ReactNode;
    };
    /** Plugin configuration options (for admin UI) */
    options?: Record<string, unknown>;
}

/**
 * Plugin registry interface
 */
export interface PluginRegistry {
    /** Register a plugin */
    register(plugin: Plugin): void;
    /** Get plugin by ID */
    get(id: string): Plugin | null;
    /** Get all plugins */
    getAll(): Plugin[];
    /** Activate a plugin */
    activate(id: string): Promise<boolean>;
    /** Deactivate a plugin */
    deactivate(id: string): Promise<boolean>;
    /** Check if plugin is active */
    isActive(id: string): boolean;
    /** Get active plugins */
    getActive(): Plugin[];
    /** Check if plugin exists */
    has(id: string): boolean;
}

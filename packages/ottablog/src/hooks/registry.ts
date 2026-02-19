/**
 * @ottabase/ottablog - Hook Registry
 *
 * Ottablog hook system implementation
 */

import type { HookCallback, HookEntry, HookName, HookPriority, HookRegistry } from './types';

/**
 * Default hook priority
 */
const DEFAULT_PRIORITY = 10;

/**
 * Hook Registry Implementation
 */
class HookRegistryImpl implements HookRegistry {
    private filters: Map<string, HookEntry[]> = new Map();
    private actions: Map<string, HookEntry[]> = new Map();
    private nextId = 1;

    /**
     * Generate unique hook ID
     */
    private generateId(): string {
        return `hook_${Date.now()}_${this.nextId++}`;
    }

    /**
     * Register a filter hook
     */
    addFilter<T = unknown>(
        hook: HookName,
        callback: HookCallback<T>,
        priority: HookPriority = DEFAULT_PRIORITY,
        id?: string,
    ): string {
        const hookId = id || this.generateId();
        const entry: HookEntry<T> = {
            id: hookId,
            callback,
            priority,
        };

        if (!this.filters.has(hook)) {
            this.filters.set(hook, []);
        }

        const hooks = this.filters.get(hook)!;
        hooks.push(entry);
        // Sort by priority (lower = earlier)
        hooks.sort((a, b) => a.priority - b.priority);

        return hookId;
    }

    /**
     * Register an action hook
     */
    addAction(hook: HookName, callback: HookCallback, priority: HookPriority = DEFAULT_PRIORITY, id?: string): string {
        const hookId = id || this.generateId();
        const entry: HookEntry = {
            id: hookId,
            callback,
            priority,
        };

        if (!this.actions.has(hook)) {
            this.actions.set(hook, []);
        }

        const hooks = this.actions.get(hook)!;
        hooks.push(entry);
        // Sort by priority (lower = earlier)
        hooks.sort((a, b) => a.priority - b.priority);

        return hookId;
    }

    /**
     * Remove a hook by ID
     */
    removeHook(hook: HookName, id: string): boolean {
        let removed = false;

        // Remove from filters
        const filterHooks = this.filters.get(hook);
        if (filterHooks) {
            const index = filterHooks.findIndex((h) => h.id === id);
            if (index !== -1) {
                filterHooks.splice(index, 1);
                removed = true;
            }
        }

        // Remove from actions
        const actionHooks = this.actions.get(hook);
        if (actionHooks) {
            const index = actionHooks.findIndex((h) => h.id === id);
            if (index !== -1) {
                actionHooks.splice(index, 1);
                removed = true;
            }
        }

        return removed;
    }

    /**
     * Apply filters - transforms data through registered callbacks
     */
    async applyFilters<T = unknown>(hook: HookName, value: T, ...args: unknown[]): Promise<T> {
        const hooks = this.filters.get(hook);
        if (!hooks || hooks.length === 0) {
            return value;
        }

        let result = value;
        for (const entry of hooks) {
            try {
                const callbackResult = await entry.callback(result, ...args);
                result = callbackResult as T;
            } catch (error) {
                console.error(`Error in filter hook "${hook}" (${entry.id}):`, error);
                // Continue with previous value on error
            }
        }

        return result;
    }

    /**
     * Do action - executes all registered callbacks
     */
    async doAction(hook: HookName, ...args: unknown[]): Promise<void> {
        const hooks = this.actions.get(hook);
        if (!hooks || hooks.length === 0) {
            return;
        }

        for (const entry of hooks) {
            try {
                await entry.callback(...args);
            } catch (error) {
                console.error(`Error in action hook "${hook}" (${entry.id}):`, error);
                // Continue execution on error
            }
        }
    }

    /**
     * Check if hook has registered callbacks
     */
    hasHook(hook: HookName): boolean {
        return (
            (this.filters.has(hook) && this.filters.get(hook)!.length > 0) ||
            (this.actions.has(hook) && this.actions.get(hook)!.length > 0)
        );
    }

    /**
     * Get all registered hooks for a hook name
     */
    getHooks(hook: HookName): HookEntry[] {
        const filterHooks = this.filters.get(hook) || [];
        const actionHooks = this.actions.get(hook) || [];
        return [...filterHooks, ...actionHooks].sort((a, b) => a.priority - b.priority);
    }

    /**
     * Clear all hooks
     */
    clear(): void {
        this.filters.clear();
        this.actions.clear();
        this.nextId = 1;
    }
}

/**
 * Global hook registry instance
 */
export const hookRegistry: HookRegistry = new HookRegistryImpl();

/**
 * Convenience functions
 */
export const addFilter = <T = unknown>(
    hook: HookName,
    callback: HookCallback<T>,
    priority?: HookPriority,
    id?: string,
) => hookRegistry.addFilter(hook, callback, priority, id);

export const addAction = (hook: HookName, callback: HookCallback, priority?: HookPriority, id?: string) =>
    hookRegistry.addAction(hook, callback, priority, id);

export const removeHook = (hook: HookName, id: string) => hookRegistry.removeHook(hook, id);

export const applyFilters = <T = unknown>(hook: HookName, value: T, ...args: unknown[]) =>
    hookRegistry.applyFilters(hook, value, ...args);

export const doAction = (hook: HookName, ...args: unknown[]) => hookRegistry.doAction(hook, ...args);

export const hasHook = (hook: HookName) => hookRegistry.hasHook(hook);

export const getHooks = (hook: HookName) => hookRegistry.getHooks(hook);

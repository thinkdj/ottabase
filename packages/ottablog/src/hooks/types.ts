/**
 * @ottabase/ottablog - Hook System Types
 *
 * Ottablog hooks system for extensibility
 */

/**
 * Hook priority - determines execution order
 */
export type HookPriority = number;

/**
 * Hook callback function type
 */
export type HookCallback<T = unknown> = (...args: T[]) => T | Promise<T>;

/**
 * Hook filter callback - transforms data
 */
export type FilterCallback<T = unknown> = (value: T, ...args: unknown[]) => T | Promise<T>;

/**
 * Hook action callback - performs side effects
 */
export type ActionCallback = (...args: unknown[]) => void | Promise<void>;

/**
 * Registered hook entry
 */
export interface HookEntry<T = unknown> {
    /** Unique identifier for this hook registration */
    id: string;
    /** Callback function */
    callback: HookCallback<T>;
    /** Priority (lower = earlier execution) */
    priority: HookPriority;
    /** Optional context/data */
    context?: unknown;
}

/**
 * Hook registry interface
 */
export interface HookRegistry {
    /** Register a filter hook */
    addFilter<T = unknown>(hook: string, callback: FilterCallback<T>, priority?: HookPriority, id?: string): string;
    /** Register an action hook */
    addAction(hook: string, callback: ActionCallback, priority?: HookPriority, id?: string): string;
    /** Remove a hook */
    removeHook(hook: string, id: string): boolean;
    /** Apply filters - transforms data through registered callbacks */
    applyFilters<T = unknown>(hook: string, value: T, ...args: unknown[]): T | Promise<T>;
    /** Do action - executes all registered callbacks */
    doAction(hook: string, ...args: unknown[]): void | Promise<void>;
    /** Check if hook has registered callbacks */
    hasHook(hook: string): boolean;
    /** Get all registered hooks */
    getHooks(hook: string): HookEntry[];
    /** Clear all hooks */
    clear(): void;
}

/**
 * Common hook names for ottablog
 */
export const HOOKS = {
    // Content hooks
    'post.content.before': 'post.content.before',
    'post.content.after': 'post.content.after',
    'post.content.filter': 'post.content.filter',
    'post.excerpt.filter': 'post.excerpt.filter',
    'post.title.filter': 'post.title.filter',

    // Render hooks
    'post.render.before': 'post.render.before',
    'post.render.after': 'post.render.after',
    'post.render.header': 'post.render.header',
    'post.render.footer': 'post.render.footer',
    'post.render.metadata': 'post.render.metadata',

    // Card hooks
    'post.card.before': 'post.card.before',
    'post.card.after': 'post.card.after',
    'post.card.image': 'post.card.image',

    // Theme hooks
    'theme.register': 'theme.register',
    'theme.activate': 'theme.activate',

    // Plugin hooks
    'plugin.register': 'plugin.register',
    'plugin.activate': 'plugin.activate',
} as const;

export type HookName = (typeof HOOKS)[keyof typeof HOOKS] | string;

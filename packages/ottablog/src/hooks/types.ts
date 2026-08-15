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
 * WHY `...args: never[]` AND NOT `unknown[]` — do not "fix" this.
 *
 * Every hook passes different trailing arguments (`post.title.filter` gets the post,
 * `post.photoJournal.filter` gets the post, actions get whatever fired them), so the registry
 * cannot name them. `never[]` is the encoding that lets a plugin DECLARE the ones it knows:
 *
 *     addFilter(HOOKS['post.blurb.filter'], (value: string, post: BlogPostData) => value.trim());
 *
 * That assignment compiles under `never[]` (never is assignable to `BlogPostData`) and FAILS under
 * `unknown[]` ("Type 'unknown' is not assignable to type 'BlogPostData'"). Widening these to
 * `unknown[]` would break every typed theme and plugin in the ecosystem. The trade-off is that an
 * un-annotated trailing parameter infers as `never`, so plugin authors annotate — which is the
 * documented way to use these.
 */
export type HookCallback<T = unknown> = (value: T, ...args: never[]) => T | Promise<T>;

/**
 * Hook filter callback - transforms data. See HookCallback for why the rest args are `never[]`.
 */
export type FilterCallback<T = unknown> = (value: T, ...args: never[]) => T | Promise<T>;

/**
 * Hook action callback - performs side effects. See HookCallback for the `never[]` rationale.
 */
export type ActionCallback = (...args: never[]) => void | Promise<void>;

/**
 * Registered hook entry
 */
export interface HookEntry {
    /** Unique identifier for this hook registration */
    id: string;
    /** Callback function */
    callback: (...args: never[]) => unknown | Promise<unknown>;
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
    'post.blurb.filter': 'post.blurb.filter',
    'post.photoJournal.filter': 'post.photoJournal.filter',

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

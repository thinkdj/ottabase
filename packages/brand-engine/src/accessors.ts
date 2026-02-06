import type { DesignTokens } from './tokens';

/**
 * Accessor Types for dot-notation paths.
 * Warning: Deep nesting can tax the TS compiler. We limit recursion depth if needed,
 * but DesignTokens is relatively shallow.
 */

// Helper to join paths
type Join<K, P> = K extends string | number ? (P extends string | number ? `${K}.${P}` : never) : never;

// Recursive type to get all leaves
type Paths<T> = T extends object
    ? {
          [K in keyof T]-?: K extends string | number ? `${K}` | Join<K, Paths<T[K]>> : never;
      }[keyof T]
    : never;

// Helper to get value at path
type PathValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
    ? K extends keyof T
        ? PathValue<T[K], Rest>
        : never
    : P extends keyof T
      ? T[P]
      : never;

/**
 * Strictly typed accessor for DesignTokens.
 * Usage: getToken(tokens, 'colors.primary.500')
 */
export function getToken<P extends Paths<DesignTokens>>(
    tokens: DesignTokens,
    path: P,
): PathValue<DesignTokens, P> | undefined {
    const keys = path.split('.');
    let current: any = tokens;

    for (const key of keys) {
        if (current === undefined || current === null) return undefined;
        current = current[key];
    }

    return current as PathValue<DesignTokens, P>;
}

/**
 * Curried version: createTokenAccessor(tokens)('colors.primary.500')
 */
export function createTokenAccessor(tokens: DesignTokens) {
    return <P extends Paths<DesignTokens>>(path: P): PathValue<DesignTokens, P> | undefined => getToken(tokens, path);
}

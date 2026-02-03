/**
 * Simple deep merge utility for i18n resources, taking away need for a dep package
 * Merges source objects into target, with source taking precedence
 */
export function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
    const result = { ...target };

    for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            const sourceValue = source[key];
            const targetValue = result[key];

            // If both are objects, merge recursively
            if (
                sourceValue &&
                typeof sourceValue === 'object' &&
                !Array.isArray(sourceValue) &&
                targetValue &&
                typeof targetValue === 'object' &&
                !Array.isArray(targetValue)
            ) {
                result[key] = deepMerge(targetValue, sourceValue);
            } else {
                // Otherwise, source overwrites target
                result[key] = sourceValue as any;
            }
        }
    }

    return result;
}

// ============================================================
// @ottabase/db - Feature Registry
// ============================================================

import type { FeatureId, FeatureRegistry, FeatureSchemaDefinition } from './config';

// Re-export defineFeatureSchema for convenience
export { defineFeatureSchema } from './config';
export type { FeatureSchemaDefinition } from './config';

/**
 * Creates a new feature registry instance
 *
 * The registry manages feature schema definitions and handles
 * dependency resolution with topological sorting.
 *
 * @example
 * ```typescript
 * const registry = createFeatureRegistry();
 *
 * registry.register({
 *   featureId: "auth",
 *   name: "Authentication",
 *   packageName: "@ottabase/auth",
 *   schemaPath: "prisma/auth.schema.prisma",
 * });
 *
 * const features = registry.resolve(["auth", "billing"]);
 * ```
 */
export function createFeatureRegistry(): FeatureRegistry {
    const features = new Map<FeatureId, FeatureSchemaDefinition>();

    return {
        register(definition: FeatureSchemaDefinition): void {
            if (features.has(definition.featureId)) {
                console.warn(`[db] Feature "${definition.featureId}" is already registered. Overwriting.`);
            }
            features.set(definition.featureId, definition);
        },

        get(featureId: FeatureId): FeatureSchemaDefinition | undefined {
            return features.get(featureId);
        },

        getAll(): FeatureSchemaDefinition[] {
            return Array.from(features.values());
        },

        has(featureId: FeatureId): boolean {
            return features.has(featureId);
        },

        /**
         * Resolve features with dependencies using topological sort
         *
         * This ensures that features are returned in the correct order,
         * with dependencies appearing before the features that depend on them.
         *
         * @throws Error if a circular dependency is detected
         * @throws Error if a required feature is not registered
         */
        resolve(featureIds: FeatureId[]): FeatureSchemaDefinition[] {
            const resolved: FeatureSchemaDefinition[] = [];
            const visited = new Set<FeatureId>();
            const visiting = new Set<FeatureId>();

            const visit = (featureId: FeatureId): void => {
                // Already processed
                if (visited.has(featureId)) return;

                // Circular dependency detection
                if (visiting.has(featureId)) {
                    throw new Error(`[db] Circular dependency detected for feature: ${featureId}`);
                }

                const feature = features.get(featureId);
                if (!feature) {
                    throw new Error(
                        `[db] Feature "${featureId}" not found in registry. ` +
                            `Available features: ${Array.from(features.keys()).join(', ') || 'none'}`,
                    );
                }

                visiting.add(featureId);

                // Visit dependencies first (ensures correct order)
                for (const dep of feature.dependencies || []) {
                    visit(dep);
                }

                visiting.delete(featureId);
                visited.add(featureId);
                resolved.push(feature);
            };

            // Process each requested feature
            for (const featureId of featureIds) {
                visit(featureId);
            }

            return resolved;
        },
    };
}

// ============================================================
// GLOBAL REGISTRY SINGLETON
// ============================================================

let globalRegistry: FeatureRegistry | null = null;

/**
 * Get the global feature registry (singleton)
 *
 * This is the default registry used by the schema concatenation
 * and migration tools. Features should be registered here.
 *
 * @example
 * ```typescript
 * import { getFeatureRegistry } from "@ottabase/db";
 *
 * const registry = getFeatureRegistry();
 * console.log(registry.getAll());
 * ```
 */
export function getFeatureRegistry(): FeatureRegistry {
    if (!globalRegistry) {
        globalRegistry = createFeatureRegistry();
    }
    return globalRegistry;
}

/**
 * Register a feature schema in the global registry
 *
 * This is a convenience function for registering features
 * without needing to get the registry first.
 *
 * @example
 * ```typescript
 * import { registerFeature, defineFeatureSchema } from "@ottabase/db";
 *
 * registerFeature(defineFeatureSchema({
 *   featureId: "auth",
 *   name: "Authentication",
 *   packageName: "@ottabase/auth",
 *   schemaPath: "prisma/auth.schema.prisma",
 * }));
 * ```
 */
export function registerFeature(definition: FeatureSchemaDefinition): void {
    getFeatureRegistry().register(definition);
}

/**
 * Reset the global registry (mainly for testing)
 */
export function resetFeatureRegistry(): void {
    globalRegistry = null;
}

/**
 * Auto-discover and register features from installed packages
 *
 * This function attempts to find and load feature definitions
 * from packages matching the pattern `@ottabase/feature-*` or
 * packages with a `db.feature.ts` file.
 *
 * @param packageNames - Optional list of package names to load
 */
export async function discoverFeatures(packageNames?: string[]): Promise<FeatureSchemaDefinition[]> {
    const registry = getFeatureRegistry();
    const discovered: FeatureSchemaDefinition[] = [];

    const packagesToLoad = packageNames || ['@ottabase/auth', '@ottabase/billing', '@ottabase/notifications'];

    for (const packageName of packagesToLoad) {
        try {
            // Try to require the feature definition
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const featureModule = require(`${packageName}/db.feature`);
            const definition: FeatureSchemaDefinition = featureModule.default || featureModule;

            if (definition && definition.featureId) {
                registry.register(definition);
                discovered.push(definition);
            }
        } catch {
            // Package not installed or doesn't have a feature definition
            // This is expected for optional features
        }
    }

    return discovered;
}

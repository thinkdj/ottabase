// ============================================================
// @ottabase/ottaorm - Model Registry
// ============================================================
// Register models for dynamic lookup by entity name
// ============================================================

import type { BaseModel } from '../base/BaseModel';
import type { PackageType } from '../base/AbstractBaseModel';

type ModelClass = typeof BaseModel;

/**
 * Metadata associated with a registered model
 */
export interface ModelMetadata {
    modelName: string; // e.g., "User", "Shortlink", "Todo"
    packageName: string; // e.g., "@ottabase/ottaorm", "app", "@ottabase/shortlinks"
    tableName: string; // e.g., "users", "shortlinks", "todos"
    packageType: PackageType;
}

/**
 * Registry entry containing model class and metadata
 */
export interface ModelRegistryEntry {
    model: ModelClass;
    metadata: ModelMetadata;
}

// Global model registry
const modelRegistry: Map<string, ModelRegistryEntry> = new Map();

/**
 * Infer metadata from model class (uses static properties with fallbacks)
 */
function inferMetadata(model: ModelClass): ModelMetadata {
    return {
        modelName: model.name, // From JS class name
        tableName: model.entity, // From model.entity
        packageName: model.packageName || 'unknown', // From static property or fallback
        packageType: model.packageType || 'core', // From static property or fallback
    };
}

/**
 * Register a model class for dynamic lookup
 *
 * @example
 * ```typescript
 * // Automatic extraction from static properties
 * registerModel(User);
 *
 * // Override if needed (rare)
 * registerModel(User, { packageName: '@custom/pkg', packageType: 'package' });
 * ```
 */
export function registerModel(model: ModelClass, metadata?: Pick<ModelMetadata, 'packageName' | 'packageType'>): void {
    const entry: ModelRegistryEntry = {
        model,
        metadata: metadata
            ? {
                  modelName: model.name,
                  tableName: model.entity,
                  packageName: metadata.packageName,
                  packageType: metadata.packageType,
              }
            : inferMetadata(model), // Use static properties or fallbacks
    };
    modelRegistry.set(model.entity, entry);
}

/**
 * Register multiple models at once
 *
 * @example
 * ```typescript
 * // Simple registration - auto-extract from static properties
 * registerModels([User, Tag, Todo]);
 *
 * // With overrides (rare)
 * registerModels([
 *   User,
 *   { model: Tag, metadata: { packageName: '@custom/pkg', packageType: 'package' } },
 *   Todo,
 * ]);
 * ```
 */
export function registerModels(
    models: Array<
        | ModelClass
        | {
              model: ModelClass;
              metadata?: Pick<ModelMetadata, 'packageName' | 'packageType'>;
          }
    >,
): void {
    for (const entry of models) {
        if (typeof entry === 'function') {
            // It's a plain model class
            registerModel(entry);
        } else {
            // It's an object with model and optional metadata
            registerModel(entry.model, entry.metadata);
        }
    }
}

/**
 * Get a model class by entity name
 *
 * @example
 * ```typescript
 * const UserModel = getModel("users");
 * const users = await UserModel.all();
 * ```
 */
export function getModel(entityName: string): ModelClass | undefined {
    const entry = modelRegistry.get(entityName);
    return entry?.model;
}

/**
 * Get a model with its metadata by entity name
 *
 * @example
 * ```typescript
 * const entry = getModelWithMetadata("users");
 * console.log(entry.metadata.packageName); // "@ottabase/ottaorm"
 * ```
 */
export function getModelWithMetadata(entityName: string): ModelRegistryEntry | undefined {
    return modelRegistry.get(entityName);
}

/**
 * Get all registered models with their metadata
 *
 * @example
 * ```typescript
 * const allModels = getAllModelsMetadata();
 * for (const [entityName, entry] of allModels) {
 *   console.log(`${entityName}: ${entry.metadata.packageName}`);
 * }
 * ```
 */
export function getAllModelsMetadata(): Map<string, ModelRegistryEntry> {
    return new Map(modelRegistry);
}

/**
 * Check if a model is registered
 */
export function hasModel(entityName: string): boolean {
    return modelRegistry.has(entityName);
}

/**
 * Get all registered model names
 */
export function getRegisteredModels(): string[] {
    return Array.from(modelRegistry.keys());
}

/**
 * Clear all registered models (useful for testing)
 */
export function clearModelRegistry(): void {
    modelRegistry.clear();
}

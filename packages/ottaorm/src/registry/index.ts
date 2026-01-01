// ============================================================
// @ottabase/ottaorm - Model Registry
// ============================================================
// Register models for dynamic lookup by entity name
// ============================================================

import type { BaseModel } from "../base/BaseModel";

type ModelClass = typeof BaseModel;

// Global model registry
const modelRegistry: Map<string, ModelClass> = new Map();

/**
 * Register a model class for dynamic lookup
 *
 * @example
 * ```typescript
 * import { registerModel, User, Post } from "@ottabase/ottaorm";
 *
 * // Register models at app startup
 * registerModel(User);
 * registerModel(Post);
 * ```
 */
export function registerModel(model: ModelClass): void {
  modelRegistry.set(model.entity, model);
}

/**
 * Register multiple models at once
 *
 * @example
 * ```typescript
 * import { registerModels, User, Post, Tag } from "@ottabase/ottaorm";
 *
 * registerModels([User, Post, Tag]);
 * ```
 */
export function registerModels(models: ModelClass[]): void {
  for (const model of models) {
    registerModel(model);
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
  return modelRegistry.get(entityName);
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

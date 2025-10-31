import { modelRegistry } from '../metadata/ModelRegistry';

/**
 * Options for the Model decorator
 */
export interface ModelOptions {
  /** Table/collection name (defaults to lowercase model name) */
  tableName?: string;

  /** Primary key field name (defaults to 'id') */
  primaryKey?: string;

  /** Enable/disable timestamps (defaults to true) */
  timestamps?: boolean;

  /** Enable/disable soft deletes (defaults to false) */
  softDeletes?: boolean;

  /** Fields to hide from JSON by default */
  hidden?: string[];

  /** Computed properties to append to JSON */
  appends?: string[];

  /** Relations to eager load by default */
  with?: string[];
}

/**
 * Model decorator to configure model metadata
 *
 * @example
 * ```typescript
 * @Model({
 *   tableName: 'posts',
 *   timestamps: true,
 *   hidden: ['authorId'],
 *   appends: ['excerpt'],
 *   with: ['author']
 * })
 * class Post extends BaseModel {
 *   // ...
 * }
 * ```
 */
export function Model(options: ModelOptions = {}): ClassDecorator {
  return function <T extends Function>(target: T) {
    const modelName = target.name;

    // Register model metadata
    modelRegistry.registerModel(modelName, {
      name: modelName,
      tableName: options.tableName || modelName.toLowerCase(),
      primaryKey: options.primaryKey || 'id',
      timestamps: options.timestamps ?? true,
      softDeletes: options.softDeletes ?? false,
      hidden: new Set(options.hidden || []),
      appends: new Set(options.appends || []),
      with: new Set(options.with || []),
      fields: new Map(),
      relations: new Map(),
    });

    // Store on constructor for runtime access
    (target as any)._modelOptions = options;

    return target;
  };
}

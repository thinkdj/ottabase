/**
 * @ottabase/models - Powerful ActiveRecord-style model abstraction layer
 *
 * Features:
 * - Class-based models with decorators
 * - Fluent query builder
 * - Field metadata for automatic CRUD/form generation
 * - Relationships (hasOne, hasMany, belongsTo, belongsToMany)
 * - Validation with Zod
 * - Hidden fields and computed properties
 * - Getters/setters for fields
 * - JSON serialization
 *
 * @example
 * ```typescript
 * import { Post, Tag, Category } from '@ottabase/models';
 *
 * // Query with relationships
 * const posts = await Post.query()
 *   .with('tags', 'categories', 'author')
 *   .where('published', true)
 *   .orderBy('createdAt', 'desc')
 *   .limit(10)
 *   .get();
 *
 * // Simplified syntax
 * const posts = await Post.fetch(100).with('tags', 'categories').get();
 *
 * // Create a post
 * const post = await Post.create({
 *   title: 'My Post',
 *   content: 'Content here...',
 *   published: true,
 * });
 *
 * // Get field metadata for form generation
 * const fields = Post.getAllFields();
 * ```
 *
 * @module @ottabase/models
 */

// Base classes and types
export { BaseModel } from './base/BaseModel';
export { QueryBuilder } from './base/QueryBuilder';
export * from './base/types';

// Decorators
export {
  Model,
  Field,
  PrimaryKey,
  Computed,
  Hidden,
  HasOne,
  HasMany,
  BelongsTo,
  BelongsToMany,
  With,
} from './decorators';
export type { ModelOptions } from './decorators';

// Metadata registry
export { modelRegistry, ModelRegistry } from './metadata';

// Base models
export { Post } from './models/Post';
export { Tag } from './models/Tag';
export { Category } from './models/Category';

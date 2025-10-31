import type { RelationMetadata } from '../base/types';
import { modelRegistry } from '../metadata/ModelRegistry';

/**
 * Base relation decorator factory
 */
function createRelationDecorator(
  type: RelationMetadata['type']
): (
  model: string | (new () => any),
  options?: Partial<Omit<RelationMetadata, 'type' | 'model'>>
) => PropertyDecorator {
  return function (model, options = {}) {
    return function (target: any, propertyKey: string | symbol) {
      const modelName = target.constructor.name;
      const relationName = String(propertyKey);

      const metadata: RelationMetadata = {
        type,
        model,
        ...options,
      };

      // Register relation metadata
      modelRegistry.registerRelation(modelName, relationName, metadata);

      // Store on prototype for runtime access
      if (!target.constructor._relations) {
        target.constructor._relations = new Map();
      }
      target.constructor._relations.set(relationName, metadata);
    };
  };
}

/**
 * HasOne decorator for one-to-one relationships
 *
 * @example
 * ```typescript
 * class User extends Model {
 *   @HasOne('Profile', { foreignKey: 'userId' })
 *   profile?: Profile;
 * }
 * ```
 */
export const HasOne = createRelationDecorator('hasOne');

/**
 * HasMany decorator for one-to-many relationships
 *
 * @example
 * ```typescript
 * class User extends Model {
 *   @HasMany('Post', { foreignKey: 'authorId' })
 *   posts?: Post[];
 * }
 * ```
 */
export const HasMany = createRelationDecorator('hasMany');

/**
 * BelongsTo decorator for inverse of one-to-many
 *
 * @example
 * ```typescript
 * class Post extends Model {
 *   @BelongsTo('User', { foreignKey: 'authorId' })
 *   author?: User;
 * }
 * ```
 */
export const BelongsTo = createRelationDecorator('belongsTo');

/**
 * BelongsToMany decorator for many-to-many relationships
 *
 * @example
 * ```typescript
 * class Post extends Model {
 *   @BelongsToMany('Tag', {
 *     through: 'PostTag',
 *     pivotForeignKey: 'postId',
 *     pivotRelatedKey: 'tagId'
 *   })
 *   tags?: Tag[];
 * }
 * ```
 */
export const BelongsToMany = createRelationDecorator('belongsToMany');

/**
 * With decorator to mark relation for default eager loading
 *
 * @example
 * ```typescript
 * class Post extends Model {
 *   @BelongsTo('User')
 *   @With()
 *   author?: User;
 * }
 * ```
 */
export function With(): PropertyDecorator {
  return function (target: any, propertyKey: string | symbol) {
    const modelName = target.constructor.name;
    const relationName = String(propertyKey);

    const model = modelRegistry.getOrCreateModel(modelName);
    model.with.add(relationName);

    // Also mark in relation metadata if it exists
    const relation = model.relations.get(relationName);
    if (relation) {
      relation.eagerLoad = true;
    }
  };
}

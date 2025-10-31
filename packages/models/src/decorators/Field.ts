import type { FieldMetadata } from '../base/types';
import { modelRegistry } from '../metadata/ModelRegistry';

/**
 * Field decorator to define model fields with metadata
 *
 * @example
 * ```typescript
 * class Post extends Model {
 *   @Field({ type: 'string', required: true, label: 'Title' })
 *   title!: string;
 *
 *   @Field({ type: 'text', label: 'Content' })
 *   content?: string;
 * }
 * ```
 */
export function Field(metadata: FieldMetadata): PropertyDecorator {
  return function (target: any, propertyKey: string | symbol) {
    const modelName = target.constructor.name;
    const fieldName = String(propertyKey);

    // Register field metadata
    modelRegistry.registerField(modelName, fieldName, metadata);

    // Store on prototype for runtime access
    if (!target.constructor._fields) {
      target.constructor._fields = new Map();
    }
    target.constructor._fields.set(fieldName, metadata);
  };
}

/**
 * Primary key decorator (shorthand for Field with primaryKey: true)
 */
export function PrimaryKey(metadata?: Partial<FieldMetadata>): PropertyDecorator {
  return Field({
    type: 'string',
    primaryKey: true,
    readonly: true,
    ...metadata,
  });
}

/**
 * Computed property decorator (automatically adds to appends)
 */
export function Computed(): PropertyDecorator {
  return function (target: any, propertyKey: string | symbol) {
    const modelName = target.constructor.name;
    const fieldName = String(propertyKey);

    const model = modelRegistry.getOrCreateModel(modelName);
    model.appends.add(fieldName);

    // Store on prototype
    if (!target.constructor._appends) {
      target.constructor._appends = new Set();
    }
    target.constructor._appends.add(fieldName);
  };
}

/**
 * Hidden decorator (excludes field from JSON serialization)
 */
export function Hidden(): PropertyDecorator {
  return function (target: any, propertyKey: string | symbol) {
    const modelName = target.constructor.name;
    const fieldName = String(propertyKey);

    const model = modelRegistry.getOrCreateModel(modelName);
    model.hidden.add(fieldName);

    // Store on prototype
    if (!target.constructor._hidden) {
      target.constructor._hidden = new Set();
    }
    target.constructor._hidden.add(fieldName);
  };
}

// ============================================================
// @ottabase/ottaorm - Base Model Exports
// ============================================================

// Abstract base (shared functionality)
export { AbstractBaseModel } from './AbstractBaseModel';

/**
 * Base exports (Edge-safe)
 *
 * MongoDB-related exports are intentionally excluded here to avoid pulling in the
 * Node-only `mongodb` dependency in Next.js Edge bundles.
 */

// SQL base model
export { BaseModel } from './BaseModel';
export type { IModelConstructorParams } from './BaseModel';

// Shared types
export type {
    ModelFieldType,
    ModelFieldDescriptor,
    ModelFields,
    PackageType,
    PaginationResult,
    RelationshipConfig,
} from './AbstractBaseModel';

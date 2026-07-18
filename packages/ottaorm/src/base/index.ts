// ============================================================
// @ottabase/ottaorm - Base Model Exports
// ============================================================

// Abstract base (shared functionality)
export { AbstractBaseModel } from './AbstractBaseModel';

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

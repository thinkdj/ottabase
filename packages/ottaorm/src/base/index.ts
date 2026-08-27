// ============================================================
// @ottabase/ottaorm - Base Model Exports
// ============================================================

// Abstract base (shared functionality)
export { AbstractBaseModel } from './AbstractBaseModel';

// SQL base model
export { BaseModel, ConcurrentMutationError, QueryBindingLimitError, MAX_SEARCH_TERM_BYTES } from './BaseModel';
export type {
    AtomicMutationGuard,
    CollectionQueryOptions,
    IModelConstructorParams,
    KeysetPagesOptions,
    UpdateMutationContext,
} from './BaseModel';

// Shared types
export type {
    ModelFieldType,
    ModelFieldDescriptor,
    ModelFields,
    PackageType,
    PaginationResult,
    RelationshipConfig,
} from './AbstractBaseModel';

export {
    configureOttaORM,
    getOttaORMMaxAllRows,
    OTTAORM_ALL_HARD_LIMIT,
    OttaORMAllRowsLimitError,
} from '../runtime-config';
export type { OttaORMRuntimeConfig } from '../runtime-config';

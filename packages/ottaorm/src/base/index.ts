// ============================================================
// @ottabase/ottaorm - Base Model Exports
// ============================================================

// Abstract base (shared functionality)
export { AbstractBaseModel } from './AbstractBaseModel';

// SQL base model
export {
    BaseModel,
    ConcurrentMutationError,
    QueryBindingLimitError,
    MAX_SEARCH_TERM_BYTES,
    likeCondition,
} from './BaseModel';
export type {
    AtomicMutationGuard,
    CollectionQueryOptions,
    IModelConstructorParams,
    KeysetPagesOptions,
    PivotWriteOptions,
    UpdateMutationContext,
} from './BaseModel';

// Chainable query builder (`Model.query()`)
export { QueryBuilder, RecordNotFoundError, loadRelations, parseRelationSpec } from './QueryBuilder';
export type { LoadRelationsOptions, RelationSpec, WhereOperator } from './QueryBuilder';

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
    publicFileUrl,
    getOttaORMMaxAllRows,
    OTTAORM_ALL_HARD_LIMIT,
    OttaORMAllRowsLimitError,
} from '../runtime-config';
export type { OttaORMRuntimeConfig } from '../runtime-config';

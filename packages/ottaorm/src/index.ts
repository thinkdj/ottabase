// ============================================================
// @ottabase/ottaorm - Main Exports
// ============================================================

// Connection management (multi-database support)
export { clearAllConnections, clearConnection, getConnection, hasConnection, registerConnection } from './context';

// Model registry (for dynamic model lookup)
export {
    clearModelRegistry,
    getAllModelsMetadata,
    getModel,
    getModelWithMetadata,
    getRegisteredModels,
    hasModel,
    registerModel,
    registerModels,
} from './registry';
export type { ModelMetadata, ModelRegistryEntry } from './registry';

// Generic CRUD handler
export { handleCrud, parseCrudRequest, parseStrictQueryInteger, validateCrudQuery } from './crud';
export type { CrudRequest, CrudResponse } from './crud';

// CrudHub (generic admin data screens): model opt-in and descriptors
export {
    CRUDHUB_DENYLIST,
    CRUDHUB_RELATION_LIMIT,
    actionDescriptors,
    clientFields,
    describeCrudHubModel,
    fillRouteTokens,
    getCrudHubModel,
    isCrudHubModel,
    listCrudHubModels,
} from './crudhub';
export type {
    AdminAction,
    AdminActionContext,
    AdminModelConfig,
    CrudHubActionDescriptor,
    CrudHubRelation,
    CrudHubModelDescriptor,
    CrudHubScope,
} from './crudhub';

// Row-Level Security (RLS)
export {
    RLSError,
    RLSPolicies,
    executeSecureCrudRequest,
    parseSqliteUniqueConstraintForApi,
    getRecentViolations,
    getRegisteredModels as getRLSModels,
    globalRLS,
    initRLS,
    logSecurityViolation,
    registerPolicy,
    rlsMiddleware,
    secureCrud,
} from './rls';
export type {
    AuthorizedMutationContext,
    ModelRLSConfig,
    PrepareAuthorizedMutation,
    RLSPolicy,
    RLSViolation,
    SecureCrudHooks,
    SecureCrudOptions,
    SecurityContext,
    SecurityLevel,
} from './rls';

// Migrations
export { coreMigrations, rollbackMigrations, runMigrations } from './migrations';
export type { Migration } from './migrations';

// Automated migrations (NEW!)
export { autoInit, collectTableSchemas, runAutoMigrations } from './migrations';
export type { AutoInitConfig, RuntimeMigrationConfig } from './migrations';

// Runtime read-safety policy
export {
    configureOttaORM,
    getOttaORMMaxAllRows,
    OTTAORM_ALL_HARD_LIMIT,
    OttaORMAllRowsLimitError,
} from './runtime-config';
export type { OttaORMRuntimeConfig } from './runtime-config';

/**
 * Base models (Edge-safe)
 */
export {
    AbstractBaseModel,
    BaseModel,
    ConcurrentMutationError,
    QueryBindingLimitError,
    QueryBuilder,
    RecordNotFoundError,
    MAX_SEARCH_TERM_BYTES,
    likeCondition,
    loadRelations,
    parseRelationSpec,
} from './base';
export type {
    IModelConstructorParams,
    AtomicMutationGuard,
    CollectionQueryOptions,
    KeysetPagesOptions,
    LoadRelationsOptions,
    PivotWriteOptions,
    RelationSpec,
    WhereOperator,
    ModelFieldDescriptor,
    ModelFieldType,
    ModelFields,
    PackageType,
    PaginationResult,
    RelationshipConfig,
    UpdateMutationContext,
} from './base';

// Validation (Zod schema builder from field metadata)
export {
    DomainValidationError,
    ValidationError,
    buildZodSchema,
    normalizeValidationFailure,
    validateField,
    validateWithSchema,
} from './validation';
export type { DomainValidationErrorOptions, NormalizedValidationFailure, ValidationResult } from './validation';

/**
 * Core models (SQL only - Edge-safe)
 *
 * These exports are safe for Next.js Edge runtime.
 */
export {
    Account,
    AuditLog,
    // Media (core — tracks all uploaded files)
    Media,
    mediaFileStore,
    // Multi-tenant/RBAC models and tables
    Organization,
    OrganizationMember,
    Permission,
    Role,
    ScheduledTask,
    Tag,
    User,
    UserGroup,
    UserGroupMember,
    UserRole,
    VerificationToken,
    accountsTable,
    auditLogsTable,
    mediaTable,
    organizationMembersTable,
    organizationsTable,
    permissionsTable,
    rolesTable,
    scheduledTasksTable,
    tagsTable,
    userGroupMembersTable,
    userGroupsTable,
    userRolesTable,
    usersTable,
    verificationTokensTable,
} from './models';
export type {
    AccountType,
    AuditLogType,
    MediaRecord,
    MediaType,
    MediaVariantInfo,
    NewAccountType,
    NewAuditLogType,
    NewMediaType,
    NewOrganizationMemberType,
    NewOrganizationType,
    NewPermissionType,
    NewRoleType,
    NewTagType,
    NewUserGroupMemberType,
    NewUserGroupType,
    NewUserRoleType,
    NewUserType,
    NewVerificationTokenType,
    OrganizationMemberType,
    OrganizationRosterRole,
    OrganizationRosterStatus,
    // Multi-tenant/RBAC types
    OrganizationType,
    PermissionType,
    RoleType,
    RemoveRosterMembershipResult,
    RosterMembershipChanges,
    RosterMembershipExpected,
    TagType,
    UserGroupMemberType,
    UserGroupType,
    UserRoleType,
    UserType,
    UpdateRosterMembershipResult,
    VerificationTokenType,
} from './models';

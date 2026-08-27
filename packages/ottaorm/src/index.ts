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

// Row-Level Security (RLS)
export {
    RLSError,
    RLSPolicies,
    executeSecureCrudRequest,
    parseSqliteUniqueConstraintForApi,
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
    MAX_SEARCH_TERM_BYTES,
} from './base';
export type {
    IModelConstructorParams,
    AtomicMutationGuard,
    CollectionQueryOptions,
    KeysetPagesOptions,
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
    // Auth SQL models (Edge-safe)
    Authenticator,
    // Media (core — tracks all uploaded files)
    Media,
    // Multi-tenant/RBAC models and tables
    Organization,
    OrganizationMember,
    Permission,
    Role,
    ScheduledTask,
    Session,
    Tag,
    User,
    UserGroup,
    UserGroupMember,
    UserRole,
    VerificationToken,
    accountsTable,
    auditLogsTable,
    authenticatorsTable,
    mediaTable,
    organizationMembersTable,
    organizationsTable,
    permissionsTable,
    rolesTable,
    scheduledTasksTable,
    sessionsTable,
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
    AuthenticatorType,
    MediaType,
    NewAccountType,
    NewAuditLogType,
    NewAuthenticatorType,
    NewMediaType,
    NewOrganizationMemberType,
    NewOrganizationType,
    NewPermissionType,
    NewRoleType,
    NewSessionType,
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
    SessionType,
    TagType,
    UserGroupMemberType,
    UserGroupType,
    UserRoleType,
    UserType,
    UpdateRosterMembershipResult,
    VerificationTokenType,
} from './models';

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
export { handleCrud, parseCrudRequest } from './crud';
export type { CrudRequest, CrudResponse } from './crud';

// Row-Level Security (RLS)
export {
    executeSecureCrudRequest,
    extractSecurityContext,
    getRegisteredModels as getRLSModels,
    globalRLS,
    initRLS,
    logSecurityViolation,
    parseSqliteUniqueConstraintForApi,
    registerPolicy,
    RLSError,
    rlsMiddleware,
    RLSPolicies,
    secureCrud,
} from './rls';
export type { ModelRLSConfig, RLSPolicy, RLSViolation, SecureCrudOptions, SecurityContext, SecurityLevel } from './rls';

// Migrations
export { coreMigrations, rollbackMigrations, runMigrations } from './migrations';
export type { Migration } from './migrations';

// Automated migrations (NEW!)
export { autoInit, collectTableSchemas, runAutoMigrations } from './migrations';
export type { AutoInitConfig, RuntimeMigrationConfig } from './migrations';

/**
 * Base models (Edge-safe)
 *
 * Note: MongoDB-related exports are intentionally NOT exported from this entrypoint
 * because they pull in the `mongodb` package (Node-only) which breaks Next.js Edge runtime.
 */
export { AbstractBaseModel, BaseModel } from './base';
export type {
    IModelConstructorParams,
    ModelFieldDescriptor,
    ModelFields,
    ModelFieldType,
    PackageType,
    PaginationResult,
    RelationshipConfig,
} from './base';

// Validation (Zod schema builder from field metadata)
export { buildZodSchema, validateField, validateWithSchema, ValidationError } from './validation';
export type { ValidationResult } from './validation';

// RBAC Constants (centralized system role utilities)
export { isSystemRoleName, SYSTEM_ORGANIZATION_ID, SYSTEM_ROLE_NAMES_SET } from './rbac-constants';
export type { SystemRoleName } from './rbac-constants';

/**
 * Core models (SQL only - Edge-safe)
 *
 * These exports are safe for Next.js Edge runtime.
 */
export {
    Account,
    accountsTable,
    AuditLog,
    auditLogsTable,
    // Auth.js SQL models (Edge-safe)
    Authenticator,
    authenticatorsTable,
    DEFAULT_ROLE_NAMES,
    DEFAULT_ROLES,
    // Media (core — tracks all uploaded files)
    Media,
    mediaTable,
    MembershipError,
    // Multi-tenant/RBAC models and tables
    Organization,
    OrganizationInvite,
    organizationInvitesTable,
    OrganizationMember,
    organizationMembersTable,
    organizationsTable,
    Permission,
    permissionsTable,
    Role,
    rolesTable,
    ScheduledTask,
    scheduledTasksTable,
    Session,
    sessionsTable,
    Tag,
    tagsTable,
    User,
    UserRole,
    userRolesTable,
    usersTable,
    VerificationToken,
    verificationTokensTable,
} from './models';
export type {
    AccountType,
    AuditLogType,
    AuthenticatorType,
    DefaultRoleName,
    DefaultRoleSeed,
    MediaType,
    MembershipErrorCode,
    MembershipRole,
    MembershipStatus,
    NewAccountType,
    NewAuditLogType,
    NewAuthenticatorType,
    NewMediaType,
    NewOrganizationInviteType,
    NewOrganizationMemberType,
    NewOrganizationType,
    NewPermissionType,
    NewRoleType,
    NewSessionType,
    NewTagType,
    NewUserRoleType,
    NewUserType,
    NewVerificationTokenType,
    OrganizationInviteType,
    OrganizationMemberType,
    // Multi-tenant/RBAC types
    OrganizationType,
    PermissionType,
    RBACCacheLike,
    RoleType,
    SessionType,
    TagType,
    UserRoleType,
    UserType,
    VerificationTokenType,
} from './models';

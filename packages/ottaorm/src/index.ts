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
    RLSError,
    RLSPolicies,
    executeSecureCrudRequest,
    extractSecurityContext,
    getRegisteredModels as getRLSModels,
    globalRLS,
    initRLS,
    logSecurityViolation,
    registerPolicy,
    rlsMiddleware,
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
    ModelFieldType,
    ModelFields,
    PackageType,
    PaginationResult,
    RelationshipConfig,
} from './base';

/**
 * Core models (SQL only - Edge-safe)
 *
 * These exports are safe for Next.js Edge runtime.
 */
export {
    Account,
    AuditLog,
    // Auth.js SQL models (Edge-safe)
    Authenticator,
    // Multi-tenant/RBAC models and tables
    Organization,
    OrganizationMember,
    Permission,
    Role,
    ScheduledTask,
    Session,
    Tag,
    User,
    UserRole,
    VerificationToken,
    accountsTable,
    auditLogsTable,
    authenticatorsTable,
    organizationMembersTable,
    organizationsTable,
    permissionsTable,
    rolesTable,
    scheduledTasksTable,
    sessionsTable,
    tagsTable,
    userRolesTable,
    usersTable,
    verificationTokensTable,
} from './models';
export type {
    AccountType,
    AuditLogType,
    AuthenticatorType,
    NewAccountType,
    NewAuditLogType,
    NewAuthenticatorType,
    NewOrganizationMemberType,
    NewOrganizationType,
    NewPermissionType,
    NewRoleType,
    NewSessionType,
    NewTagType,
    NewUserRoleType,
    NewUserType,
    NewVerificationTokenType,
    OrganizationMemberType,
    // Multi-tenant/RBAC types
    OrganizationType,
    PermissionType,
    RoleType,
    SessionType,
    TagType,
    UserRoleType,
    UserType,
    VerificationTokenType,
} from './models';

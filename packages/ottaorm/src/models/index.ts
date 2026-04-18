// ============================================================
// @ottabase/ottaorm - Models Export
// ============================================================

// Core models - Fat Model Pattern
export { Account, accountsTable, type AccountType, type NewAccountType } from './Account';
export { Tag, tagsTable, type NewTagType, type TagType } from './Tag';
export { User, usersTable, type NewUserType, type UserType } from './User';

// Auth.js models
export { Authenticator, authenticatorsTable, type AuthenticatorType, type NewAuthenticatorType } from './Authenticator';
export { Session, sessionsTable, type NewSessionType, type SessionType } from './Session';
export {
    VerificationToken,
    verificationTokensTable,
    type NewVerificationTokenType,
    type VerificationTokenType,
} from './VerificationToken';

// Cron scheduler
export { ScheduledTask, scheduledTasksTable, type NewScheduledTaskType, type ScheduledTaskType } from './ScheduledTask';

// Multi-tenant organization models
export { Organization, organizationsTable, type NewOrganizationType, type OrganizationType } from './Organization';
export {
    OrganizationMember,
    organizationMembersTable,
    type NewOrganizationMemberType,
    type OrganizationMemberType,
} from './OrganizationMember';

// RBAC models (with tenant + app scoping)
export { Permission, permissionsTable, type NewPermissionType, type PermissionType } from './Permission';
export { Role, rolesTable, type NewRoleType, type RoleType } from './Role';
export { UserRole, userRolesTable, type NewUserRoleType, type UserRoleType } from './UserRole';

// Audit logging (with tenant + app scoping)
export { AuditLog, auditLogsTable, type AuditLogType, type NewAuditLogType } from './AuditLog';

// Media (core — tracks all uploaded files)
export { Media, mediaTable, type MediaType, type NewMediaType } from './Media';

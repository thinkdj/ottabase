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
export { DEFAULT_ROLE_NAMES, DEFAULT_ROLES, type DefaultRoleName, type DefaultRoleSeed } from './DefaultRoles';
export { SYSTEM_ROLE_NAMES_SET, isSystemRoleName } from '../rbac-constants';
export {
    Organization,
    organizationsTable,
    type NewOrganizationType,
    type OrganizationType,
    type RBACCacheLike,
} from './Organization';
export {
    MembershipError,
    OrganizationMember,
    organizationMembersTable,
    type MembershipErrorCode,
    type MembershipRole,
    type MembershipStatus,
    type NewOrganizationMemberType,
    type OrganizationMemberType,
} from './OrganizationMember';
export {
    OrganizationInvite,
    organizationInvitesTable,
    type NewOrganizationInviteType,
    type OrganizationInviteType,
} from './OrganizationInvite';

// RBAC models (with tenant + app scoping)
export { Permission, permissionsTable, type NewPermissionType, type PermissionType } from './Permission';
export { Role, rolesTable, type NewRoleType, type RoleType } from './Role';
export { UserRole, userRolesTable, type NewUserRoleType, type UserRoleType } from './UserRole';

// Audit logging (with tenant + app scoping)
export { AuditLog, auditLogsTable, type AuditLogType, type NewAuditLogType } from './AuditLog';

// Media (core — tracks all uploaded files)
export { Media, mediaTable, type MediaType, type NewMediaType } from './Media';

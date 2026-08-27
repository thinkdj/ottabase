// ============================================================
// @ottabase/ottaorm - Models Export
// ============================================================

// Core models - Fat Model Pattern
export { Account, accountsTable, type AccountType, type NewAccountType } from './Account';
export { Tag, tagsTable, type NewTagType, type TagType } from './Tag';
export { User, usersTable, type NewUserType, type UserType } from './User';

// Auth models
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
    type OrganizationRosterRole,
    type OrganizationRosterStatus,
    type RemoveRosterMembershipResult,
    type RosterMembershipChanges,
    type RosterMembershipExpected,
    type UpdateRosterMembershipResult,
} from './OrganizationMember';

// RBAC models (with tenant + app scoping)
export { Permission, permissionsTable, type NewPermissionType, type PermissionType } from './Permission';
export {
    ORG_ADMIN_PERMISSION,
    ORG_OWNER_PERMISSIONS,
    PLATFORM_ADMIN_PERMISSION,
    PLATFORM_OWNER_ROLE_NAME,
    Role,
    rolesTable,
    type NewRoleType,
    type RoleType,
} from './Role';
export { UserRole, userRolesTable, type NewUserRoleType, type UserRoleType } from './UserRole';

// User groups (generic membership primitive — tenant + app scoped, membership-scoped RLS)
export {
    UserGroup,
    UserGroupMember,
    userGroupMembersTable,
    userGroupsTable,
    type NewUserGroupMemberType,
    type NewUserGroupType,
    type UserGroupMemberType,
    type UserGroupType,
} from './UserGroup';

// Audit logging (with tenant + app scoping)
export { AuditLog, auditLogsTable, type AuditLogType, type NewAuditLogType } from './AuditLog';

// Media (core — tracks all uploaded files)
export { Media, mediaTable, type MediaType, type NewMediaType } from './Media';

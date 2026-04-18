/**
 * Shared type definitions for RBAC and multi-tenant features
 * Centralizes types used across multiple UI components
 */

// ============================================================
// Organization Types
// ============================================================

export interface OrganizationRecord {
    id: string;
    name: string;
    slug: string;
    plan: OrganizationPlan;
    status: OrganizationStatus;
    ownerId: string;
    settings?: OrganizationSettings;
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}

export type OrganizationPlan = 'free' | 'pro' | 'enterprise';

export type OrganizationStatus = 'active' | 'suspended' | 'deleted';

export interface OrganizationSettings {
    features?: string[];
    maxMembers?: number;
    [key: string]: unknown;
}

export interface CreateOrganizationInput {
    name: string;
    slug: string;
    plan: OrganizationPlan;
    status: OrganizationStatus;
    ownerId?: string;
    settings?: OrganizationSettings;
    metadata?: Record<string, unknown>;
}

export interface UpdateOrganizationInput {
    name?: string;
    plan?: OrganizationPlan;
    status?: OrganizationStatus;
    settings?: OrganizationSettings;
    metadata?: Record<string, unknown>;
}

// ============================================================
// Organization Member Types
// ============================================================

export interface OrganizationMemberRecord {
    id: string;
    userId: string;
    organizationId: string;
    role: MemberRole;
    status: MemberStatus;
    invitedBy?: string;
    invitedAt?: string;
    joinedAt?: string;
    metadata?: Record<string, unknown>;
}

export type MemberRole = 'owner' | 'admin' | 'member';

export type MemberStatus = 'active' | 'invited' | 'suspended';

export interface InviteMemberInput {
    userId: string;
    organizationId: string;
    role: MemberRole;
    status: MemberStatus;
    invitedBy?: string;
    invitedAt?: string;
}

export interface UpdateMemberInput {
    role?: MemberRole;
    status?: MemberStatus;
    joinedAt?: string;
    metadata?: Record<string, unknown>;
}

// ============================================================
// RBAC Role Types
// ============================================================

export interface RoleRecord {
    id: string;
    name: string;
    displayName?: string;
    description?: string;
    permissions?: string[];
    organizationId?: string | null;
    appId?: string | null;
    isSystem?: boolean;
    createdAt: string;
    updatedAt: string;
}

export type RoleType = 'system' | 'organization' | 'custom';

export interface CreateRoleInput {
    name: string;
    displayName: string;
    description?: string;
    permissions: string[];
    organizationId?: string;
    appId?: string;
}

export interface UpdateRoleInput {
    displayName?: string;
    description?: string;
    permissions?: string[];
}

// ============================================================
// Permission Types
// ============================================================

export interface PermissionRecord {
    id: string;
    resource: string;
    action: string;
    description?: string;
    displayName?: string;
}

/**
 * Permission format: resource:action
 * Examples: users:read, posts:write, organizations:*
 */
export type PermissionString = string;

export interface ParsedPermission {
    resource: string;
    action: string;
    isWildcard: boolean;
}

// ============================================================
// RBAC Context Types
// ============================================================

export interface RBACContext {
    userId: string;
    organizationId: string;
    appId?: string | null;
    roles: string[];
    permissions: string[];
}

// ============================================================
// User Role Assignment Types
// ============================================================

export interface UserRoleAssignment {
    userId: string;
    roleId: string;
    organizationId: string;
    appId?: string | null;
    assignedBy: string;
    assignedAt: string;
}

export interface AssignRoleInput {
    userId: string;
    roleId: string;
    organizationId: string;
    appId?: string | null;
}

// ============================================================
// Audit Log Types
// ============================================================

export interface AuditLogRecord {
    id: string;
    user_id: string;
    user_email?: string | null;
    organization_id?: string | null;
    app_id?: string | null;
    action: string;
    resource_type: string;
    resource_id?: string | null;
    changes?: string | null;
    metadata?: string | null;
    ip_address?: string | null;
    user_agent?: string | null;
    status: 'success' | 'failure' | 'error';
    error_message?: string | null;
    created_at: number;
}

export type AuditAction =
    | 'create'
    | 'update'
    | 'delete'
    | 'invite'
    | 'remove'
    | 'assign_role'
    | 'revoke_role'
    | 'login'
    | 'logout';

// ============================================================
// UI State Types
// ============================================================

export interface PaginationState {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
}

export interface SortState {
    field: string;
    direction: 'asc' | 'desc';
}

export interface FilterState {
    [key: string]: string | number | boolean | null | undefined;
}

// ============================================================
// API Response Types
// ============================================================

export interface ApiResponse<T> {
    data: T;
    pagination?: PaginationState;
}

export interface ApiError {
    message: string;
    code?: string;
    status?: number;
    details?: Record<string, unknown>;
}

// ============================================================
// Form Types
// ============================================================

export interface FormState<T> {
    data: T;
    errors: Partial<Record<keyof T, string>>;
    isSubmitting: boolean;
    isDirty: boolean;
}

// ============================================================
// Badge Variant Helper Types
// ============================================================

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

export type StatusBadgeMap = {
    [K in OrganizationStatus | MemberStatus]: BadgeVariant;
};

export type PlanBadgeMap = {
    [K in OrganizationPlan]: BadgeVariant;
};

export type RoleBadgeMap = {
    [K in MemberRole]: BadgeVariant;
};

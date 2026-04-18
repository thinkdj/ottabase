/**
 * Row-Level Security (RLS) Types
 *
 * Defines security policies for automatic tenant isolation
 */

export type SecurityLevel = 'tenant' | 'user' | 'app' | 'public' | 'custom';

export interface SecurityContext {
    userId?: string;
    organizationId?: string | null;
    appId?: string;
    roles?: string[];
    permissions?: string[];
    /** Organization IDs where the user is an active member (populated upstream). */
    memberOrganizationIds?: string[];
}

export interface RLSPolicy {
    /**
     * Security level determines how data is filtered
     * - tenant: Filters by organizationId
     * - user: Filters by userId
     * - app: Filters by appId
     * - public: No filtering (read-only)
     * - custom: Custom filter function
     */
    level: SecurityLevel;

    /**
     * Field name to filter by (for tenant/user/app levels)
     */
    field?: string;

    /**
     * Allow null tenant ID (for single-founder mode)
     */
    allowNullTenant?: boolean;

    /**
     * Custom filter function (for complex policies)
     */
    filter?: (context: SecurityContext) => Record<string, any> | null;

    /**
     * Read-only policy (prevents writes)
     */
    readOnly?: boolean;

    /**
     * Required permissions to access this model.
     * Supports wildcards: *:* (all), brand:* (matches brand:edit), *:edit (edit on any resource).
     * Only 2-segment resource:action format; bare * does not grant; 3+ segments use exact match only.
     */
    requiredPermissions?: string[];

    /**
     * Required roles to access this model
     */
    requiredRoles?: string[];
}

export interface ModelRLSConfig {
    /**
     * Model name (e.g., 'organizations', 'posts')
     */
    model: string;

    /**
     * RLS policy for this model
     */
    policy: RLSPolicy;

    /**
     * Context fields that must be injected/validated on write operations.
     * Common examples: organizationId (tenant), appId (app scoping), userId (ownership).
     */
    contextFields?: Array<'organizationId' | 'appId' | 'userId'>;

    /**
     * Soft delete field (if any)
     */
    softDeleteField?: string;

    /**
     * Audit changes to this model
     */
    auditEnabled?: boolean;
}

export interface RLSViolation {
    type: 'cross_tenant_read' | 'cross_tenant_write' | 'unauthorized_access' | 'permission_denied';
    model: string;
    context: SecurityContext;
    attemptedAccess: any;
    timestamp: number;
}

/**
 * Pre-defined RLS policies for common patterns
 */
export const RLSPolicies = {
    /**
     * Tenant-scoped: Filters by organizationId
     */
    TenantScoped: (allowNull = false): RLSPolicy => ({
        level: 'tenant',
        field: 'organizationId',
        allowNullTenant: allowNull,
    }),

    /**
     * User-scoped: Filters by userId
     */
    UserScoped: (): RLSPolicy => ({
        level: 'user',
        field: 'userId',
    }),

    /**
     * App-scoped: Filters by appId
     */
    AppScoped: (): RLSPolicy => ({
        level: 'app',
        field: 'appId',
    }),

    /**
     * Public read-only: No filtering, but no writes allowed
     */
    PublicReadOnly: (): RLSPolicy => ({
        level: 'public',
        readOnly: true,
    }),

    /**
     * Admin-only: Requires admin role
     */
    AdminOnly: (): RLSPolicy => ({
        level: 'custom',
        requiredRoles: ['admin', 'owner'],
    }),

    /**
     * Permission-based: Requires specific permissions.
     * Supports wildcards: *:* (all), brand:* (matches brand:edit), *:edit.
     */
    PermissionBased: (permissions: string[]): RLSPolicy => ({
        level: 'custom',
        requiredPermissions: permissions,
    }),

    /**
     * Owner-only: User must own the record
     */
    OwnerOnly: (ownerField = 'userId'): RLSPolicy => ({
        level: 'custom',
        filter: (context) => ({
            [ownerField]: context.userId,
        }),
    }),

    /**
     * Hierarchical: Tenant + User scoped
     */
    Hierarchical: (allowNullTenant = false): RLSPolicy => ({
        level: 'custom',
        allowNullTenant,
        filter: (context) => ({
            organizationId: context.organizationId,
            userId: context.userId,
            ...(context.appId ? { appId: context.appId } : {}),
        }),
    }),
};

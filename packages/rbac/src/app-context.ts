// ============================================================
// @ottabase/rbac - Unified App Context (Tenant > App > User)
// ============================================================

import logger from '@ottabase/logger';
import type { User } from '@ottabase/ottaorm/models';
import { hasGrantedPermission } from '@ottabase/utils/permissions';
import type { RBACCache } from './cache';

/**
 * Unified application context
 * Represents the complete state for a request: Tenant > App > User (RBAC)
 */
export interface AppContext {
    // Tenant dimension (top level)
    organizationId: string | null;
    organizationName?: string;
    organizationSlug?: string;
    tenantId: string | null; // Alias for organizationId

    // App dimension (second level)
    appId: string;
    appName?: string;

    // User dimension (third level)
    user: User | null;
    userId?: string;
    userEmail?: string;

    // RBAC (scoped by organization + app)
    roles: string[];
    permissions: string[];
    isAuthenticated: boolean;

    // Request metadata (for audit logging)
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
    url?: string;
    method?: string;

    // Additional metadata
    metadata?: Record<string, any>;
}

/**
 * Options for building app context
 */
export interface BuildAppContextOptions {
    // Required
    organizationId?: string | null;
    appId: string;

    // Optional user
    user?: User | null;
    userId?: string;

    // Optional organization details
    organizationName?: string;
    organizationSlug?: string;

    // Optional app details
    appName?: string;

    // Optional request metadata
    ipAddress?: string;
    userAgent?: string;
    requestId?: string;
    url?: string;
    method?: string;

    // Optional RBAC cache
    cache?: RBACCache;

    // Additional metadata
    metadata?: Record<string, any>;
}

/**
 * Build a complete app context
 * Loads user roles and permissions if user is provided
 */
export async function buildAppContext(options: BuildAppContextOptions): Promise<AppContext> {
    const {
        organizationId,
        appId,
        user,
        userId,
        organizationName,
        organizationSlug,
        appName,
        ipAddress,
        userAgent,
        requestId,
        url,
        method,
        cache,
        metadata,
    } = options;

    // Basic context without RBAC
    const context: AppContext = {
        organizationId: organizationId ?? null,
        organizationName,
        organizationSlug,
        tenantId: organizationId ?? null, // Alias
        appId,
        appName,
        user: user || null,
        userId: userId || (user ? (user.get('id') as string) : undefined),
        userEmail: user ? (user.get('email') as string) : undefined,
        roles: [],
        permissions: [],
        isAuthenticated: !!(user || userId),
        ipAddress,
        userAgent,
        requestId,
        url,
        method,
        metadata,
    };

    // Load RBAC if user is authenticated. Grants are org-scoped: with no organization there is
    // nothing to load (an org-less read would merge the user's grants from every tenant).
    if (context.userId && user && organizationId) {
        try {
            // Get user roles (scoped by organization and optionally app)
            const roles = await user.roles({
                cache,
                organizationId,
                // Note: We don't filter by appId here to get all roles
                // Roles with specific appId will be filtered during permission checks
            });

            context.roles = roles.map((role) => role.get('name') as string);

            // Get user permissions (scoped by organization)
            const permissions = await user.getPermissions({
                cache,
                organizationId,
            });

            context.permissions = permissions;
        } catch (error: any) {
            logger.error('Failed to load RBAC context', error instanceof Error ? error : new Error(String(error)), {
                userId: context.userId,
                organizationId,
            });
            // Continue with empty roles/permissions rather than failing
        }
    }

    return context;
}

/**
 * Check if user has permission in the current context
 * Uses wildcard matching (users:*, *:read, *:*)
 */
export function hasPermission(context: AppContext, permission: string): boolean {
    if (!context.isAuthenticated) {
        return false;
    }
    return hasGrantedPermission(context.permissions, permission);
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(context: AppContext, roles: string[]): boolean {
    if (!context.isAuthenticated) {
        return false;
    }

    return roles.some((role) => context.roles.includes(role));
}

/**
 * Check if user has all of the specified roles
 */
export function hasAllRoles(context: AppContext, roles: string[]): boolean {
    if (!context.isAuthenticated) {
        return false;
    }

    return roles.every((role) => context.roles.includes(role));
}

/**
 * Check if the context holds an admin capability, PERMISSION-based, never role-NAME based.
 * True for a platform admin (`platform:admin`) or an org admin (`org:admin`), or the `*:*`
 * superadmin wildcard. A role merely NAMED 'owner'/'admin' with no such permission is NOT one.
 *
 * NOTE: AppContext is scope-blind. For the platform-vs-org boundary on the server use
 * assertAdmin / isPlatformAdmin (admin-guard), which read system-scoped grants.
 */
export function isOwnerOrAdmin(context: AppContext): boolean {
    return hasPermission(context, 'platform:admin') || hasPermission(context, 'org:admin');
}

/**
 * Create audit log data from context
 */
export function createAuditData(
    context: AppContext,
    action: string,
    resourceType: string,
    resourceId?: string,
    changes?: Record<string, any>,
): {
    userId?: string;
    userEmail?: string;
    organizationId: string | null;
    appId: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    changes?: Record<string, any>;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
} {
    return {
        userId: context.userId,
        userEmail: context.userEmail,
        organizationId: context.organizationId,
        appId: context.appId,
        action,
        resourceType,
        resourceId,
        changes,
        metadata: context.metadata,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
    };
}

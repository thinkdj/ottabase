// ============================================================
// @ottabase/rbac - Unified App Context (Tenant > App > User)
// ============================================================

import type { User } from '@ottabase/ottaorm/models';
import type { RBACCache } from './cache';
import logger from '@ottabase/logger';

/**
 * Unified application context
 * Represents the complete state for a request: Tenant > App > User (RBAC)
 */
export interface AppContext {
    // Tenant dimension (top level)
    organizationId: string;
    organizationName?: string;
    organizationSlug?: string;
    tenantId: string; // Alias for organizationId

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
    organizationId: string;
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
        organizationId,
        organizationName,
        organizationSlug,
        tenantId: organizationId, // Alias
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

    // Load RBAC if user is authenticated
    if (context.userId && user) {
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
 * Extract organization ID from request
 * Supports multiple strategies:
 * 1. Subdomain: acme.yourapp.com -> org-acme
 * 2. Header: X-Organization-Id
 * 3. Query param: ?organizationId=org-acme
 * 4. JWT claim: token.organizationId
 */
export interface ExtractOrgOptions {
    request: Request;
    subdomainPrefix?: string; // Default: 'org-'
    headerName?: string; // Default: 'X-Organization-Id'
    queryParam?: string; // Default: 'organizationId'
    jwtClaim?: string; // Default: 'organizationId'
    getJWT?: (request: Request) => Promise<any>; // Custom JWT decoder
}

export async function extractOrganizationId(options: ExtractOrgOptions): Promise<string | null> {
    const {
        request,
        subdomainPrefix = 'org-',
        headerName = 'X-Organization-Id',
        queryParam = 'organizationId',
        jwtClaim = 'organizationId',
        getJWT,
    } = options;

    // Strategy 1: Check header
    const headerValue = request.headers.get(headerName);
    if (headerValue) {
        return headerValue;
    }

    // Strategy 2: Check query parameter
    const url = new URL(request.url);
    const queryValue = url.searchParams.get(queryParam);
    if (queryValue) {
        return queryValue;
    }

    // Strategy 3: Extract from subdomain
    const hostname = url.hostname;
    const parts = hostname.split('.');
    if (parts.length >= 3) {
        // Assume first part is subdomain
        const subdomain = parts[0];
        if (subdomain && subdomain !== 'www') {
            return `${subdomainPrefix}${subdomain}`;
        }
    }

    // Strategy 4: Check JWT claim
    if (getJWT) {
        try {
            const jwt = await getJWT(request);
            if (jwt && jwt[jwtClaim]) {
                return jwt[jwtClaim];
            }
        } catch (error: any) {
            logger.error(
                'Failed to extract organizationId from JWT',
                error instanceof Error ? error : new Error(String(error)),
            );
        }
    }

    return null;
}

/**
 * Extract app ID from request
 * Supports multiple strategies:
 * 1. Header: X-App-Id
 * 2. Query param: ?appId=web
 * 3. Environment variable: APP_ID
 * 4. Default: 'web'
 */
export interface ExtractAppOptions {
    request: Request;
    headerName?: string; // Default: 'X-App-Id'
    queryParam?: string; // Default: 'appId'
    env?: Record<string, any>; // Environment variables
    defaultAppId?: string; // Default: 'web'
}

export function extractAppId(options: ExtractAppOptions): string {
    const { request, headerName = 'X-App-Id', queryParam = 'appId', env, defaultAppId = 'web' } = options;

    // Strategy 1: Check header
    const headerValue = request.headers.get(headerName);
    if (headerValue) {
        return headerValue;
    }

    // Strategy 2: Check query parameter
    const url = new URL(request.url);
    const queryValue = url.searchParams.get(queryParam);
    if (queryValue) {
        return queryValue;
    }

    // Strategy 3: Check environment variable
    if (env && env.APP_ID) {
        return env.APP_ID;
    }

    // Strategy 4: Return default
    return defaultAppId;
}

/**
 * Check if user has permission in the current context
 * Uses wildcard matching (users:*, *:read, *:*)
 */
export function hasPermission(context: AppContext, permission: string): boolean {
    if (!context.isAuthenticated) {
        return false;
    }

    // Exact match
    if (context.permissions.includes(permission)) {
        return true;
    }

    // Wildcard matching
    const [resource, action] = permission.split(':');

    for (const perm of context.permissions) {
        if (perm === '*:*') return true; // Super admin
        if (perm === `${resource}:*`) return true; // All actions on resource
        if (perm === `*:${action}`) return true; // Action on all resources
    }

    return false;
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
 * Check if user is owner or admin in the organization
 */
export function isOwnerOrAdmin(context: AppContext): boolean {
    return hasAnyRole(context, ['owner', 'admin']);
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
    organizationId: string;
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

// ============================================================
// @ottabase/rbac - Admin Access Guard
// ============================================================
//
// Provides assertAdmin() for route handlers and
// requireAdminAccess() for non-route contexts (throws instead
// of returning Response).
//
// Two scopes:
//   - 'system'       → requires system owner/admin or *:*
//   - 'organization'  → requires org owner/admin for a specific org
//
// System-scoped roles always satisfy org-scoped checks too,
// because system *:* is already merged into context.permissions.
// ============================================================

import type { RequestContext } from './request-context';

export type AdminScope = 'system' | 'organization';

export interface AssertAdminOptions {
    /** 'system' requires platform-wide admin; 'organization' requires org-level admin. */
    scope?: AdminScope;
    /** Additional permissions to require (checked with OR by default). */
    requiredPermissions?: string[];
    /** Require ALL listed permissions instead of ANY. */
    requireAllPermissions?: boolean;
    /** Override the organization from context (useful for cross-org admin ops). */
    organizationId?: string;
}

export interface AdminResult {
    sessionUser: { id: string; email?: string; name?: string };
    organizationId: string | null;
}

/**
 * Assert that the request context has admin-level access.
 *
 * Returns a `Response` (401/403) on failure, or an `AdminResult` on success.
 * Use in route handlers with an early return pattern:
 *
 * ```ts
 * const result = await assertAdmin(ctx, { scope: 'system' });
 * if (result instanceof Response) return result;
 * const { sessionUser, organizationId } = result;
 * ```
 */
export function assertAdmin(
    context: RequestContext,
    options?: AssertAdminOptions,
): Response | AdminResult {
    // ── Authentication check ──────────────────────────────────
    if (!context.isAuthenticated || !context.sessionUser) {
        return jsonError('Authentication required', 401, 'UNAUTHORIZED');
    }

    const scope = options?.scope ?? inferScope(context);
    const orgId = options?.organizationId ?? context.organizationId;

    // ── System scope check ────────────────────────────────────
    if (scope === 'system') {
        if (!isSystemAdmin(context)) {
            return jsonError(
                'System admin access required',
                403,
                'FORBIDDEN',
            );
        }
    }

    // ── Organization scope check ──────────────────────────────
    if (scope === 'organization') {
        if (!orgId) {
            return jsonError(
                'Organization context required for this operation',
                403,
                'FORBIDDEN',
            );
        }

        // System admins always pass org checks (their *:* is merged)
        if (!isOrgAdmin(context)) {
            return jsonError(
                'Organization admin access required',
                403,
                'FORBIDDEN',
            );
        }
    }

    // ── Additional permission checks ──────────────────────────
    if (options?.requiredPermissions && options.requiredPermissions.length > 0) {
        const checker = options.requireAllPermissions ? hasAllPermissions : hasAnyPermission;
        if (!checker(context.permissions, options.requiredPermissions)) {
            return jsonError(
                'Insufficient permissions',
                403,
                'FORBIDDEN',
            );
        }
    }

    return {
        sessionUser: context.sessionUser,
        organizationId: orgId,
    };
}

/**
 * Same as assertAdmin but throws an error instead of returning Response.
 * Useful in service-layer functions or non-route contexts.
 */
export function requireAdminAccess(
    context: RequestContext,
    options?: AssertAdminOptions,
): AdminResult {
    const result = assertAdmin(context, options);
    if (result instanceof Response) {
        const scope = options?.scope ?? 'system';
        throw new AdminAccessError(
            `Admin access denied (scope: ${scope})`,
            scope === 'system' ? 403 : 403,
        );
    }
    return result;
}

export class AdminAccessError extends Error {
    constructor(
        message: string,
        public statusCode: number,
    ) {
        super(message);
        this.name = 'AdminAccessError';
    }
}

// ── Internal helpers ──────────────────────────────────────────

/**
 * Check if user has system-level admin access.
 * True if user has 'owner' or 'admin' role, OR has the '*:*' permission.
 */
function isSystemAdmin(context: RequestContext): boolean {
    if (context.roles.includes('owner')) return true;
    if (context.roles.includes('admin')) return true;
    if (context.permissions.includes('*:*')) return true;
    return false;
}

/**
 * Check if user has org-level admin access.
 * System admins also pass because their *:* is in context.permissions.
 */
function isOrgAdmin(context: RequestContext): boolean {
    // System admins always pass
    if (isSystemAdmin(context)) return true;
    // Org-level owner/admin roles
    if (context.roles.includes('owner')) return true;
    if (context.roles.includes('admin')) return true;
    if (context.permissions.includes('*:*')) return true;
    return false;
}

function inferScope(context: RequestContext): AdminScope {
    if (context.organizationId && !context.isSystemScope) {
        return 'organization';
    }
    if (context.allowNullTenant) {
        return 'system';
    }
    return 'system';
}

function hasAnyPermission(userPermissions: string[], required: string[]): boolean {
    return required.some((perm) => matchesPermission(userPermissions, perm));
}

function hasAllPermissions(userPermissions: string[], required: string[]): boolean {
    return required.every((perm) => matchesPermission(userPermissions, perm));
}

function matchesPermission(userPermissions: string[], required: string): boolean {
    if (userPermissions.includes(required)) return true;

    const [reqResource, reqAction] = required.split(':');
    for (const perm of userPermissions) {
        const [permResource, permAction] = perm.split(':');
        if (permResource === '*' && permAction === '*') return true;
        const resourceMatches = permResource === '*' || permResource === reqResource;
        const actionMatches = permAction === '*' || permAction === reqAction;
        if (resourceMatches && actionMatches) return true;
    }
    return false;
}

function jsonError(message: string, status: number, code: string): Response {
    return new Response(
        JSON.stringify({ error: message, code }),
        {
            status,
            headers: { 'Content-Type': 'application/json' },
        },
    );
}

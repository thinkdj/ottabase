import { ORG_ADMIN_PERMISSION, PLATFORM_ADMIN_PERMISSION } from '@ottabase/ottaorm/models';
import { SYSTEM_ORGANIZATION_ID, type RequestContext } from './request-context';

export type AdminScope = 'system' | 'organization' | 'either';

export interface AssertAdminOptions {
    scope?: AdminScope;
    requiredPermissions?: string[];
    organizationId?: string | null;
}

function jsonResponse(message: string, status: number, code: string) {
    return new Response(JSON.stringify({ error: message, code }), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

/** Wildcard-aware permission match against an explicit permission list (2-segment resource:action). */
function matchesPermission(perms: readonly string[], permission: string): boolean {
    if (perms.includes(permission)) return true;
    const [reqResource, reqAction] = permission.split(':');
    for (const perm of perms) {
        const [permResource, permAction] = perm.split(':');
        if (permResource === '*' && permAction === '*') return true;
        const resourceMatches = permResource === '*' || permResource === reqResource;
        const actionMatches = permAction === '*' || permAction === reqAction;
        if (resourceMatches && actionMatches) return true;
    }
    return false;
}

/** Check single permission against the caller's MERGED permissions (system ∪ org). */
export function hasPermission(context: RequestContext, permission: string): boolean {
    return matchesPermission(context.permissions || [], permission);
}

/**
 * PLATFORM administrator: the permission must come from a SYSTEM-scoped grant. This is the whole
 * point of the redesign — a role's NAME ('owner'/'admin') and org-scoped grants confer no platform
 * authority, so an org owner (incl. every fresh signup) can never reach the control plane.
 */
export function isPlatformAdmin(context: RequestContext): boolean {
    return matchesPermission(context.systemPermissions || [], PLATFORM_ADMIN_PERMISSION);
}

/**
 * ORGANIZATION administrator for the active org. Keyed on the merged permissions so the platform
 * owner ('*:*') also passes, and any org owner/admin ('org:admin') passes for their own org.
 */
export function isOrgAdmin(context: RequestContext): boolean {
    return matchesPermission(context.permissions || [], ORG_ADMIN_PERMISSION);
}

function hasRequiredPermissions(context: RequestContext, required?: string[]): boolean {
    if (!required || required.length === 0) return true;
    return required.every((perm) => hasPermission(context, perm));
}

export function assertAdmin(
    context: RequestContext,
    options?: AssertAdminOptions,
): Response | { user: any; organizationId: string | null } {
    if (!context.isAuthenticated || !context.user) {
        return jsonResponse('Unauthorized', 401, 'UNAUTHORIZED');
    }

    const scope: AdminScope = options?.scope || (context.organizationId ? 'organization' : 'system');
    const organizationId = options?.organizationId ?? context.organizationId ?? null;

    if (scope === 'organization' && !organizationId) {
        return jsonResponse('Organization context required', 400, 'ORG_REQUIRED');
    }

    // Extra route-specific permissions are checked against the merged set (an org admin may hold
    // them org-scoped; a platform owner holds '*:*'). The BASE capability differs by scope:
    //   system → platform:admin from a SYSTEM-scoped grant (control plane)
    //   org    → org:admin for the active org (own-tenant administration)
    const permsOk = hasRequiredPermissions(context, options?.requiredPermissions);
    const systemAllowed = isPlatformAdmin(context) && permsOk;
    const orgAllowed = !!organizationId && isOrgAdmin(context) && permsOk;

    const allowed =
        scope === 'system' ? systemAllowed : scope === 'organization' ? orgAllowed : systemAllowed || orgAllowed;

    if (!allowed) {
        return jsonResponse('Forbidden', 403, 'FORBIDDEN');
    }

    return { user: context.user, organizationId: organizationId ?? SYSTEM_ORGANIZATION_ID };
}

export async function requireAdminAccess(
    buildContext: () => Promise<RequestContext>,
    options?: AssertAdminOptions,
): Promise<{ user: any; organizationId: string | null } | Response> {
    const ctx = await buildContext();
    return assertAdmin(ctx, options);
}

/** Permission-only check for brand/scoped operations. Does NOT require admin role. */
export interface AssertPermissionOptions {
    permission: string; // e.g. 'brand:edit' (matches brand:*, *:*)
    organizationId: string | null;
}

export function assertBrandEditAccess(
    context: RequestContext,
    options: AssertPermissionOptions,
): Response | { user: any; organizationId: string | null } {
    if (!context.isAuthenticated || !context.user) {
        return jsonResponse('Unauthorized', 401, 'UNAUTHORIZED');
    }
    // Brand / appearance data (kits, layouts, menus) is app-global — scoped by appId only, never
    // organizationId — so editing it is a PLATFORM capability. Require the permission from a
    // SYSTEM-scoped grant; an org owner holding the same permission org-scoped must NOT reach
    // app-wide branding. (If per-org branding ships later, add an org branch keyed on rows that
    // actually carry organizationId.)
    if (matchesPermission(context.systemPermissions || [], options.permission)) {
        return { user: context.user, organizationId: options.organizationId ?? null };
    }
    return jsonResponse('Forbidden', 403, 'FORBIDDEN');
}

export { SYSTEM_ORGANIZATION_ID };

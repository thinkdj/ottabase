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

function hasRequiredPermissions(context: RequestContext, required?: string[]): boolean {
    if (!required || required.length === 0) return true;
    const hasWildcard = context.permissions.includes('*:*');
    return required.every((perm) => hasWildcard || context.permissions.includes(perm));
}

function hasAdminRole(context: RequestContext): boolean {
    return context.roles.includes('owner') || context.roles.includes('admin') || context.permissions.includes('*:*');
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

    const roleOk = hasAdminRole(context);
    const permsOk = hasRequiredPermissions(context, options?.requiredPermissions);

    const systemAllowed = context.isSystemScope && roleOk && permsOk;
    const orgAllowed = !!organizationId && roleOk && permsOk;

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

export { SYSTEM_ORGANIZATION_ID };

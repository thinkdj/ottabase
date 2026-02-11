import type { RBACContext } from '@ottabase/rbac';
import { assertAdmin, assertBrandEditAccess, SYSTEM_ORGANIZATION_ID } from '@ottabase/rbac/admin-guard';
import { getRequestContext } from '@ottabase/rbac/request-context';
import { errorResponse } from '@ottabase/utils/http-errors';
import type { ApiRouteContext } from '../routes/router';
import { getAuthOptions } from './auth-utils';
import { initDbConnection } from './db-utils';

export interface AdminContext {
    user: any;
    organizationId: string;
    appId: string;
    rbac: RBACContext;
    session: any;
}

type AdminScope = 'system' | 'organization' | 'either';

function cleanValue(value: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
    return trimmed;
}

function deriveAppId(request: Request): string {
    return cleanValue(request.headers.get('x-app-id')) || 'web';
}

export async function requireAdminAccess(
    context: ApiRouteContext,
    options?: { scope?: AdminScope; requiredPermissions?: string[]; allowNullTenant?: boolean },
): Promise<AdminContext | Response> {
    const { request, env } = context;

    if (!env?.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' });
    }

    initDbConnection(env);

    // For system-scope routes (e.g. Database Manager), force system org context so isSystemScope is true.
    // Otherwise users with an org in session/header would get 403 even with *:* permissions.
    const reqCtx = await getRequestContext(request, env as any, {
        getAuthOptions,
        allowNullTenant: options?.allowNullTenant,
        organizationIdOverride: options?.scope === 'system' ? SYSTEM_ORGANIZATION_ID : undefined,
    });

    const result = assertAdmin(reqCtx, {
        scope: options?.scope || 'system',
        requiredPermissions: options?.requiredPermissions,
        organizationId: reqCtx.organizationId,
    });

    if (result instanceof Response) {
        return result;
    }

    const rbac: RBACContext = {
        user: reqCtx.user,
        roles: reqCtx.roles,
        permissions: reqCtx.permissions,
        isAuthenticated: reqCtx.isAuthenticated,
        organizationId: reqCtx.organizationId || undefined,
        tenantId: reqCtx.organizationId || undefined,
    };

    return {
        user: result.user,
        organizationId: (result.organizationId || SYSTEM_ORGANIZATION_ID) as string,
        appId: deriveAppId(request),
        rbac,
        session: reqCtx.session,
    };
}

/** Requires auth + brand:edit permission for the given org. Use for all mutating brand/brandbox routes. */
export async function requireBrandEditAccess(
    context: ApiRouteContext,
    organizationId: string | null,
    appId: string | null,
): Promise<AdminContext | Response> {
    const { request, env } = context;

    if (!env?.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' });
    }

    initDbConnection(env);

    const reqCtx = await getRequestContext(request, env as any, {
        getAuthOptions,
        allowNullTenant: false,
        organizationIdOverride: organizationId ?? undefined,
    });

    const result = assertBrandEditAccess(reqCtx, {
        permission: 'brand:edit',
        organizationId,
    });

    if (result instanceof Response) {
        return result;
    }

    const rbac: RBACContext = {
        user: reqCtx.user,
        roles: reqCtx.roles,
        permissions: reqCtx.permissions,
        isAuthenticated: reqCtx.isAuthenticated,
        organizationId: result.organizationId,
        tenantId: result.organizationId,
    };

    return {
        user: result.user,
        organizationId: result.organizationId,
        appId: appId || deriveAppId(request),
        rbac,
        session: reqCtx.session,
    };
}

export { SYSTEM_ORGANIZATION_ID };

import type { RBACContext } from '@ottabase/rbac';
import { assertAdmin, SYSTEM_ORGANIZATION_ID } from '@ottabase/rbac/admin-guard';
import { getRequestContext } from '@ottabase/rbac/request-context';
import { errorResponse } from '@ottabase/utils/http-errors';
import type { ApiRouteContext } from '../routes/router';
import { getAuthOptions } from './auth-utils';
import { initDbConnection } from './db-utils';

interface AdminContext {
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

    const reqCtx = await getRequestContext(request, env as any, {
        getAuthOptions,
        allowNullTenant: options?.allowNullTenant,
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

export { SYSTEM_ORGANIZATION_ID };

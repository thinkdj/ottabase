import type { RBACContext } from '@ottabase/rbac';
import { assertAdmin, assertBrandEditAccess, SYSTEM_ORGANIZATION_ID } from '@ottabase/rbac/admin-guard';
import { getRequestContext } from '@ottabase/rbac/request-context';
import { errorResponse } from '@ottabase/utils/http-errors';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import type { ApiRouteContext } from '../routes/router';
import { getAuthOptions } from './auth-utils';
import { initDbConnection } from './db-utils';

export interface AdminContext {
    user: any;
    organizationId: string | null;
    appId: string;
    rbac: RBACContext;
    session: any;
}

type AdminScope = 'system' | 'organization' | 'either';

export async function requireAdminAccess(
    context: ApiRouteContext,
    options?: { scope?: AdminScope; requiredPermissions?: string[]; allowNullTenant?: boolean },
): Promise<AdminContext | Response> {
    const { request, env } = context;

    if (!env?.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' });
    }

    initDbConnection(env);

    // For system-scope routes (e.g. Database Manager), pin the ACTING organization to system so
    // downstream handlers that branch on auth.organizationId === 'system' behave correctly. This
    // is no longer the authorization mechanism: assertAdmin now gates system scope on a SYSTEM-
    // scoped platform:admin grant (reqCtx.systemPermissions), independent of the request's org —
    // an org owner browsing with an org in session still fails a scope:'system' route.
    const reqCtx = await getRequestContext(request, env as any, {
        getAuthOptions,
        allowNullTenant: options?.allowNullTenant,
        organizationIdOverride: options?.scope === 'system' ? SYSTEM_ORGANIZATION_ID : undefined,
        appId: getOttabaseConfig(env).appId,
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
        appId: reqCtx.appId,
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

    // When org not in URL, derive from session/header; allow system scope for default brand
    const allowNullTenant = organizationId === null;
    const reqCtx = await getRequestContext(request, env as any, {
        getAuthOptions,
        allowNullTenant,
        organizationIdOverride: organizationId ?? undefined,
        appId: getOttabaseConfig(env).appId,
    });
    const resolvedOrg = reqCtx.organizationId;
    const orgForBrand = organizationId ?? (resolvedOrg === SYSTEM_ORGANIZATION_ID ? null : resolvedOrg);

    const result = assertBrandEditAccess(reqCtx, {
        permission: 'brand:edit',
        organizationId: orgForBrand,
    });

    if (result instanceof Response) {
        return result;
    }

    const rbac: RBACContext = {
        user: reqCtx.user,
        roles: reqCtx.roles,
        permissions: reqCtx.permissions,
        isAuthenticated: reqCtx.isAuthenticated,
        // Brand rows are app-global; a null org (system/default brand) maps to "no tenant".
        organizationId: result.organizationId ?? undefined,
        tenantId: result.organizationId ?? undefined,
    };

    return {
        user: result.user,
        organizationId: result.organizationId,
        appId: appId || reqCtx.appId,
        rbac,
        session: reqCtx.session,
    };
}

export { SYSTEM_ORGANIZATION_ID };

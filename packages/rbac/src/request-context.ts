import { getSession } from '@ottabase/auth/backend';
import { User } from '@ottabase/ottaorm/models';
import type { RBACCache } from './cache';
import { createRBACContext } from './utils';

export interface RequestContext {
    sessionUser: { id: string; email?: string; name?: string } | null;
    user: any | null;
    organizationId: string | null;
    appId: string;
    roles: string[];
    permissions: string[];
    isAuthenticated: boolean;
    isSystemScope: boolean;
    cache?: RBACCache;
    session?: any;
}

export interface GetRequestContextOptions {
    getAuthOptions?: (env: any) => any;
    allowNullTenant?: boolean;
    cache?: RBACCache;
    /** When set, use this org for scoped permission loading (e.g. for brand routes using ?organizationId=) */
    organizationIdOverride?: string | null;
}

export const SYSTEM_ORGANIZATION_ID = 'system';

function parseBooleanFlag(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
        const normalized = value.toLowerCase();
        return normalized === 'true' || normalized === '1' || normalized === 'yes';
    }
    return false;
}

function cleanValue(value: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
    return trimmed;
}

function resolveOrganizationId(request: Request, session: any, allowNullTenant: boolean): string | null {
    const url = new URL(request.url);

    const fromSession = cleanValue(session?.user?.organizationId ?? null);
    if (fromSession) return fromSession;

    const headerOrg = cleanValue(request.headers.get('x-org-id'));
    if (headerOrg) return headerOrg;

    const queryOrg = cleanValue(url.searchParams.get('organizationId'));
    if (queryOrg) return queryOrg;

    const host = request.headers.get('host') || url.hostname;
    const subdomain = host.split('.')[0];
    const isLocalhost = host.startsWith('127.') || host.startsWith('localhost');
    if (subdomain && !['www'].includes(subdomain) && !isLocalhost) {
        return `org-${subdomain}`;
    }

    if (allowNullTenant) {
        return SYSTEM_ORGANIZATION_ID;
    }

    return null;
}

function resolveAppId(request: Request): string {
    return cleanValue(request.headers.get('x-app-id')) || 'web';
}

export async function getRequestContext(
    request: Request,
    env: any,
    options?: GetRequestContextOptions,
): Promise<RequestContext> {
    const allowNullTenant =
        options?.allowNullTenant ?? parseBooleanFlag(env?.ALLOW_NULL_TENANT ?? env?.allowNullTenant ?? '');

    const session = await getSession(request, env as any, options?.getAuthOptions?.(env));
    if (!session?.user?.id) {
        return {
            sessionUser: null,
            user: null,
            organizationId: null,
            appId: resolveAppId(request),
            roles: [],
            permissions: [],
            isAuthenticated: false,
            isSystemScope: false,
            cache: options?.cache,
            session,
        };
    }

    const user = await User.find(session.user.id);
    if (!user) {
        return {
            sessionUser: session.user,
            user: null,
            organizationId: null,
            appId: resolveAppId(request),
            roles: [],
            permissions: [],
            isAuthenticated: false,
            isSystemScope: false,
            cache: options?.cache,
            session,
        };
    }

    const resolvedOrg = resolveOrganizationId(request, session, allowNullTenant);
    const organizationId = options?.organizationIdOverride !== undefined ? options.organizationIdOverride : resolvedOrg;
    const appId = resolveAppId(request);
    const cache = options?.cache;

    // Load system-scope roles (always applied)
    const systemContext = await createRBACContext(user, cache, {
        organizationId: SYSTEM_ORGANIZATION_ID,
        tenantId: SYSTEM_ORGANIZATION_ID,
    });

    // Load scoped context for the requested org (if any)
    const scopedContext = await createRBACContext(user, cache, {
        organizationId: organizationId ?? undefined,
        tenantId: organizationId ?? undefined,
    });

    const roles = Array.from(new Set([...(systemContext.roles || []), ...(scopedContext.roles || [])]));
    const permissions = Array.from(
        new Set([...(systemContext.permissions || []), ...(scopedContext.permissions || [])]),
    );

    const finalOrganizationId = organizationId ?? (allowNullTenant ? SYSTEM_ORGANIZATION_ID : null);

    return {
        sessionUser: session.user,
        user,
        organizationId: finalOrganizationId,
        appId,
        roles,
        permissions,
        isAuthenticated: systemContext.isAuthenticated || scopedContext.isAuthenticated,
        isSystemScope: finalOrganizationId === SYSTEM_ORGANIZATION_ID,
        cache,
        session,
    };
}

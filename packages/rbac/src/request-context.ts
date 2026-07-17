import { getSession } from '@ottabase/auth/backend';
import { User } from '@ottabase/ottaorm/models';
import type { RBACCache } from './cache';
import { createRBACContext } from './utils';

export interface RequestContext {
    sessionUser: { id: string; email?: string | null; name?: string | null } | null;
    user: any | null;
    organizationId: string | null;
    appId: string;
    /** Merged role names (system-scope grants ∪ active-org grants). Display/convenience only. */
    roles: string[];
    /** Merged permissions (system-scope ∪ active-org). Convenience; org gates use this. */
    permissions: string[];
    /**
     * Roles/permissions from SYSTEM-scoped grants only (organization_id = 'system'). These carry
     * platform authority. Platform-admin gates read `systemPermissions` so an org-scoped grant of
     * the same permission (or a role merely NAMED 'owner'/'admin' in a personal org) can never
     * reach the control plane.
     */
    systemRoles: string[];
    systemPermissions: string[];
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
            systemRoles: [],
            systemPermissions: [],
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
            systemRoles: [],
            systemPermissions: [],
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

    const systemRoles = systemContext.roles || [];
    const systemPermissions = systemContext.permissions || [];
    const roles = Array.from(new Set([...systemRoles, ...(scopedContext.roles || [])]));
    const permissions = Array.from(new Set([...systemPermissions, ...(scopedContext.permissions || [])]));

    const finalOrganizationId = organizationId ?? (allowNullTenant ? SYSTEM_ORGANIZATION_ID : null);

    return {
        sessionUser: session.user,
        user,
        organizationId: finalOrganizationId,
        appId,
        roles,
        permissions,
        systemRoles,
        systemPermissions,
        isAuthenticated: systemContext.isAuthenticated || scopedContext.isAuthenticated,
        isSystemScope: finalOrganizationId === SYSTEM_ORGANIZATION_ID,
        cache,
        session,
    };
}

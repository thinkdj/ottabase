// ============================================================
// @ottabase/rbac - Request Context Builder
// ============================================================
//
// Extracts authentication, organization, and RBAC context from
// an incoming request. Works with Cloudflare Workers + Auth.js.
//
// System-scoped roles (organization_id = 'system') are ALWAYS
// loaded and merged, so a system owner's *:* applies everywhere.
// ============================================================

import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import type { RBACCache } from './cache';

/** Sentinel value for system-scoped user_roles rows. */
export const SYSTEM_ORG_ID = 'system';

/**
 * Fully resolved request context for authorization decisions.
 */
export interface RequestContext {
    /** Session user data (id, email, name, image). Null if unauthenticated. */
    sessionUser: { id: string; email?: string; name?: string; image?: string } | null;
    /** Current organization scope. Null = system scope or no org resolved. */
    organizationId: string | null;
    /** App identifier (default: 'web'). */
    appId: string;
    /** Merged role names (system + org-scoped). */
    roles: string[];
    /** Merged permission strings (system + org-scoped). */
    permissions: string[];
    /** Whether the request has a valid session. */
    isAuthenticated: boolean;
    /** True when operating in system scope (no org context). */
    isSystemScope: boolean;
    /** Whether null tenant is allowed (single-founder mode). */
    allowNullTenant: boolean;
    /** Optional RBAC cache reference. */
    cache?: RBACCache;
}

/**
 * Minimal env shape needed by getRequestContext.
 * Compatible with CloudflareEnv — we only reference the bindings we need.
 */
export interface RequestContextEnv {
    OBCF_D1?: D1Database;
    OBCF_KV?: KVNamespace;
    AUTH_SECRET?: string;
    AUTH_URL?: string;
    NEXTAUTH_URL?: string;
    ENVIRONMENT?: string;
    /** Set to 'true' to allow requests without an organization context (single-founder mode). Default: 'true'. */
    ALLOW_NULL_TENANT?: string;
    [key: string]: unknown;
}

export interface GetRequestContextOptions {
    /** Custom function to get the auth session. If not provided, uses @ottabase/auth/backend getSession. */
    getSession?: (request: Request, env: RequestContextEnv) => Promise<any>;
    /** Custom function to get auth config options. */
    getAuthOptions?: (env: any) => any;
    /** RBAC cache instance. */
    cache?: RBACCache;
}

/**
 * Build a full request context from an incoming request.
 *
 * 1. Resolves session via Auth.js
 * 2. Resolves organizationId from session / header / subdomain / query
 * 3. Loads system-scoped roles (always) + org-scoped roles (if org resolved)
 * 4. Merges into a single unified context
 */
export async function getRequestContext(
    request: Request,
    env: RequestContextEnv,
    options?: GetRequestContextOptions,
): Promise<RequestContext> {
    const allowNullTenant = env.ALLOW_NULL_TENANT !== 'false'; // default true

    // ── 1. Resolve session ────────────────────────────────────
    let session: any = null;
    try {
        if (options?.getSession) {
            session = await options.getSession(request, env);
        } else {
            // Dynamic import to avoid hard coupling at module level
            const { getSession } = await import('@ottabase/auth/backend');
            const authOptions = options?.getAuthOptions ? options.getAuthOptions(env) : undefined;
            session = await getSession(request, env as any, authOptions);
        }
    } catch (error) {
        console.warn('[rbac] Failed to resolve session:', error);
    }

    if (!session?.user?.id) {
        return {
            sessionUser: null,
            organizationId: null,
            appId: 'web',
            roles: [],
            permissions: [],
            isAuthenticated: false,
            isSystemScope: true,
            allowNullTenant,
            cache: options?.cache,
        };
    }

    const sessionUser = {
        id: session.user.id as string,
        email: session.user.email as string | undefined,
        name: session.user.name as string | undefined,
        image: session.user.image as string | undefined,
    };

    // ── 2. Resolve organization context ───────────────────────
    const organizationId = resolveOrganizationId(request, session);
    const appId = request.headers.get('x-app-id') || 'web';
    const isSystemScope = !organizationId;

    // ── 3. Collect roles + permissions from session ───────────
    // The JWT callback already loads system + org roles into the token.
    // We trust the session data here to avoid redundant DB queries.
    const roles: string[] = Array.isArray(session.user.roles) ? session.user.roles : [];
    const permissions: string[] = Array.isArray(session.user.permissions) ? session.user.permissions : [];

    return {
        sessionUser,
        organizationId,
        appId,
        roles,
        permissions,
        isAuthenticated: true,
        isSystemScope,
        allowNullTenant,
        cache: options?.cache,
    };
}

/**
 * Resolve organizationId from multiple sources (priority order):
 * 1. Session (JWT token embeds the user's primary org)
 * 2. X-Organization-Id header
 * 3. Subdomain extraction
 * 4. Query parameter
 */
function resolveOrganizationId(request: Request, session: any): string | null {
    // 1. Session
    if (session?.user?.organizationId) {
        return session.user.organizationId;
    }

    // 2. Header
    const orgHeader = request.headers.get('x-organization-id');
    if (orgHeader && orgHeader !== 'null') {
        return orgHeader;
    }

    // 3. Subdomain
    const url = new URL(request.url);
    const host = request.headers.get('host') || url.hostname;
    const subdomain = host.split('.')[0];
    if (subdomain && subdomain !== 'www' && subdomain !== 'localhost' && !host.startsWith('127.0.0.1')) {
        return `org-${subdomain}`;
    }

    // 4. Query param
    const orgQuery = url.searchParams.get('organizationId');
    if (orgQuery && orgQuery !== 'null') {
        return orgQuery;
    }

    return null;
}

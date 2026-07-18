import { getSession } from '@ottabase/auth/backend';
import { errorResponse } from '@ottabase/utils/http-errors';
import { paginatedJsonResponse, parsePaginationParams } from '@ottabase/utils/pagination';
import { requireAdminAccess, SYSTEM_ORGANIZATION_ID } from '../lib/admin-guard';
import { getAuthOptions } from '../lib/auth-utils';
import { isDevEnvironment, requireSessionOrDev } from '../lib/utils';
import type { CloudflareEnv } from '../../cloudflare-env';
import type { ApiRouteContext } from './router';

export interface AuditRouteContext {
    request: Request;
    env: CloudflareEnv;
    url: URL;
}

export async function handleAuditLogs(context: AuditRouteContext): Promise<Response> {
    const { env, request, url } = context;

    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    const session = await getSession(request, env as any, getAuthOptions(env));
    const userId = session?.user?.id;
    const isDev = isDevEnvironment(env);

    const authError = requireSessionOrDev(userId, env);
    if (authError) return authError;

    const sessionUser = session?.user as any | undefined;
    const userOrgId = sessionUser?.organizationId as string | undefined;

    // Admin status is validated against the live RBAC context, not the session snapshot's
    // role names — role names alone are ambiguous ('owner' exists in every personal org).
    // Non-admins fall through to seeing their own rows only.
    const adminAuth = isDev
        ? null
        : await requireAdminAccess(context as unknown as ApiRouteContext, { scope: 'either' });
    const adminContext = adminAuth && !(adminAuth instanceof Response) ? adminAuth : null;
    const isAdmin = isDev || adminContext !== null;

    // Audit rows are tenant data: admins — the platform owner included — only see rows for
    // organizations they are an active member of. A system-scope admin additionally sees
    // platform-level rows (organization_id 'system' or NULL, e.g. migrations), but never
    // another tenant's rows. allowedOrgIds === null means unconstrained (dev only).
    const isSystemAdmin = adminContext?.organizationId === SYSTEM_ORGANIZATION_ID;
    let allowedOrgIds: string[] | null = null;
    if (adminContext && userId) {
        const memberships = await env.OBCF_D1.prepare(
            `SELECT organization_id FROM organization_members WHERE user_id = ? AND status = 'active'`,
        )
            .bind(userId)
            .all<any>();
        allowedOrgIds = (memberships.results || []).map((row: any) => String(row.organization_id));
        if (isSystemAdmin && !allowedOrgIds.includes(SYSTEM_ORGANIZATION_ID)) {
            allowedOrgIds.push(SYSTEM_ORGANIZATION_ID);
        }
    }

    const { page, perPage } = parsePaginationParams(url.searchParams);
    const search = (url.searchParams.get('search') || '').trim().toLowerCase();
    const action = url.searchParams.get('action') || '';
    const resourceType = url.searchParams.get('entityType') || '';
    const requestedUserId = url.searchParams.get('userId') || '';
    const requestedOrgId = url.searchParams.get('organizationId') || '';

    const effectiveUserId = isAdmin ? requestedUserId || null : userId;

    const conditions: string[] = [];
    const values: any[] = [];

    if (effectiveUserId) {
        conditions.push('user_id = ?');
        values.push(effectiveUserId);
    }

    if (!isAdmin) {
        if (userOrgId) {
            conditions.push('organization_id = ?');
            values.push(userOrgId);
        }
    } else if (allowedOrgIds === null) {
        if (requestedOrgId) {
            conditions.push('organization_id = ?');
            values.push(requestedOrgId);
        }
    } else if (requestedOrgId) {
        if (!allowedOrgIds.includes(requestedOrgId)) {
            return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
        }
        conditions.push('organization_id = ?');
        values.push(requestedOrgId);
    } else {
        const orgClauses: string[] = [];
        if (allowedOrgIds.length > 0) {
            orgClauses.push(`organization_id IN (${allowedOrgIds.map(() => '?').join(', ')})`);
            values.push(...allowedOrgIds);
        }
        if (isSystemAdmin) {
            orgClauses.push('organization_id IS NULL');
        }
        conditions.push(orgClauses.length > 0 ? `(${orgClauses.join(' OR ')})` : '0 = 1');
    }

    if (action) {
        conditions.push('action = ?');
        values.push(action);
    }

    if (resourceType) {
        conditions.push('resource_type = ?');
        values.push(resourceType);
    }

    if (search) {
        const like = `%${search}%`;
        conditions.push(
            `(LOWER(user_email) LIKE ? OR LOWER(resource_type) LIKE ? OR LOWER(resource_id) LIKE ? OR LOWER(action) LIKE ?)`,
        );
        values.push(like, like, like, like);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * perPage;

    const countResult = await env.OBCF_D1.prepare(`SELECT count(*) as total FROM audit_logs ${whereClause}`)
        .bind(...values)
        .first<any>();

    const total = Number(countResult?.total || 0);

    const results = await env.OBCF_D1.prepare(
        `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
        .bind(...values, perPage, offset)
        .all<any>();

    return paginatedJsonResponse({
        data: results.results || [],
        total,
        page,
        perPage,
        path: '/api/audit/logs',
    });
}

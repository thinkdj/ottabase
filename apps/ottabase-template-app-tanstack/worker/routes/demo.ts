import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { paginatedJsonResponse, parsePaginationParams } from '@ottabase/utils/pagination';
import { readJson } from '../lib/utils';
import { getSession } from '@ottabase/auth/backend';
import { getAuthOptions } from '../lib/auth-utils';
import type { CloudflareEnv } from '../../cloudflare-env';

export interface DemoRouteContext {
    request: Request;
    env: CloudflareEnv;
    url: URL;
}

export async function handleDemo(context: DemoRouteContext): Promise<Response> {
    const { request } = context;

    if (request.method === 'GET') {
        return jsonResponse({
            message: 'Hello from GET',
            method: 'GET',
            timestamp: Date.now(),
        });
    }

    if (request.method === 'POST') {
        const body = await readJson<{ name?: string }>(request);
        return jsonResponse({
            message: `Hello, ${body.name || 'World'}!`,
            method: 'POST',
            timestamp: Date.now(),
        });
    }

    if (request.method === 'DELETE') {
        return jsonResponse({
            message: 'Resource deleted',
            method: 'DELETE',
            timestamp: Date.now(),
        });
    }

    return errorResponse('Method not allowed', 405, {
        code: 'METHOD_NOT_ALLOWED',
    });
}

export async function handleAuditLogs(context: DemoRouteContext): Promise<Response> {
    const { env, request, url } = context;

    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    const session = await getSession(request, env as any, getAuthOptions(env));
    const userId = session?.user?.id;
    const isDev =
        !env.ENVIRONMENT ||
        env.ENVIRONMENT === 'development' ||
        env.ENVIRONMENT === 'dev' ||
        env.ENVIRONMENT === 'test';

    if (!userId && !isDev) {
        return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
    }

    const sessionUser = session?.user as any | undefined;
    const userOrgId = sessionUser?.organizationId as string | undefined;
    const roles = (sessionUser?.roles as string[]) || [];
    const permissions = (sessionUser?.permissions as string[]) || [];

    const isAdmin =
        isDev ||
        roles.includes('admin') ||
        permissions.includes('*:*') ||
        permissions.includes('audit:*') ||
        permissions.includes('audit:read');

    const { page, perPage } = parsePaginationParams(url.searchParams);
    const search = (url.searchParams.get('search') || '').trim().toLowerCase();
    const action = url.searchParams.get('action') || '';
    const resourceType = url.searchParams.get('entityType') || '';
    const requestedUserId = url.searchParams.get('userId') || '';
    const requestedOrgId = url.searchParams.get('organizationId') || '';

    const effectiveUserId = isAdmin ? requestedUserId || null : userId;
    const effectiveOrgId = isAdmin ? requestedOrgId || null : userOrgId || null;

    const conditions: string[] = [];
    const values: any[] = [];

    if (effectiveUserId) {
        conditions.push('user_id = ?');
        values.push(effectiveUserId);
    }

    if (effectiveOrgId) {
        conditions.push('organization_id = ?');
        values.push(effectiveOrgId);
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

export function handleDemoError(): Response {
    return errorResponse('Something went wrong', 500, {
        code: 'DEMO_ERROR',
        hint: 'This is a demo error response with multiple messages',
        messages: [
            'Primary error: Database connection failed',
            'Secondary issue: Authentication token expired',
            'Additional context: Rate limit may have been exceeded',
        ],
    });
}

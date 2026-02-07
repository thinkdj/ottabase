// ============================================================
// Feature Flags API Routes
// ============================================================

import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection } from '@ottabase/ottaorm';
import { FeatureFlag, evaluateFlags, getCachedFlags, invalidateFlagCache } from '@ottabase/flags';
import type { ResolvedFlag, EvalContext } from '@ottabase/flags';
import { AuditLog, Organization } from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { paginatedJsonResponse, parsePaginationParams } from '@ottabase/utils/pagination';
import { getSession } from '@ottabase/auth/backend';
import { getAuthOptions } from '../lib/auth-utils';
import { readJson } from '../lib/utils';
import type { CloudflareEnv } from '../../cloudflare-env';

export interface FlagsRouteContext {
    request: Request;
    env: CloudflareEnv;
    url: URL;
}

// Helper to resolve session user for audit logging
async function getSessionUser(request: Request, env: CloudflareEnv) {
    const session = await getSession(request, env as any, getAuthOptions(env));
    return {
        userId: session?.user?.id ?? undefined,
        userEmail: (session?.user as any)?.email ?? undefined,
        organizationId: request.headers.get('x-organization-id') || session?.user?.organizationId || undefined,
    };
}

// ============================================================
// Evaluate flags for the current user (public endpoint)
// ============================================================

export async function handleFlagsEvaluate(context: FlagsRouteContext): Promise<Response> {
    const { request, env } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const { userId, organizationId } = await getSessionUser(request, env);

    // Resolve plan from organization if we have one
    let plan: string | undefined;
    if (organizationId) {
        const org = await Organization.find(organizationId);
        if (org) {
            plan = (org.get('plan') as string) || 'free';
        }
    }

    const evalCtx: EvalContext = { userId, organizationId, plan };

    const fetchFromDb = async (): Promise<ResolvedFlag[]> => {
        const all = await FeatureFlag.all();
        return all.map((f) => ({
            key: f.get('key') as string,
            enabled: f.get('enabled') as boolean,
            rules: (f as FeatureFlag).getRules(),
        }));
    };

    const resolvedFlags = await getCachedFlags(env.OBCF_KV, fetchFromDb);
    const flags = evaluateFlags(resolvedFlags, evalCtx);

    return jsonResponse({ flags });
}

// ============================================================
// Admin: List all flags
// ============================================================

export async function handleFlagsList(context: FlagsRouteContext): Promise<Response> {
    const { env, url } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const { page, perPage, orderBy, order } = parsePaginationParams(url.searchParams);

    const paginationResult = await FeatureFlag.paginate(page, perPage, undefined, {
        orderBy: orderBy || 'createdAt',
        orderDirection: order || 'desc',
    });

    return paginatedJsonResponse({
        data: paginationResult.data.map((f) => f.toJson()),
        total: paginationResult.total,
        page: paginationResult.page,
        perPage: paginationResult.perPage,
        path: '/api/flags',
    });
}

// ============================================================
// Admin: List recent flag audit logs
// ============================================================

export async function handleFlagsAuditLog(context: FlagsRouteContext): Promise<Response> {
    const { env } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const logs = await AuditLog.getByResource('feature_flag', undefined, 50);
    return jsonResponse({ data: logs.map((l) => l.toJson()) });
}

// ============================================================
// Admin: Create a flag
// ============================================================

export async function handleFlagsCreate(context: FlagsRouteContext): Promise<Response> {
    const { request, env } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const body = await readJson<{
        key?: string;
        name?: string;
        description?: string;
        enabled?: boolean;
        rules?: Record<string, unknown>;
    }>(request);

    if (!body.key || !body.name) {
        return errorResponse('key and name are required', 400);
    }

    const existing = await FeatureFlag.findByKey(body.key);
    if (existing) {
        return errorResponse('Flag key already exists', 409, { code: 'DUPLICATE_KEY' });
    }

    const { userId, userEmail, organizationId } = await getSessionUser(request, env);

    try {
        const flag = await FeatureFlag.create({
            key: body.key,
            name: body.name,
            description: body.description || null,
            enabled: body.enabled ?? false,
            rules: body.rules || {},
        });

        await invalidateFlagCache(env.OBCF_KV);

        // Audit log
        AuditLog.log({
            userId,
            userEmail,
            organizationId,
            action: 'create',
            resourceType: 'feature_flag',
            resourceId: flag.get('id') as string,
            changes: { key: body.key, name: body.name, enabled: body.enabled ?? false, rules: body.rules || {} },
        }).catch(() => {});

        return jsonResponse({ success: true, data: flag.toJson() });
    } catch (error) {
        return errorResponse(error instanceof Error ? error.message : 'Failed to create flag', 400, {
            code: 'VALIDATION_ERROR',
        });
    }
}

// ============================================================
// Admin: Update or delete a flag by ID
// ============================================================

export async function handleFlagById(
    context: FlagsRouteContext,
    id: string,
    method: 'PATCH' | 'DELETE',
): Promise<Response> {
    const { request, env } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const { userId, userEmail, organizationId } = await getSessionUser(request, env);

    if (method === 'DELETE') {
        const flag = await FeatureFlag.find(id);
        if (!flag) return errorResponse('Flag not found', 404);

        const flagKey = flag.get('key') as string;
        await FeatureFlag.delete(id);
        await invalidateFlagCache(env.OBCF_KV);

        // Audit log
        AuditLog.log({
            userId,
            userEmail,
            organizationId,
            action: 'delete',
            resourceType: 'feature_flag',
            resourceId: id,
            metadata: { key: flagKey },
        }).catch(() => {});

        return jsonResponse({ success: true, message: 'Flag deleted' });
    }

    // PATCH
    const body = await readJson<{
        name?: string;
        description?: string;
        enabled?: boolean;
        rules?: Record<string, unknown>;
    }>(request);

    const flag = await FeatureFlag.find(id);
    if (!flag) return errorResponse('Flag not found', 404);

    // Capture before state for audit
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    if (body.name !== undefined) {
        before.name = flag.get('name');
        after.name = body.name;
        flag.set('name', body.name);
    }
    if (body.description !== undefined) {
        before.description = flag.get('description');
        after.description = body.description;
        flag.set('description', body.description);
    }
    if (body.enabled !== undefined) {
        before.enabled = flag.get('enabled');
        after.enabled = body.enabled;
        flag.set('enabled', body.enabled);
    }
    if (body.rules !== undefined) {
        before.rules = (flag as FeatureFlag).getRules();
        after.rules = body.rules;
        flag.set('rules', body.rules);
    }

    try {
        await flag.save();
        await invalidateFlagCache(env.OBCF_KV);

        // Audit log
        AuditLog.log({
            userId,
            userEmail,
            organizationId,
            action: 'update',
            resourceType: 'feature_flag',
            resourceId: id,
            changes: { before, after },
            metadata: { key: flag.get('key') },
        }).catch(() => {});

        return jsonResponse({ success: true, data: flag.toJson() });
    } catch (error) {
        return errorResponse(error instanceof Error ? error.message : 'Failed to update flag', 400, {
            code: 'VALIDATION_ERROR',
        });
    }
}

// ============================================================
// Admin: Toggle a flag on/off quickly
// ============================================================

export async function handleFlagToggle(context: FlagsRouteContext, id: string): Promise<Response> {
    const { request, env } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const flag = await FeatureFlag.find(id);
    if (!flag) return errorResponse('Flag not found', 404);

    const wasBefore = flag.get('enabled');
    (flag as FeatureFlag).toggle();
    await flag.save();
    await invalidateFlagCache(env.OBCF_KV);

    // Audit log
    const { userId, userEmail, organizationId } = await getSessionUser(request, env);
    AuditLog.log({
        userId,
        userEmail,
        organizationId,
        action: 'update',
        resourceType: 'feature_flag',
        resourceId: id,
        changes: { before: { enabled: wasBefore }, after: { enabled: flag.get('enabled') } },
        metadata: { key: flag.get('key'), action: 'toggle' },
    }).catch(() => {});

    return jsonResponse({
        success: true,
        data: flag.toJson(),
    });
}

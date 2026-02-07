// ============================================================
// Admin Bootstrap Routes
// ============================================================
//
// Emergency endpoints for system owner management.
// Protected by PROMOTE_SECRET env variable — not by session auth
// (since the whole point is to recover when auth/roles are broken).
// ============================================================

import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { CloudflareEnv } from '../../cloudflare-env';

export interface AdminBootstrapContext {
    request: Request;
    env: CloudflareEnv;
}

/** Well-known ID for the system 'owner' role (matches migration 003). */
const SYSTEM_OWNER_ROLE_ID = '00000000-0000-0000-0000-000000000000';
const SYSTEM_ORG_ID = 'system';

/**
 * POST /api/admin/bootstrap/promote-owner
 *
 * Promotes a user to system owner. Guarded by PROMOTE_SECRET env var.
 *
 * Body: { email: string, secret: string }
 */
export async function handlePromoteOwner(context: AdminBootstrapContext): Promise<Response> {
    const { request, env } = context;

    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' });
    }

    // Require PROMOTE_SECRET to be configured
    const promoteSecret = (env as any).PROMOTE_SECRET;
    if (!promoteSecret) {
        return errorResponse(
            'PROMOTE_SECRET environment variable is not configured',
            503,
            { code: 'NOT_CONFIGURED' },
        );
    }

    let body: any;
    try {
        body = await request.json();
    } catch {
        return errorResponse('Invalid JSON body', 400, { code: 'VALIDATION_ERROR' });
    }

    const { email, secret } = body || {};

    if (!email || typeof email !== 'string') {
        return errorResponse('email is required', 400, { code: 'VALIDATION_ERROR' });
    }

    if (!secret || typeof secret !== 'string') {
        return errorResponse('secret is required', 400, { code: 'VALIDATION_ERROR' });
    }

    // Timing-safe comparison of the secret
    if (!timingSafeEqual(secret, promoteSecret)) {
        return errorResponse('Invalid secret', 403, { code: 'FORBIDDEN' });
    }

    // Find the user by email
    const user = await env.OBCF_D1
        .prepare(`SELECT id, name, email FROM users WHERE email = ? LIMIT 1`)
        .bind(email.trim().toLowerCase())
        .first<{ id: string; name: string; email: string }>();

    if (!user) {
        return errorResponse('User not found', 404, { code: 'NOT_FOUND' });
    }

    // Ensure the owner role exists
    let ownerRoleId: string;
    const ownerRole = await env.OBCF_D1
        .prepare(`SELECT id FROM roles WHERE name = 'owner' LIMIT 1`)
        .first<{ id: string }>();

    if (ownerRole) {
        ownerRoleId = ownerRole.id;
    } else {
        ownerRoleId = SYSTEM_OWNER_ROLE_ID;
        await env.OBCF_D1
            .prepare(
                `INSERT OR IGNORE INTO roles (id, name, description, permissions, is_system, created_at, updated_at)
                 VALUES (?, 'owner', 'System owner - full platform access across all organizations', '["*:*"]', 1, unixepoch(), unixepoch())`,
            )
            .bind(ownerRoleId)
            .run();
    }

    // Assign system-scoped owner role
    await env.OBCF_D1
        .prepare(
            `INSERT OR IGNORE INTO user_roles (user_id, role_id, organization_id, app_id, assigned_at, assigned_by)
             VALUES (?, ?, ?, NULL, unixepoch(), 'promote-owner-endpoint')`,
        )
        .bind(user.id, ownerRoleId, SYSTEM_ORG_ID)
        .run();

    // Audit log
    try {
        await env.OBCF_D1
            .prepare(
                `INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, metadata, status, created_at)
                 VALUES (?, ?, 'system.promote_owner', 'user', ?, '{"event":"manual_promote","email":"${email}"}', 'success', unixepoch())`,
            )
            .bind(crypto.randomUUID(), user.id, user.id)
            .run();
    } catch {
        // best-effort
    }

    console.log(`[ottabase] User ${email} promoted to system owner via PROMOTE_SECRET endpoint`);

    return jsonResponse({
        success: true,
        message: `User ${email} is now a system owner`,
        userId: user.id,
    });
}

/**
 * POST /api/admin/bootstrap/status
 *
 * Check bootstrap status (is there a system owner?).
 * Also guarded by PROMOTE_SECRET.
 */
export async function handleBootstrapStatus(context: AdminBootstrapContext): Promise<Response> {
    const { request, env } = context;

    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' });
    }

    const promoteSecret = (env as any).PROMOTE_SECRET;
    if (!promoteSecret) {
        return errorResponse('PROMOTE_SECRET not configured', 503, { code: 'NOT_CONFIGURED' });
    }

    let body: any;
    try {
        body = await request.json();
    } catch {
        return errorResponse('Invalid JSON body', 400, { code: 'VALIDATION_ERROR' });
    }

    if (!body?.secret || !timingSafeEqual(body.secret, promoteSecret)) {
        return errorResponse('Invalid secret', 403, { code: 'FORBIDDEN' });
    }

    const userCount = await env.OBCF_D1
        .prepare(`SELECT count(*) as cnt FROM users`)
        .first<{ cnt: number }>();

    const ownerCount = await env.OBCF_D1
        .prepare(
            `SELECT count(*) as cnt FROM user_roles ur
             JOIN roles r ON r.id = ur.role_id
             WHERE r.name = 'owner' AND ur.organization_id = 'system'`,
        )
        .first<{ cnt: number }>();

    return jsonResponse({
        totalUsers: userCount?.cnt ?? 0,
        systemOwners: ownerCount?.cnt ?? 0,
        hasSystemOwner: (ownerCount?.cnt ?? 0) > 0,
    });
}

/**
 * Constant-time string comparison to prevent timing attacks on the secret.
 */
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
        // Still do the work to avoid length-based timing
        let diff = a.length ^ b.length;
        for (let i = 0; i < a.length; i++) {
            diff |= a.charCodeAt(i) ^ (b.charCodeAt(i % b.length) || 0);
        }
        return false;
    }

    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}

/**
 * GDPR-style user data export & account deletion routes
 *
 * - GET /api/users/me/export  → Download all user data as JSON
 * - POST /api/users/me/delete → Delete account and all related rows
 */
import { getSession } from '@ottabase/auth/backend';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { registerConnection } from '@ottabase/ottaorm';
import { Account, AuditLog, OrganizationMember, Session, User, UserRole } from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { CloudflareEnv } from '../../cloudflare-env';
import { getOttabaseConfig } from '../../ottabase/config.loader';
import { Todo } from '../../ottabase/models/Todo';
import { getAuthOptions } from '../lib/auth-utils';
import { enforceRateLimit } from '../lib/rate-limiting';
import { getClientIpAddress, readJson } from '../lib/utils';

export interface UserDataRouteContext {
    request: Request;
    env: CloudflareEnv;
    url: URL;
    withAuthCors: (response: Response) => Response;
}

// ============================================================
// HELPERS
// ============================================================

/** Placeholder email for anonymized audit log records */
const ANONYMIZED_USER_EMAIL = 'deleted-user';

/** Resolve the authenticated user from the session, returning userId or an error Response */
async function resolveAuthenticatedUser(
    request: Request,
    env: CloudflareEnv,
): Promise<{ userId: string; userEmail?: string } | Response> {
    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' });
    }

    const session = await getSession(request, env as any, getAuthOptions(env));
    const userId = session?.user?.id;

    if (!userId) {
        return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    return { userId, userEmail: session?.user?.email ?? undefined };
}

/** Safely collect records from a model, returning empty array on error */
async function safeCollect<T>(fn: () => Promise<T[]>): Promise<T[]> {
    try {
        return await fn();
    } catch {
        return [];
    }
}

/** Strip sensitive fields from a record */
function sanitizeRecord(record: Record<string, any>, sensitiveFields: string[] = []): Record<string, any> {
    const out = { ...record };
    for (const field of sensitiveFields) {
        delete out[field];
    }
    return out;
}

// ============================================================
// DATA EXPORT
// ============================================================

/**
 * Collect all data owned by a user across all registered models.
 * Returns a structured object keyed by data category.
 */
async function collectUserData(userId: string, env: CloudflareEnv) {
    const packages = getOttabaseConfig(env).packages;

    // Core user profile
    const user = await User.find(userId);
    const profile = user ? sanitizeRecord(user.toJson(), ['passwordHash']) : null;

    // Auth accounts (OAuth providers)
    const accounts = (await safeCollect(() => Account.where({ userId }))).map((a) =>
        sanitizeRecord(a.toJson(), ['access_token', 'refresh_token', 'id_token']),
    );

    // Active sessions
    const sessions = (await safeCollect(() => Session.where({ userId }))).map((s) =>
        sanitizeRecord(s.toJson(), ['sessionToken']),
    );

    // Role assignments
    const roles = (await safeCollect(() => UserRole.where({ userId }))).map((r) => r.toJson());

    // Organization memberships
    const memberships = (await safeCollect(() => OrganizationMember.where({ userId }))).map((m) => m.toJson());

    // Audit logs (user's own activity)
    const auditLogs = (await safeCollect(() => AuditLog.where({ userId }, { limit: 1000 }))).map((a) => a.toJson());

    // App-specific: Todos
    const todos = (await safeCollect(() => Todo.where({ userId }))).map((t) => t.toJson());

    // Package data (conditional on enabled packages)
    let comments: Record<string, any>[] = [];
    if (packages.comments) {
        try {
            const { Comment } = await import('@ottabase/comments');
            comments = (await safeCollect(() => Comment.where({ userId }))).map((c) => c.toJson());
        } catch {
            // Package not available
        }
    }

    let referrals: Record<string, any>[] = [];
    if (packages.referrals) {
        try {
            const { ReferralTracking } = await import('@ottabase/referrals');
            referrals = (await safeCollect(() => ReferralTracking.where({ userId }))).map((r) => r.toJson());
        } catch {
            // Package not available
        }
    }

    return {
        exportedAt: new Date().toISOString(),
        profile,
        accounts,
        sessions,
        roles,
        memberships,
        auditLogs,
        todos,
        ...(comments.length > 0 ? { comments } : {}),
        ...(referrals.length > 0 ? { referrals } : {}),
    };
}

/**
 * GET /api/users/me/export
 * Download all personal data as JSON (GDPR Article 20 - Right to data portability)
 */
export async function handleUserDataExport(context: UserDataRouteContext): Promise<Response> {
    const { request, env, withAuthCors } = context;

    // Rate limit: 5 exports per hour per IP
    const ip = getClientIpAddress(request);
    const rateLimit = await enforceRateLimit(request, env, `user-data-export:${ip}`);
    if (rateLimit) return withAuthCors(rateLimit);

    const authResult = await resolveAuthenticatedUser(request, env);
    if (authResult instanceof Response) return withAuthCors(authResult);
    const { userId, userEmail } = authResult;

    try {
        const data = await collectUserData(userId, env);

        // Audit log the export action
        try {
            await AuditLog.log({
                userId,
                userEmail,
                action: 'export',
                resourceType: 'user',
                resourceId: userId,
                metadata: {
                    type: 'gdpr_data_export',
                    ipAddress: ip,
                    categories: Object.keys(data).filter((k) => k !== 'exportedAt'),
                },
                ipAddress: ip,
                userAgent: request.headers.get('user-agent') || undefined,
                status: 'success',
            });
        } catch {
            // Audit log failure should not block export
        }

        // Return as downloadable JSON
        const body = JSON.stringify(data, null, 2);
        return withAuthCors(
            new Response(body, {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Disposition': `attachment; filename="user-data-export-${new Date().toISOString().slice(0, 10)}.json"`,
                    'Cache-Control': 'no-store',
                },
            }),
        );
    } catch (error) {
        console.error('Data export failed:', error);
        return withAuthCors(
            errorResponse('Failed to export data', 500, {
                code: 'EXPORT_FAILED',
                details: 'An error occurred while collecting your data. Please try again.',
            }),
        );
    }
}

// ============================================================
// ACCOUNT DELETION
// ============================================================

/**
 * Delete all user-owned rows across all models.
 * Order matters: delete dependent rows first, then the user.
 */
async function deleteAllUserData(userId: string, env: CloudflareEnv): Promise<{ deletedTables: string[] }> {
    const packages = getOttabaseConfig(env).packages;
    const deletedTables: string[] = [];

    // 1. Sessions (invalidate all active sessions)
    try {
        const sessions = await Session.where({ userId });
        for (const s of sessions) await Session.delete(s.get('id') as string);
        if (sessions.length > 0) deletedTables.push('sessions');
    } catch {
        // Table may not exist
    }

    // 2. Accounts (OAuth providers)
    try {
        const accounts = await Account.where({ userId });
        for (const a of accounts) await Account.delete(a.get('id') as string);
        if (accounts.length > 0) deletedTables.push('accounts');
    } catch {
        // Table may not exist
    }

    // 3. UserRoles
    try {
        const roles = await UserRole.where({ userId });
        for (const r of roles) await UserRole.delete(r.get('id') as string);
        if (roles.length > 0) deletedTables.push('user_roles');
    } catch {
        // Table may not exist
    }

    // 4. Organization memberships
    try {
        const memberships = await OrganizationMember.where({ userId });
        for (const m of memberships) await OrganizationMember.delete(m.get('id') as string);
        if (memberships.length > 0) deletedTables.push('organization_members');
    } catch {
        // Table may not exist
    }

    // 5. Todos (app-specific)
    try {
        const todos = await Todo.where({ userId });
        for (const t of todos) await Todo.delete(t.get('id') as string);
        if (todos.length > 0) deletedTables.push('todos');
    } catch {
        // Table may not exist
    }

    // 6. Comments (if enabled)
    if (packages.comments) {
        try {
            const { Comment } = await import('@ottabase/comments');
            const comments = await Comment.where({ userId });
            for (const c of comments) await Comment.delete(c.get('id') as string);
            if (comments.length > 0) deletedTables.push('comments');
        } catch {
            // Package not available
        }
    }

    // 7. Referral tracking (if enabled)
    if (packages.referrals) {
        try {
            const { ReferralTracking } = await import('@ottabase/referrals');
            const referrals = await ReferralTracking.where({ userId });
            for (const r of referrals) await ReferralTracking.delete(r.get('id') as string);
            if (referrals.length > 0) deletedTables.push('referral_tracking');
        } catch {
            // Package not available
        }
    }

    // 8. Audit logs — anonymize rather than delete for compliance trail
    try {
        const auditLogs = await AuditLog.where({ userId });
        for (const log of auditLogs) {
            log.set('userId', null);
            log.set('userEmail', ANONYMIZED_USER_EMAIL);
            log.set('ipAddress', null);
            log.set('userAgent', null);
            await log.save();
        }
        if (auditLogs.length > 0) deletedTables.push('audit_logs (anonymized)');
    } catch {
        // Table may not exist
    }

    // 9. Finally, delete the user record
    try {
        await User.delete(userId);
        deletedTables.push('users');
    } catch (error) {
        console.error('Failed to delete user record:', error);
        throw new Error('Failed to delete user record');
    }

    return { deletedTables };
}

/**
 * POST /api/users/me/delete
 * Delete account and all related data (GDPR Article 17 - Right to erasure)
 * Requires confirmation via email in request body
 */
export async function handleUserAccountDelete(context: UserDataRouteContext): Promise<Response> {
    const { request, env, withAuthCors } = context;

    // Rate limit: 3 attempts per hour per IP
    const ip = getClientIpAddress(request);
    const rateLimit = await enforceRateLimit(request, env, `user-account-delete:${ip}`);
    if (rateLimit) return withAuthCors(rateLimit);

    const authResult = await resolveAuthenticatedUser(request, env);
    if (authResult instanceof Response) return withAuthCors(authResult);
    const { userId, userEmail } = authResult;

    // Require the user to confirm by providing their email
    const body = await readJson<{ confirmEmail?: string }>(request);
    const confirmEmail = typeof body.confirmEmail === 'string' ? body.confirmEmail.trim().toLowerCase() : '';

    if (!confirmEmail) {
        return withAuthCors(
            errorResponse('Email confirmation required', 400, {
                code: 'CONFIRMATION_REQUIRED',
                details: 'Please provide your email address to confirm account deletion.',
            }),
        );
    }

    // Verify the confirmed email matches the user's email
    const user = await User.find(userId);
    if (!user) {
        return withAuthCors(errorResponse('User not found', 404, { code: 'NOT_FOUND' }));
    }

    const actualEmail = ((user.get('email') as string) || '').trim().toLowerCase();
    if (confirmEmail !== actualEmail) {
        return withAuthCors(
            errorResponse('Email does not match', 400, {
                code: 'EMAIL_MISMATCH',
                details: 'The provided email does not match your account email.',
            }),
        );
    }

    // Audit log BEFORE deletion (so we have a record even after the user is gone)
    try {
        await AuditLog.log({
            userId,
            userEmail,
            action: 'delete',
            resourceType: 'user',
            resourceId: userId,
            metadata: {
                type: 'gdpr_account_deletion',
                ipAddress: ip,
            },
            ipAddress: ip,
            userAgent: request.headers.get('user-agent') || undefined,
            status: 'success',
        });
    } catch {
        // Audit log failure should not block deletion
    }

    try {
        const result = await deleteAllUserData(userId, env);

        return withAuthCors(
            jsonResponse(
                {
                    success: true,
                    message: 'Your account and all associated data have been deleted.',
                    deletedTables: result.deletedTables,
                },
                200,
            ),
        );
    } catch (error) {
        console.error('Account deletion failed:', error);
        return withAuthCors(
            errorResponse('Failed to delete account', 500, {
                code: 'DELETION_FAILED',
                details: 'An error occurred while deleting your account. Please contact support.',
            }),
        );
    }
}

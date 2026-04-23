// ============================================================
// Account self-service: data export and account deletion.
//
// GET  /api/account/export  – returns all personal data as JSON.
// DELETE /api/account       – permanently deletes the account.
//
// Both endpoints require an active session. Deletion is blocked
// when the user is the sole active owner of any organization.
// ============================================================

import { getSession } from '@ottabase/auth/backend';
import { userKey } from '@ottabase/cf';
import {
    Account,
    MembershipError,
    OrganizationMember,
    Session,
    User,
    UserRole,
    VerificationToken,
} from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { CloudflareEnv } from '../../cloudflare-env';
import { getAuthOptions } from '../lib/auth-utils';
import { initDbConnection } from '../lib/db-utils';
import type { ApiRouteContext } from './router';

// ─── helpers ────────────────────────────────────────────────────────────────

async function requireAuthenticatedUser(
    context: ApiRouteContext,
): Promise<{ userId: string; userEmail: string } | Response> {
    const { env, request } = context;

    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, { code: 'CONFIG_ERROR' });
    }

    initDbConnection(env);

    const session = await getSession(request, env as CloudflareEnv, getAuthOptions(env));
    const userId = session?.user?.id ? String(session.user.id) : null;
    if (!userId) {
        return errorResponse('Authentication required', 401, { code: 'UNAUTHENTICATED' });
    }

    return { userId, userEmail: String(session.user?.email ?? '') };
}

// ─── export ─────────────────────────────────────────────────────────────────

export async function handleAccountExport(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAuthenticatedUser(context);
    if (auth instanceof Response) return auth;
    const { userId } = auth;

    try {
        const user = await User.find(userId);
        if (!user) {
            return errorResponse('User not found', 404, { code: 'NOT_FOUND' });
        }

        const [accounts, memberships, auditLogs] = await Promise.all([
            user.accounts(),
            OrganizationMember.getUserOrganizations(userId),
            user.auditLogs({ orderBy: 'createdAt', orderDirection: 'desc' }),
        ]);

        const safeUser = user.toJson();
        // passwordHash is already in User.hidden — toJson() strips it

        const data = {
            exportedAt: new Date().toISOString(),
            profile: safeUser,
            linkedAccounts: accounts.map((a) => ({
                provider: a.get('provider'),
                type: a.get('type'),
                createdAt: a.get('createdAt'),
            })),
            organizations: memberships.map((m) => ({
                organizationId: m.organizationId,
                organizationName: m.organization?.name ?? null,
                role: m.role,
                status: m.status,
                joinedAt: m.joinedAt,
            })),
            auditLogs: auditLogs.map((l) => ({
                action: l.get('action'),
                resourceType: l.get('resourceType'),
                resourceId: l.get('resourceId'),
                organizationId: l.get('organizationId'),
                metadata: l.get('metadata'),
                createdAt: l.get('createdAt'),
            })),
        };

        const json = JSON.stringify(data, null, 2);
        return new Response(json, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="account-export-${userId}.json"`,
            },
        });
    } catch (error) {
        return errorResponse('Failed to export account data', 500, {
            code: 'EXPORT_FAILED',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}

// ─── delete ─────────────────────────────────────────────────────────────────

export async function handleAccountDelete(context: ApiRouteContext): Promise<Response> {
    const auth = await requireAuthenticatedUser(context);
    if (auth instanceof Response) return auth;
    const { userId } = auth;
    const { env } = context;

    try {
        const user = await User.find(userId);
        if (!user) {
            return errorResponse('User not found', 404, { code: 'NOT_FOUND' });
        }

        // Check whether the user is the sole active owner of any organization.
        // If so, they must transfer ownership or delete that org first.
        const memberships = await OrganizationMember.getUserOrganizations(userId, { status: 'active' });
        const blockedOrgs: string[] = [];

        for (const m of memberships) {
            if (m.role === 'owner') {
                const isLast = await OrganizationMember.isLastActiveOwner(userId, m.organizationId);
                if (isLast) {
                    blockedOrgs.push(m.organization?.name ?? m.organizationId);
                }
            }
        }

        if (blockedOrgs.length > 0) {
            return errorResponse(
                `Cannot delete account: you are the sole owner of ${blockedOrgs.join(', ')}. Transfer ownership or delete the organization first.`,
                409,
                { code: 'LAST_ACTIVE_OWNER_GUARD', details: { organizations: blockedOrgs } as any },
            );
        }

        // Remove the user from all organizations (this also tears down tenant RBAC).
        // Fail the whole delete if any removal errors — otherwise we'd leave
        // orphaned organization_members / user_roles rows while still deleting
        // the user record, making the operation only partially effective.
        const removalFailures: Array<{ organizationId: string; error: string }> = [];
        for (const m of memberships) {
            try {
                await OrganizationMember.removeMember(userId, m.organizationId);
            } catch (err) {
                if (err instanceof MembershipError && err.code === 'LAST_ACTIVE_OWNER_GUARD') {
                    // Should not happen after the check above, but guard defensively.
                    blockedOrgs.push(m.organizationId);
                    continue;
                }
                removalFailures.push({
                    organizationId: m.organizationId,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }

        if (blockedOrgs.length > 0) {
            return errorResponse(`Cannot delete account: sole owner of ${blockedOrgs.join(', ')}.`, 409, {
                code: 'LAST_ACTIVE_OWNER_GUARD',
                details: { organizations: blockedOrgs } as any,
            });
        }

        if (removalFailures.length > 0) {
            console.error('Account delete: failed to remove memberships', removalFailures);
            return errorResponse('Failed to detach account from all organizations', 500, {
                code: 'MEMBERSHIP_REMOVAL_FAILED',
                details: { failures: removalFailures } as any,
            });
        }

        // Delete RBAC assignments not tied to any org scope.
        const extraRoles = await UserRole.where({ userId });
        await Promise.all(extraRoles.map((r) => r.destroy()));

        // Delete OAuth / provider accounts.
        const oauthAccounts = await Account.where({ userId });
        await Promise.all(oauthAccounts.map((a) => a.destroy()));

        // Delete active sessions.
        const sessions = await Session.where({ userId });
        await Promise.all(sessions.map((s) => s.destroy()));

        // Delete verification tokens (best-effort; identifier = `verify:email` / `reset:email`).
        const userEmail = String(user.get('email') ?? '');
        if (userEmail) {
            const identifiers = [`verify:${userEmail}`, `reset:${userEmail}`];
            for (const identifier of identifiers) {
                try {
                    const tokens = await VerificationToken.where({ identifier });
                    await Promise.all(tokens.map((t) => t.destroy()));
                } catch {
                    // Non-fatal: tokens will expire naturally.
                }
            }
        }

        // Finally delete the user record.
        await user.destroy();

        // Revoke any outstanding KV session tokens.
        if (env.OBCF_KV) {
            try {
                const revokedAt = Math.floor(Date.now() / 1000);
                await env.OBCF_KV.put(userKey('auth', userId, 'revoked'), String(revokedAt), {
                    expirationTtl: Number(env.AUTH_SESSION_MAX_AGE) || 30 * 24 * 60 * 60,
                });
            } catch {
                // Non-fatal — the user record is gone.
            }
        }

        return jsonResponse({ success: true });
    } catch (error) {
        return errorResponse('Failed to delete account', 500, {
            code: 'DELETE_FAILED',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
}

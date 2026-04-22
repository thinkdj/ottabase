import { getSession } from '@ottabase/auth/backend';
import { MembershipError, Organization, OrganizationInvite, OrganizationMember } from '@ottabase/ottaorm/models';
import { getRBACCache } from '@ottabase/rbac';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { CloudflareEnv } from '../../cloudflare-env';
import { getAuthOptions } from '../lib/auth-utils';
import { initDbConnection } from '../lib/db-utils';
import { hashOrgInviteToken } from '../lib/org-invite-token';
import { normalizeEmail } from '../lib/utils';
import type { ApiRouteContext } from './router';

function maskEmail(email: string): string {
    if (typeof email !== 'string' || !email) return '***';
    const atIdx = email.indexOf('@');
    if (atIdx <= 0 || atIdx === email.length - 1) return '***';
    const local = email.slice(0, atIdx);
    const domain = email.slice(atIdx + 1);
    if (!domain.includes('.')) return '***';
    if (local.length <= 2) return `***@${domain}`;
    return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

async function resolveInviteByToken(rawToken: string) {
    const tokenHash = await hashOrgInviteToken(rawToken.trim());
    return OrganizationInvite.findByTokenHash(tokenHash);
}

export async function handlePublicOrgInvitePreview(context: ApiRouteContext): Promise<Response> {
    const { env } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 not configured', 500, { code: 'CONFIG_ERROR' });
    }
    initDbConnection(env);

    const match = context.route.match(/^\/api\/public\/org-invites\/([^/]+)$/);
    const rawToken = match ? decodeURIComponent(match[1]) : '';
    if (!rawToken || rawToken.length < 16) {
        return errorResponse('Invalid token', 400, { code: 'BAD_REQUEST' });
    }

    try {
        await OrganizationInvite.expirePendingPast();
        const invite = await resolveInviteByToken(rawToken);
        if (!invite) {
            return errorResponse('Invitation not found', 404, { code: 'INVITE_NOT_FOUND' });
        }

        if (invite.status !== 'pending') {
            const org = await Organization.find(invite.organizationId);
            return jsonResponse({
                data: {
                    status: invite.status,
                    organizationName: org ? String(org.get('name') ?? '') : null,
                    organizationId: invite.organizationId,
                    emailMasked: maskEmail(invite.email),
                    expiresAt: invite.expiresAt,
                    role: invite.role,
                },
            });
        }

        if (invite.expiresAt < Date.now()) {
            await OrganizationInvite.updateById(invite.id, { status: 'expired' });
            return jsonResponse({
                data: {
                    status: 'expired',
                    organizationName: null,
                    emailMasked: maskEmail(invite.email),
                    expiresAt: invite.expiresAt,
                    role: invite.role,
                },
            });
        }

        const org = await Organization.find(invite.organizationId);
        return jsonResponse({
            data: {
                status: 'pending',
                organizationName: org ? String(org.get('name') ?? '') : '',
                organizationId: invite.organizationId,
                emailMasked: maskEmail(invite.email),
                expiresAt: invite.expiresAt,
                role: invite.role,
            },
        });
    } catch (err) {
        return errorResponse('Failed to load invitation', 500, {
            code: 'ORG_INVITE_PREVIEW_FAILED',
            details: err instanceof Error ? err.message : 'Unknown error',
        });
    }
}

export async function handlePublicOrgInviteDecline(context: ApiRouteContext): Promise<Response> {
    const { env } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 not configured', 500, { code: 'CONFIG_ERROR' });
    }
    initDbConnection(env);

    const match = context.route.match(/^\/api\/public\/org-invites\/([^/]+)\/decline$/);
    const rawToken = match ? decodeURIComponent(match[1]) : '';
    if (!rawToken || rawToken.length < 16) {
        return errorResponse('Invalid token', 400, { code: 'BAD_REQUEST' });
    }

    try {
        const invite = await resolveInviteByToken(rawToken);
        if (!invite) {
            return errorResponse('Invitation not found', 404, { code: 'INVITE_NOT_FOUND' });
        }
        if (invite.status !== 'pending') {
            return jsonResponse({ data: { declined: false, reason: 'not_pending' } });
        }
        if (invite.expiresAt < Date.now()) {
            await OrganizationInvite.updateById(invite.id, { status: 'expired' });
            return errorResponse('Invitation expired', 410, { code: 'INVITE_EXPIRED' });
        }

        await OrganizationInvite.updateById(invite.id, {
            status: 'declined',
            declinedAt: Date.now(),
        });
        return jsonResponse({ data: { declined: true } });
    } catch (err) {
        return errorResponse('Failed to decline invitation', 500, {
            code: 'ORG_INVITE_DECLINE_FAILED',
            details: err instanceof Error ? err.message : 'Unknown error',
        });
    }
}

export async function handlePublicOrgInviteAccept(context: ApiRouteContext): Promise<Response> {
    const { env, request } = context;
    if (!env.OBCF_D1) {
        return errorResponse('D1 not configured', 500, { code: 'CONFIG_ERROR' });
    }
    initDbConnection(env);

    const match = context.route.match(/^\/api\/public\/org-invites\/([^/]+)\/accept$/);
    const rawToken = match ? decodeURIComponent(match[1]) : '';
    if (!rawToken || rawToken.length < 16) {
        return errorResponse('Invalid token', 400, { code: 'BAD_REQUEST' });
    }

    const session = await getSession(request, env as CloudflareEnv, getAuthOptions(env));
    const sessionUser = session?.user;
    if (!sessionUser?.id || !sessionUser.email) {
        return errorResponse('Sign in required to accept this invitation', 401, {
            code: 'AUTH_REQUIRED',
            hint: 'Log in with the same email address the invitation was sent to.',
        });
    }

    const sessionEmail = normalizeEmail(String(sessionUser.email));
    if (!sessionEmail) {
        return errorResponse('Invalid session', 401, { code: 'AUTH_INVALID' });
    }

    try {
        const invite = await resolveInviteByToken(rawToken);
        if (!invite) {
            return errorResponse('Invitation not found', 404, { code: 'INVITE_NOT_FOUND' });
        }
        if (invite.status !== 'pending') {
            return errorResponse('Invitation is no longer valid', 409, { code: 'INVITE_NOT_PENDING' });
        }
        if (invite.expiresAt < Date.now()) {
            await OrganizationInvite.updateById(invite.id, { status: 'expired' });
            return errorResponse('Invitation expired', 410, { code: 'INVITE_EXPIRED' });
        }

        const inviteEmail = normalizeEmail(invite.email);
        if (sessionEmail !== inviteEmail) {
            return errorResponse(
                `Sign in as ${maskEmail(inviteEmail)} to accept this invitation. You are signed in as ${maskEmail(sessionEmail)}.`,
                403,
                { code: 'EMAIL_MISMATCH' },
            );
        }

        const userId = String(sessionUser.id);
        const existingMember = await OrganizationMember.first({ userId, organizationId: invite.organizationId });
        if (existingMember) {
            await OrganizationInvite.updateById(invite.id, {
                status: 'accepted',
                acceptedAt: Date.now(),
            });
            return jsonResponse({ data: { accepted: true, alreadyMember: true } });
        }

        // Defense-in-depth: validate the stored role before materializing a
        // membership. Invite creation already validates, but a stale or
        // tampered row shouldn't be able to promote a user silently.
        const ALLOWED_INVITE_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
        type AllowedInviteRole = (typeof ALLOWED_INVITE_ROLES)[number];
        if (!ALLOWED_INVITE_ROLES.includes(invite.role as AllowedInviteRole)) {
            return errorResponse('Invitation has an invalid role and cannot be accepted', 409, {
                code: 'INVITE_INVALID_ROLE',
            });
        }

        try {
            await OrganizationMember.addMember({
                userId,
                organizationId: invite.organizationId,
                role: invite.role as AllowedInviteRole,
                status: 'active',
                joinedAt: Date.now(),
                invitedBy: invite.invitedBy ?? null,
                invitedAt: invite.invitedAt,
                cache: getRBACCache(),
            });
        } catch (addErr) {
            // A concurrent request (e.g. double-click) may have inserted the member
            // between our existence check and the addMember call.  Treat that as an
            // idempotent success rather than a 500.
            if (addErr instanceof MembershipError && addErr.code === 'MEMBER_ALREADY_EXISTS') {
                await OrganizationInvite.updateById(invite.id, { status: 'accepted', acceptedAt: Date.now() });
                return jsonResponse({ data: { accepted: true, alreadyMember: true } });
            }
            throw addErr;
        }

        await OrganizationInvite.updateById(invite.id, {
            status: 'accepted',
            acceptedAt: Date.now(),
        });

        return jsonResponse({ data: { accepted: true, organizationId: invite.organizationId } });
    } catch (err) {
        return errorResponse('Failed to accept invitation', 500, {
            code: 'ORG_INVITE_ACCEPT_FAILED',
            details: err instanceof Error ? err.message : 'Unknown error',
        });
    }
}

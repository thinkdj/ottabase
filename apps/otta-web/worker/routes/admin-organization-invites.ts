import { sendTemplatedEmail } from '@ottabase/email';
import { Organization, OrganizationInvite, OrganizationMember, User } from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { isEmail } from '@ottabase/utils/string';
import { buildOrgInviteEmail } from '../../src/email/org-invite';
import { registerAppEmailTemplates } from '../../src/email/templates';
import { requireAdminAccess } from '../lib/admin-guard';
import { resolveMailer } from '../lib/auth-utils';
import { auditOrganizationAction } from '../lib/org-audit';
import { generateOrgInviteRawToken, hashOrgInviteToken } from '../lib/org-invite-token';
import { canAccessOrganization, resolveCurrentOrgForAdmin } from '../lib/organization-admin';
import { normalizeEmail } from '../lib/utils';
import type { ApiRouteContext } from './router';

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function sameOrgAccess(auth: Awaited<ReturnType<typeof requireAdminAccess>>, organizationId: string): boolean {
    if (auth instanceof Response) return false;
    return canAccessOrganization(auth, organizationId);
}

function inviteBaseUrl(request: Request): string {
    return new URL(request.url).origin;
}

async function sendInviteEmail(
    env: ApiRouteContext['env'],
    request: Request,
    opts: {
        to: string;
        organizationName: string;
        inviterName: string;
        role: string;
        acceptPath: string;
    },
): Promise<{ ok: boolean; error?: string }> {
    registerAppEmailTemplates();
    const { mailer, from } = await resolveMailer(env);
    if (!mailer || !from) {
        return { ok: false, error: 'No email provider configured' };
    }

    const payload = buildOrgInviteEmail({
        organizationName: opts.organizationName,
        inviterName: opts.inviterName,
        role: opts.role,
        acceptUrl: `${inviteBaseUrl(request)}${opts.acceptPath}`,
        expiresAt: Date.now() + INVITE_TTL_MS,
    });

    try {
        await sendTemplatedEmail(mailer, {
            from,
            to: opts.to,
            ...payload,
        });
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : 'send failed' };
    }
}

export async function handleAdminOrganizationInvitesList(
    context: ApiRouteContext,
    organizationId: string,
): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'either' });
    if (auth instanceof Response) return auth;
    if (!sameOrgAccess(auth, organizationId)) {
        return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
    }

    try {
        await OrganizationInvite.expirePendingPast(organizationId);
        const rows = await OrganizationInvite.listForOrganization(organizationId, { includeNonPending: false });
        return jsonResponse({
            data: rows.map((r) => ({
                id: r.id,
                organizationId: r.organizationId,
                email: r.email,
                role: r.role,
                status: r.status,
                invitedAt: r.invitedAt,
                expiresAt: r.expiresAt,
                invitedBy: r.invitedBy,
            })),
        });
    } catch (err) {
        return errorResponse('Failed to list invites', 500, {
            code: 'ORG_INVITES_LIST_FAILED',
            details: err instanceof Error ? err.message : 'Unknown error',
        });
    }
}

interface CreateInviteBody {
    email?: string;
    role?: 'owner' | 'admin' | 'member';
}

export async function handleAdminOrganizationInviteCreate(
    context: ApiRouteContext,
    organizationId: string,
): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'either' });
    if (auth instanceof Response) return auth;
    if (!sameOrgAccess(auth, organizationId)) {
        return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
    }

    let body: CreateInviteBody;
    try {
        body = (await context.request.json()) as CreateInviteBody;
    } catch {
        return errorResponse('Invalid JSON body', 400, { code: 'BAD_REQUEST' });
    }

    const email = normalizeEmail(body.email?.trim() ?? '');
    const role = body.role ?? 'member';

    if (!email || !isEmail(email)) {
        return errorResponse('Valid email is required', 400, {
            code: 'VALIDATION_ERROR',
            fieldErrors: { email: ['Valid email is required'] },
        });
    }

    if (role !== 'owner' && role !== 'admin' && role !== 'member') {
        return errorResponse('Invalid role', 400, {
            code: 'VALIDATION_ERROR',
            fieldErrors: { role: ['Invalid role'] },
        });
    }

    const org = await Organization.find(organizationId);
    if (!org) {
        return errorResponse('Organization not found', 404, { code: 'NOT_FOUND' });
    }

    const existingUser = await User.first({ email });
    if (existingUser) {
        const member = await OrganizationMember.first({ userId: existingUser.get('id') as string, organizationId });
        if (member) {
            return errorResponse('User is already a member of this organization', 409, {
                code: 'MEMBER_ALREADY_EXISTS',
            });
        }
    }

    const rawToken = generateOrgInviteRawToken();
    const tokenHash = await hashOrgInviteToken(rawToken);
    const now = Date.now();

    const row = await OrganizationInvite.insertInvite({
        organizationId,
        email,
        role,
        tokenHash,
        status: 'pending',
        invitedBy: auth.user?.id ?? null,
        invitedAt: now,
        expiresAt: now + INVITE_TTL_MS,
        metadata: {},
    });

    const inviterName =
        (typeof auth.user?.name === 'string' && auth.user.name.trim()) ||
        (typeof auth.user?.email === 'string' && auth.user.email) ||
        'An administrator';

    const send = await sendInviteEmail(context.env, context.request, {
        to: email,
        organizationName: String(org.get('name') ?? 'Organization'),
        inviterName,
        role,
        acceptPath: `/invite/${encodeURIComponent(rawToken)}`,
    });

    if (!send.ok) {
        try {
            await OrganizationInvite.deleteById(row.id);
        } catch {
            await OrganizationInvite.updateById(row.id, { status: 'revoked', revokedAt: Date.now() });
        }
        return errorResponse(send.error || 'Failed to send invite email', 500, { code: 'ORG_INVITE_EMAIL_FAILED' });
    }

    await OrganizationInvite.revokePendingForEmailExcept(organizationId, email, row.id);

    await auditOrganizationAction(context.request, {
        userId: auth.user?.id,
        userEmail: auth.user?.email ?? null,
        organizationId,
        action: 'invite',
        resourceType: 'organization_invite',
        resourceId: row.id,
        metadata: { email, role },
    });

    return jsonResponse(
        {
            data: {
                id: row.id,
                organizationId: row.organizationId,
                email: row.email,
                role: row.role,
                status: row.status,
                expiresAt: row.expiresAt,
            },
        },
        201,
    );
}

export async function handleAdminOrganizationInviteRevoke(
    context: ApiRouteContext,
    organizationId: string,
    inviteId: string,
): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'either' });
    if (auth instanceof Response) return auth;
    if (!sameOrgAccess(auth, organizationId)) {
        return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
    }

    const list = await OrganizationInvite.listForOrganization(organizationId, { includeNonPending: true });
    const invite = list.find((r) => r.id === inviteId);
    if (!invite || invite.organizationId !== organizationId) {
        return errorResponse('Invite not found', 404, { code: 'NOT_FOUND' });
    }
    if (invite.status !== 'pending') {
        return errorResponse('Invite is not pending', 409, { code: 'INVITE_NOT_PENDING' });
    }

    const updated = await OrganizationInvite.updateById(inviteId, {
        status: 'revoked',
        revokedAt: Date.now(),
    });
    if (!updated) {
        return errorResponse('Failed to revoke invite', 500, { code: 'ORG_INVITE_REVOKE_FAILED' });
    }

    await auditOrganizationAction(context.request, {
        userId: auth.user?.id,
        userEmail: auth.user?.email ?? null,
        organizationId,
        action: 'revoke',
        resourceType: 'organization_invite',
        resourceId: inviteId,
        metadata: { email: invite.email },
    });

    return jsonResponse({ data: updated });
}

export async function handleAdminOrganizationInviteResend(
    context: ApiRouteContext,
    organizationId: string,
    inviteId: string,
): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'either' });
    if (auth instanceof Response) return auth;
    if (!sameOrgAccess(auth, organizationId)) {
        return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
    }

    const list = await OrganizationInvite.listForOrganization(organizationId, { includeNonPending: true });
    const invite = list.find((r) => r.id === inviteId);
    if (!invite || invite.organizationId !== organizationId) {
        return errorResponse('Invite not found', 404, { code: 'NOT_FOUND' });
    }
    if (invite.status !== 'pending') {
        return errorResponse('Invite is not pending', 409, { code: 'INVITE_NOT_PENDING' });
    }

    const now = Date.now();
    if (invite.expiresAt < now) {
        return errorResponse('Invite has expired; create a new invite', 409, { code: 'INVITE_EXPIRED' });
    }

    const org = await Organization.find(organizationId);
    if (!org) {
        return errorResponse('Organization not found', 404, { code: 'NOT_FOUND' });
    }

    const previousTokenHash = invite.tokenHash;
    const previousInvitedAt = invite.invitedAt;
    const previousExpiresAt = invite.expiresAt;
    const previousMetadata = invite.metadata;

    const rawToken = generateOrgInviteRawToken();
    const tokenHash = await hashOrgInviteToken(rawToken);

    const updated = await OrganizationInvite.updateById(inviteId, {
        tokenHash,
        invitedAt: now,
        expiresAt: now + INVITE_TTL_MS,
        metadata: { ...(invite.metadata || {}), resentAt: now },
    });
    if (!updated) {
        return errorResponse('Failed to update invite', 500, { code: 'ORG_INVITE_RESEND_FAILED' });
    }

    const inviterName =
        (typeof auth.user?.name === 'string' && auth.user.name.trim()) ||
        (typeof auth.user?.email === 'string' && auth.user.email) ||
        'An administrator';

    const send = await sendInviteEmail(context.env, context.request, {
        to: invite.email,
        organizationName: String(org.get('name') ?? 'Organization'),
        inviterName,
        role: invite.role,
        acceptPath: `/invite/${encodeURIComponent(rawToken)}`,
    });

    if (!send.ok) {
        await OrganizationInvite.updateById(inviteId, {
            tokenHash: previousTokenHash,
            invitedAt: previousInvitedAt,
            expiresAt: previousExpiresAt,
            metadata: previousMetadata,
        });
        return errorResponse(send.error || 'Failed to send email', 500, { code: 'ORG_INVITE_EMAIL_FAILED' });
    }

    await auditOrganizationAction(context.request, {
        userId: auth.user?.id,
        userEmail: auth.user?.email ?? null,
        organizationId,
        action: 'invite_resend',
        resourceType: 'organization_invite',
        resourceId: inviteId,
        metadata: { email: invite.email },
    });

    return jsonResponse({ data: { id: inviteId, resent: true } });
}

export async function handleCurrentOrganizationInvitesList(context: ApiRouteContext): Promise<Response> {
    const organizationId = await resolveCurrentOrgForAdmin(context);
    if (organizationId instanceof Response) return organizationId;
    return handleAdminOrganizationInvitesList(context, organizationId);
}

export async function handleCurrentOrganizationInviteCreate(context: ApiRouteContext): Promise<Response> {
    const organizationId = await resolveCurrentOrgForAdmin(context);
    if (organizationId instanceof Response) return organizationId;
    return handleAdminOrganizationInviteCreate(context, organizationId);
}

export async function handleCurrentOrganizationInviteRevoke(
    context: ApiRouteContext,
    inviteId: string,
): Promise<Response> {
    const organizationId = await resolveCurrentOrgForAdmin(context);
    if (organizationId instanceof Response) return organizationId;
    return handleAdminOrganizationInviteRevoke(context, organizationId, inviteId);
}

export async function handleCurrentOrganizationInviteResend(
    context: ApiRouteContext,
    inviteId: string,
): Promise<Response> {
    const organizationId = await resolveCurrentOrgForAdmin(context);
    if (organizationId instanceof Response) return organizationId;
    return handleAdminOrganizationInviteResend(context, organizationId, inviteId);
}

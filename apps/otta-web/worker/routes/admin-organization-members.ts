import { Organization, OrganizationMember, User } from '@ottabase/ottaorm/models';
import { sendTemplatedEmail } from '@ottabase/email';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { paginatedJsonResponse, parsePaginationParams } from '@ottabase/utils/pagination';
import { isEmail } from '@ottabase/utils/string';
import { requireAdminAccess, SYSTEM_ORGANIZATION_ID } from '../lib/admin-guard';
import { bumpProfileVersion, invalidateMembershipCache, resolveMailer } from '../lib/auth-utils';
import { normalizeEmail } from '../lib/utils';
import { registerAppEmailTemplates } from '../../src/email/templates';
import type { ApiRouteContext } from './router';

interface InviteMemberRequestBody {
    userId?: string;
    email?: string;
    role?: 'owner' | 'admin' | 'member';
    status?: 'active' | 'invited' | 'suspended';
}

interface UpdateMemberRequestBody {
    role?: 'owner' | 'admin' | 'member';
    status?: 'active' | 'invited' | 'suspended';
}

function isValidRole(role: unknown): role is 'owner' | 'admin' | 'member' {
    return role === 'owner' || role === 'admin' || role === 'member';
}

function isValidStatus(status: unknown): status is 'active' | 'invited' | 'suspended' {
    return status === 'active' || status === 'invited' || status === 'suspended';
}

function updateMovesAwayFromActiveOwnerState(body: UpdateMemberRequestBody): boolean {
    return (
        (body.role !== undefined && body.role !== 'owner') || (body.status !== undefined && body.status !== 'active')
    );
}

export async function handleAdminOrganizationMembersList(
    context: ApiRouteContext,
    organizationId: string,
): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'either' });
    if (auth instanceof Response) return auth;

    if (
        auth.organizationId !== SYSTEM_ORGANIZATION_ID &&
        auth.organizationId !== organizationId &&
        auth.rbac.organizationId !== organizationId
    ) {
        return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
    }

    const url = new URL(context.request.url);
    const { page, perPage } = parsePaginationParams(url.searchParams, {
        defaults: { perPage: 25, orderBy: 'joinedAt', order: 'desc' },
    });
    const offset = (page - 1) * perPage;

    try {
        const [total, members] = await Promise.all([
            OrganizationMember.countOrganizationMembers(organizationId),
            OrganizationMember.getOrganizationMembers(organizationId, { limit: perPage, offset }),
        ]);

        return paginatedJsonResponse({
            data: members.map((member) => ({
                id: `${member.userId}-${member.organizationId}`,
                ...member,
            })),
            total,
            page,
            perPage,
            path: `/api/admin/organizations/${organizationId}/members`,
        });
    } catch (err) {
        return errorResponse('Failed to load organization members', 500, {
            code: 'ORG_MEMBER_LIST_FAILED',
            details: err instanceof Error ? err.message : 'Unknown error',
        });
    }
}

/**
 * Best-effort notification email for a new org invite. Failure to send must never block the
 * invite itself — the membership row is the source of truth, the email is just a nudge.
 */
async function sendOrgInviteEmail(
    context: ApiRouteContext,
    params: { toEmail: string; organizationId: string; alreadyHasAccount: boolean },
): Promise<void> {
    try {
        const { mailer, from } = await resolveMailer(context.env);
        if (!mailer) return;

        const organization = await Organization.find(params.organizationId);
        const orgName = organization?.get('name') ?? 'the organization';

        registerAppEmailTemplates();

        const destinationUrl = new URL(context.env.AUTH_URL || context.request.url);
        destinationUrl.pathname = params.alreadyHasAccount ? '/login' : '/register';
        destinationUrl.searchParams.set('email', params.toEmail);

        await sendTemplatedEmail(mailer, {
            from,
            to: params.toEmail,
            template: 'minimalist',
            subject: `You've been invited to join ${orgName}`,
            variables: {
                subject: `You've been invited to join ${orgName}`,
                header: `Join ${orgName}`,
                body: params.alreadyHasAccount
                    ? `<p>You've been added to <strong>${orgName}</strong>. Sign in to get started.</p>
<p><a href="${destinationUrl.toString()}">Sign in</a></p>`
                    : `<p>You've been invited to join <strong>${orgName}</strong>. Create an account with this email address to accept.</p>
<p><a href="${destinationUrl.toString()}">Create your account</a></p>`,
                footer: '',
            },
        });
    } catch (error) {
        console.warn('Failed to send organization invite email:', error);
    }
}

export async function handleAdminOrganizationInviteMember(
    context: ApiRouteContext,
    organizationId: string,
): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'either' });
    if (auth instanceof Response) return auth;

    if (
        auth.organizationId !== SYSTEM_ORGANIZATION_ID &&
        auth.organizationId !== organizationId &&
        auth.rbac.organizationId !== organizationId
    ) {
        return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
    }

    let body: InviteMemberRequestBody;
    try {
        body = (await context.request.json()) as InviteMemberRequestBody;
    } catch {
        return errorResponse('Invalid JSON body', 400, { code: 'BAD_REQUEST' });
    }

    const userId = body.userId?.trim();
    const email = typeof body.email === 'string' ? normalizeEmail(body.email) : undefined;
    const role = body.role ?? 'member';

    if (!userId && !email) {
        return errorResponse('A user or email is required', 400, {
            code: 'VALIDATION_ERROR',
            fieldErrors: { userId: ['Provide a user ID or an email address'] },
        });
    }

    if (email && !isEmail(email)) {
        return errorResponse('Invalid email address', 400, {
            code: 'VALIDATION_ERROR',
            fieldErrors: { email: ['Invalid email address'] },
        });
    }

    if (!isValidRole(role) || (body.status !== undefined && !isValidStatus(body.status))) {
        return errorResponse('Invalid invite payload', 400, {
            code: 'VALIDATION_ERROR',
            fieldErrors: {
                ...(isValidRole(role) ? {} : { role: ['Invalid role'] }),
                ...(body.status === undefined || isValidStatus(body.status) ? {} : { status: ['Invalid status'] }),
            },
        });
    }

    // Resolve to an existing user account either by explicit userId or by matching email.
    const user = userId ? await User.find(userId) : email ? await User.findByEmail(email) : undefined;
    if (userId && !user) {
        return errorResponse('User not found', 404, {
            code: 'USER_NOT_FOUND',
            fieldErrors: { userId: ['User not found'] },
        });
    }

    const resolvedUserId = user?.get('id') as string | undefined;
    const resolvedEmail = email ?? (user?.get('email') as string | undefined);

    const existingMember = await OrganizationMember.findExistingInvite({
        organizationId,
        userId: resolvedUserId ?? null,
        invitedEmail: resolvedUserId ? null : (resolvedEmail ?? null),
    });
    if (existingMember) {
        return errorResponse('This user is already a member or has a pending invite', 409, {
            code: 'MEMBER_ALREADY_EXISTS',
            fieldErrors: { userId: ['Already a member or invited'], email: ['Already a member or invited'] },
        });
    }

    const status = body.status ?? (resolvedUserId ? 'active' : 'invited');
    if (!isValidStatus(status)) {
        return errorResponse('Invalid status', 400, {
            code: 'VALIDATION_ERROR',
            fieldErrors: { status: ['Invalid status'] },
        });
    }

    try {
        const member = await OrganizationMember.create({
            userId: resolvedUserId ?? null,
            invitedEmail: resolvedUserId ? null : resolvedEmail,
            organizationId,
            role,
            status,
            invitedBy: auth.user?.id ?? null,
            invitedAt: Date.now(),
        } as any);

        if (resolvedUserId) {
            // Membership granted — drop the user's cached security-context lookups.
            await invalidateMembershipCache(context.env.OBCF_KV, resolvedUserId);
            // Membership change alters the user's active org (and thus org-scoped roles/permissions) —
            // refresh their live session so it isn't served the stale snapshot until the JWT expires.
            await bumpProfileVersion(context.env, resolvedUserId);
        }

        if (resolvedEmail) {
            await sendOrgInviteEmail(context, {
                toEmail: resolvedEmail,
                organizationId,
                alreadyHasAccount: !!resolvedUserId,
            });
        }

        return jsonResponse({ data: member.toJson() }, 201);
    } catch (err) {
        return errorResponse('Failed to invite member', 500, {
            code: 'ORG_MEMBER_INVITE_FAILED',
            details: err instanceof Error ? err.message : 'Unknown error',
        });
    }
}

export async function handleAdminOrganizationUpdateMember(
    context: ApiRouteContext,
    organizationId: string,
    userId: string,
): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'either' });
    if (auth instanceof Response) return auth;

    if (
        auth.organizationId !== SYSTEM_ORGANIZATION_ID &&
        auth.organizationId !== organizationId &&
        auth.rbac.organizationId !== organizationId
    ) {
        return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
    }

    let body: UpdateMemberRequestBody;
    try {
        body = (await context.request.json()) as UpdateMemberRequestBody;
    } catch {
        return errorResponse('Invalid JSON body', 400, { code: 'BAD_REQUEST' });
    }

    if (body.role === undefined && body.status === undefined) {
        return errorResponse('Nothing to update', 400, {
            code: 'VALIDATION_ERROR',
            fieldErrors: {
                role: ['Provide role and/or status'],
                status: ['Provide role and/or status'],
            },
        });
    }

    if (
        (body.role !== undefined && !isValidRole(body.role)) ||
        (body.status !== undefined && !isValidStatus(body.status))
    ) {
        return errorResponse('Invalid update payload', 400, {
            code: 'VALIDATION_ERROR',
            fieldErrors: {
                ...(body.role !== undefined && !isValidRole(body.role) ? { role: ['Invalid role'] } : {}),
                ...(body.status !== undefined && !isValidStatus(body.status) ? { status: ['Invalid status'] } : {}),
            },
        });
    }

    const existingMember = await OrganizationMember.first({ userId, organizationId });
    if (!existingMember) {
        return errorResponse('Member not found', 404, { code: 'MEMBER_NOT_FOUND' });
    }

    if (updateMovesAwayFromActiveOwnerState(body)) {
        const isLastActiveOwner = await OrganizationMember.isLastActiveOwner(userId, organizationId);
        if (isLastActiveOwner) {
            return errorResponse('Cannot change role or status for the last active owner', 409, {
                code: 'LAST_ACTIVE_OWNER_GUARD',
            });
        }
    }

    try {
        if (body.role !== undefined) {
            await OrganizationMember.updateRole(userId, organizationId, body.role);
        }
        if (body.status !== undefined) {
            await OrganizationMember.updateStatus(userId, organizationId, body.status);
        }

        // Role/status changed (incl. suspension) — revocation must not wait out the
        // membership-cache TTL.
        await invalidateMembershipCache(context.env.OBCF_KV, userId);
        // Membership change alters the user's active org (and thus org-scoped roles/permissions) —
        // refresh their live session so it isn't served the stale snapshot until the JWT expires.
        await bumpProfileVersion(context.env, userId);

        const updated = await OrganizationMember.first({ userId, organizationId });
        return jsonResponse({ data: updated?.toJson() ?? existingMember.toJson() });
    } catch (err) {
        return errorResponse('Failed to update member', 500, {
            code: 'ORG_MEMBER_UPDATE_FAILED',
            details: err instanceof Error ? err.message : 'Unknown error',
        });
    }
}

export async function handleAdminOrganizationRemoveMember(
    context: ApiRouteContext,
    organizationId: string,
    userId: string,
): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'either' });
    if (auth instanceof Response) return auth;

    if (
        auth.organizationId !== SYSTEM_ORGANIZATION_ID &&
        auth.organizationId !== organizationId &&
        auth.rbac.organizationId !== organizationId
    ) {
        return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
    }

    const existingMember = await OrganizationMember.first({ userId, organizationId });
    if (!existingMember) {
        return errorResponse('Member not found', 404, { code: 'MEMBER_NOT_FOUND' });
    }

    const isLastActiveOwner = await OrganizationMember.isLastActiveOwner(userId, organizationId);
    if (isLastActiveOwner) {
        return errorResponse('Cannot remove the last active owner from this organization', 409, {
            code: 'LAST_ACTIVE_OWNER_GUARD',
        });
    }

    try {
        const removed = await OrganizationMember.removeMember(userId, organizationId);
        if (!removed) {
            return errorResponse('Failed to remove member', 500, {
                code: 'ORG_MEMBER_REMOVE_FAILED',
            });
        }

        // Membership revoked — drop the cached lookups so access ends now, not at TTL expiry.
        await invalidateMembershipCache(context.env.OBCF_KV, userId);
        // Membership change alters the user's active org (and thus org-scoped roles/permissions) —
        // refresh their live session so it isn't served the stale snapshot until the JWT expires.
        await bumpProfileVersion(context.env, userId);

        return jsonResponse({ data: { userId, organizationId, removed: true } });
    } catch (err) {
        return errorResponse('Failed to remove member', 500, {
            code: 'ORG_MEMBER_REMOVE_FAILED',
            details: err instanceof Error ? err.message : 'Unknown error',
        });
    }
}

import { MembershipError, Organization, OrganizationMember, User } from '@ottabase/ottaorm/models';
import { getRBACCache } from '@ottabase/rbac';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { paginatedJsonResponse, parsePaginationParams } from '@ottabase/utils/pagination';
import { canAccessOrganization, requireAdminAccess, resolveCurrentOrgForAdmin } from '../lib/admin-guard';
import { sendMemberAddedEmail, sendMemberRemovedEmail } from '../lib/member-emails';
import { auditOrganizationAction } from '../lib/org-audit';
import type { ApiRouteContext } from './router';

interface InviteMemberRequestBody {
    userId?: string;
    role?: 'owner' | 'admin' | 'member' | 'viewer';
    status?: 'active' | 'invited' | 'suspended';
}

interface UpdateMemberRequestBody {
    role?: 'owner' | 'admin' | 'member' | 'viewer';
    status?: 'active' | 'invited' | 'suspended';
}

function isValidRole(role: unknown): role is 'owner' | 'admin' | 'member' | 'viewer' {
    return role === 'owner' || role === 'admin' || role === 'member' || role === 'viewer';
}

function isValidStatus(status: unknown): status is 'active' | 'invited' | 'suspended' {
    return status === 'active' || status === 'invited' || status === 'suspended';
}

function membershipErrorToResponse(err: unknown): Response | null {
    if (err instanceof MembershipError && err.code === 'LAST_ACTIVE_OWNER_GUARD') {
        return errorResponse('Cannot change or remove the last active owner', 409, {
            code: 'LAST_ACTIVE_OWNER_GUARD',
        });
    }
    if (err instanceof MembershipError && err.code === 'MEMBER_ALREADY_EXISTS') {
        return errorResponse('User is already a member of this organization', 409, {
            code: 'MEMBER_ALREADY_EXISTS',
        });
    }
    return null;
}

export async function handleAdminOrganizationMembersList(
    context: ApiRouteContext,
    organizationId: string,
): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'either' });
    if (auth instanceof Response) return auth;

    if (!canAccessOrganization(auth, organizationId)) {
        return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
    }

    const url = new URL(context.request.url);
    const { page, perPage } = parsePaginationParams(url.searchParams, {
        defaults: { perPage: 25, orderBy: 'joinedAt', order: 'desc' },
    });
    const offset = (page - 1) * perPage;

    try {
        const [total, members, activeOwnerCount] = await Promise.all([
            OrganizationMember.countOrganizationMembers(organizationId),
            OrganizationMember.getOrganizationMembers(organizationId, { limit: perPage, offset }),
            OrganizationMember.countActiveOwners(organizationId),
        ]);

        return paginatedJsonResponse({
            data: members.map((member) => ({
                id: `${member.userId}-${member.organizationId}`,
                ...member,
                isLastActiveOwner: member.role === 'owner' && member.status === 'active' && activeOwnerCount <= 1,
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

export async function handleAdminOrganizationInviteMember(
    context: ApiRouteContext,
    organizationId: string,
): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'either' });
    if (auth instanceof Response) return auth;

    if (!canAccessOrganization(auth, organizationId)) {
        return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
    }

    let body: InviteMemberRequestBody;
    try {
        body = (await context.request.json()) as InviteMemberRequestBody;
    } catch {
        return errorResponse('Invalid JSON body', 400, { code: 'BAD_REQUEST' });
    }

    const userId = body.userId?.trim();
    const role = body.role ?? 'member';
    const status = body.status ?? 'invited';

    if (!userId) {
        return errorResponse('User is required', 400, {
            code: 'VALIDATION_ERROR',
            fieldErrors: { userId: ['User is required'] },
        });
    }

    if (!isValidRole(role) || !isValidStatus(status)) {
        return errorResponse('Invalid invite payload', 400, {
            code: 'VALIDATION_ERROR',
            fieldErrors: {
                ...(isValidRole(role) ? {} : { role: ['Invalid role'] }),
                ...(isValidStatus(status) ? {} : { status: ['Invalid status'] }),
            },
        });
    }

    const user = await User.find(userId);
    if (!user) {
        return errorResponse('User not found', 404, {
            code: 'USER_NOT_FOUND',
            fieldErrors: { userId: ['User not found'] },
        });
    }

    const existingMember = await OrganizationMember.first({ userId, organizationId });
    if (existingMember) {
        return errorResponse('User is already a member of this organization', 409, {
            code: 'MEMBER_ALREADY_EXISTS',
            fieldErrors: { userId: ['User is already a member of this organization'] },
        });
    }

    try {
        const member = await OrganizationMember.addMember({
            userId,
            organizationId,
            role,
            status,
            invitedBy: auth.user?.id ?? null,
            invitedAt: Date.now(),
            cache: getRBACCache(),
        });

        await auditOrganizationAction(context.request, {
            userId: auth.user?.id,
            userEmail: auth.user?.email ?? null,
            organizationId,
            action: 'member_invite',
            resourceType: 'organization_member',
            resourceId: userId,
            metadata: { role, status },
        });

        // Send welcome email to new member (best effort — failures do not block the response)
        const userEmail = (user as User).get('email') as string | null;
        if (userEmail) {
            const organization = await Organization.find(organizationId);
            const dashboardUrl = new URL('/dashboard', context.request.url).toString();

            await sendMemberAddedEmail(context.env, {
                to: userEmail,
                organizationName: (organization?.get('name') as string | null) || 'the organization',
                inviterName: auth.user?.name || undefined,
                memberName: ((user as User).get('name') as string | null) || userEmail,
                role,
                dashboardUrl,
            });
        }

        return jsonResponse({ data: member }, 201);
    } catch (err) {
        const mapped = membershipErrorToResponse(err);
        if (mapped) return mapped;
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

    if (!canAccessOrganization(auth, organizationId)) {
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

    try {
        if (body.role !== undefined) {
            await OrganizationMember.setRole(userId, organizationId, body.role, {
                assignedBy: auth.user?.id,
                cache: getRBACCache(),
            });
        }
        if (body.status !== undefined) {
            await OrganizationMember.setStatus(userId, organizationId, body.status, {
                assignedBy: auth.user?.id,
                cache: getRBACCache(),
            });
        }

        const updated = await OrganizationMember.first({ userId, organizationId });
        const payload = updated?.toJson() ?? existingMember.toJson();

        await auditOrganizationAction(context.request, {
            userId: auth.user?.id,
            userEmail: auth.user?.email ?? null,
            organizationId,
            action: 'member_update',
            resourceType: 'organization_member',
            resourceId: userId,
            metadata: { role: body.role, status: body.status },
        });

        return jsonResponse({ data: payload });
    } catch (err) {
        const mapped = membershipErrorToResponse(err);
        if (mapped) return mapped;
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

    if (!canAccessOrganization(auth, organizationId)) {
        return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
    }

    const existingMember = await OrganizationMember.first({ userId, organizationId });
    if (!existingMember) {
        return errorResponse('Member not found', 404, { code: 'MEMBER_NOT_FOUND' });
    }

    // Optional offboarding metadata from request body (reason, notifyMember)
    let offboardingData: { reason?: string; notifyMember?: boolean } = {};
    try {
        const body = (await context.request.json().catch(() => ({}))) as {
            reason?: unknown;
            notifyMember?: unknown;
        };
        // Cap free-form reason to avoid unbounded strings landing in the audit log
        const reason =
            typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim().slice(0, 500) : undefined;
        offboardingData = {
            reason,
            notifyMember: body.notifyMember === true,
        };
    } catch {
        // Body is optional — treat as an unannotated removal
    }

    try {
        const removed = await OrganizationMember.removeMember(userId, organizationId, {
            cache: getRBACCache(),
        });
        if (!removed) {
            return errorResponse('Failed to remove member', 500, {
                code: 'ORG_MEMBER_REMOVE_FAILED',
            });
        }

        // Enhanced audit log with offboarding metadata
        await auditOrganizationAction(context.request, {
            userId: auth.user?.id,
            userEmail: auth.user?.email ?? null,
            organizationId,
            action: 'member_remove',
            resourceType: 'organization_member',
            resourceId: userId,
            metadata: {
                removedUser: existingMember.user?.email || userId,
                removedUserRole: existingMember.role,
                offboardingReason: offboardingData.reason,
                notificationRequested: offboardingData.notifyMember,
            },
        });

        // Send email notification if requested (best effort — failures do not block the response)
        if (offboardingData.notifyMember && existingMember.user?.email) {
            const organization = await Organization.find(organizationId);

            await sendMemberRemovedEmail(context.env, {
                to: existingMember.user.email,
                organizationName: (organization?.get('name') as string | null) || 'the organization',
                memberName: existingMember.user.name || existingMember.user.email,
                role: existingMember.role,
                reason: offboardingData.reason,
            });
        }

        return jsonResponse({
            data: {
                userId,
                organizationId,
                removed: true,
                notificationRequested: offboardingData.notifyMember,
            },
        });
    } catch (err) {
        const mapped = membershipErrorToResponse(err);
        if (mapped) return mapped;
        return errorResponse('Failed to remove member', 500, {
            code: 'ORG_MEMBER_REMOVE_FAILED',
            details: err instanceof Error ? err.message : 'Unknown error',
        });
    }
}

export async function handleCurrentOrganizationMembersList(context: ApiRouteContext): Promise<Response> {
    const organizationId = await resolveCurrentOrgForAdmin(context);
    if (organizationId instanceof Response) return organizationId;
    return handleAdminOrganizationMembersList(context, organizationId);
}

export async function handleCurrentOrganizationInviteMember(context: ApiRouteContext): Promise<Response> {
    const organizationId = await resolveCurrentOrgForAdmin(context);
    if (organizationId instanceof Response) return organizationId;
    return handleAdminOrganizationInviteMember(context, organizationId);
}

export async function handleCurrentOrganizationUpdateMember(
    context: ApiRouteContext,
    userId: string,
): Promise<Response> {
    const organizationId = await resolveCurrentOrgForAdmin(context);
    if (organizationId instanceof Response) return organizationId;
    return handleAdminOrganizationUpdateMember(context, organizationId, userId);
}

export async function handleCurrentOrganizationRemoveMember(
    context: ApiRouteContext,
    userId: string,
): Promise<Response> {
    const organizationId = await resolveCurrentOrgForAdmin(context);
    if (organizationId instanceof Response) return organizationId;
    return handleAdminOrganizationRemoveMember(context, organizationId, userId);
}

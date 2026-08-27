import { Organization, OrganizationMember, User } from '@ottabase/ottaorm/models';
import { sendTemplatedEmail } from '@ottabase/email';
import { errorResponse, redactErrorForLog } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { paginatedJsonResponse, parsePaginationParams } from '@ottabase/utils/pagination';
import { sanitizeBlockHtml, sanitizeInlineHtml, sanitizeUrl } from '@ottabase/utils/sanitize';
import { isEmail, stripHtml } from '@ottabase/utils/string';
import { requireAdminAccess, type AdminContext } from '../lib/admin-guard';
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

export function buildOrganizationInviteEmailContent(params: {
    organizationName: string;
    destinationUrl: string;
    alreadyHasAccount: boolean;
}): { subject: string; header: string; body: string } {
    const organizationNameText = stripHtml(sanitizeInlineHtml(params.organizationName))
        .replace(/[\r\n]+/g, ' ')
        .trim()
        .slice(0, 200);
    const displayName = organizationNameText || 'your organization';
    const organizationNameHtml = displayName.replace(
        /[&<>"']/g,
        (character) =>
            ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            })[character] as string,
    );
    const destinationUrl = sanitizeUrl(params.destinationUrl);
    const action = params.alreadyHasAccount ? 'Sign in' : 'Create your account';
    const lead = params.alreadyHasAccount
        ? `You've been added to <strong>${organizationNameHtml}</strong>. Sign in to get started.`
        : `You've been invited to join <strong>${organizationNameHtml}</strong>. Create an account with this email address to accept.`;

    return {
        subject: `You've been invited to join ${displayName}`,
        header: `Join ${displayName}`,
        body: sanitizeBlockHtml(`<p>${lead}</p><p><a href="${destinationUrl}">${action}</a></p>`),
    };
}

/**
 * Tenant-data boundary for roster access. The caller must hold an OWNER/ADMIN organization_members
 * row in the TARGET org — an active membership of ANY role is NOT enough. This is the authority for
 * both reading and mutating an org's roster.
 *
 * Why owner/admin, not any-member: `requireAdminAccess({ scope: 'either' })` in the roster handlers
 * resolves admin status against the CALLER'S OWN session org (where every self-registered user
 * auto-holds `org:admin` in their personal workspace), not the URL's `:organizationId`. So it does
 * not, on its own, prove admin standing in the target org. If this check accepted any active member,
 * a rank-and-file collaborator invited into org O could self-promote to owner and evict the real
 * owner. Requiring owner/admin membership in O is what actually binds authority to the target org.
 *
 * We deliberately do NOT trust `auth.organizationId` as proof of access. When the caller has no
 * session org it is resolved from the client-supplied `x-org-id` header / `?organizationId`
 * query with no membership validation (packages/rbac resolveOrganizationId), and a platform
 * owner's system-scope `*:*` role satisfies assertAdmin for ANY org — so trusting that value
 * would let a non-member inject the target org and pass. Mirrors the audit-log boundary, which
 * likewise derives the allowed orgs from membership rather than the request-supplied org.
 */
async function assertRosterAccess(auth: AdminContext, organizationId: string): Promise<Response | null> {
    if (auth.user?.id && (await OrganizationMember.isOwnerOrAdmin(auth.user.id, organizationId))) {
        return null;
    }
    return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
}

export async function handleAdminOrganizationMembersList(
    context: ApiRouteContext,
    organizationId: string,
): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'either' });
    if (auth instanceof Response) return auth;

    const denied = await assertRosterAccess(auth, organizationId);
    if (denied) return denied;

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
            data: members,
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
        const orgName = (organization?.get('name') as string | undefined) ?? 'the organization';

        registerAppEmailTemplates();

        const destinationUrl = new URL(context.env.AUTH_URL || context.request.url);
        destinationUrl.pathname = params.alreadyHasAccount ? '/login' : '/register';
        destinationUrl.searchParams.set('email', params.toEmail);
        const content = buildOrganizationInviteEmailContent({
            organizationName: orgName,
            destinationUrl: destinationUrl.toString(),
            alreadyHasAccount: params.alreadyHasAccount,
        });

        await sendTemplatedEmail(mailer, {
            from,
            to: params.toEmail,
            template: 'minimalist',
            subject: content.subject,
            variables: {
                subject: content.subject,
                header: content.header,
                body: content.body,
                footer: '',
            },
        });
    } catch (error) {
        console.warn(
            JSON.stringify({
                event: 'organization_invite_email_failed',
                error: redactErrorForLog(error),
            }),
        );
    }
}

export async function handleAdminOrganizationInviteMember(
    context: ApiRouteContext,
    organizationId: string,
): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'either' });
    if (auth instanceof Response) return auth;

    const denied = await assertRosterAccess(auth, organizationId);
    if (denied) return denied;

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

    // Role-hierarchy guard: only an OWNER may invite another OWNER (creating owners is owner-only).
    if (
        role === 'owner' &&
        auth.user?.id &&
        !(await OrganizationMember.hasRole(auth.user.id, organizationId, 'owner'))
    ) {
        return errorResponse('Only an owner can invite an owner', 403, { code: 'FORBIDDEN' });
    }

    // Resolve to an existing user account either by explicit userId or by matching email.
    const user = userId ? await User.find(userId) : email ? await User.findByEmail(email) : undefined;
    if (userId && !user) {
        return errorResponse('User not found', 404, {
            code: 'USER_NOT_FOUND',
            fieldErrors: { userId: ['User not found'] },
        });
    }

    const userJson = user?.toJson();
    const resolvedUserId = userJson?.id as string | undefined;
    const resolvedEmail = email ?? (userJson?.email as string | undefined);

    // An email-only invite is not an active principal yet. Allowing a caller to mark a row with
    // no userId active (or suspended) creates a phantom member and can corrupt owner guarantees.
    // Activation is performed by activatePendingInvites only after the account is authoritative.
    if (!resolvedUserId && body.status !== undefined && body.status !== 'invited') {
        return errorResponse('Email-only memberships must remain invited until the user signs in', 400, {
            code: 'VALIDATION_ERROR',
            fieldErrors: { status: ['Email-only memberships must use invited status'] },
        });
    }
    if (resolvedUserId && body.status === 'invited') {
        return errorResponse('Existing users must be added as active or suspended', 400, {
            code: 'VALIDATION_ERROR',
            fieldErrors: { status: ['Pending invites are only valid for email-only memberships'] },
        });
    }

    // Check by userId AND by email so a still-pending email invite for this person (row with
    // userId: null) is found even when this request resolved a userId (e.g. they've since
    // registered) — otherwise a duplicate row could be created instead of being caught here.
    const existingMember = await OrganizationMember.findExistingInvite({
        organizationId,
        userId: resolvedUserId ?? null,
        invitedEmail: resolvedEmail ?? null,
    });
    if (existingMember) {
        return errorResponse('This user is already a member or has a pending invite', 409, {
            code: 'MEMBER_ALREADY_EXISTS',
            fieldErrors: { userId: ['Already a member or invited'], email: ['Already a member or invited'] },
        });
    }

    // body.status is already validated above (undefined or a valid status), and the fallback
    // literals are valid by construction — no re-check needed here.
    const status = body.status ?? (resolvedUserId ? 'active' : 'invited');

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

        // Only notify when the admin explicitly supplied an email (the "invite by email" flow).
        // Gate on the caller-supplied `email`/`userId` (not the resolved values) so: (a) adding an
        // existing user by userId never sends a notification to their account email, and (b) a
        // request that supplies both fields never sends to a caller-supplied address that may be
        // unrelated to the userId being granted membership.
        if (email && !userId) {
            await sendOrgInviteEmail(context, {
                toEmail: email,
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

    const denied = await assertRosterAccess(auth, organizationId);
    if (denied) return denied;

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

    // Role-hierarchy guard: only an OWNER may grant owner or modify an existing owner. assertRosterAccess
    // above admits owner AND admin, but an admin must not be able to self-promote to owner (nothing else
    // guards GRANTING owner) or demote/suspend an owner — either would let an admin take the org from its
    // owner, the same end state as the original roster-takeover bug one tier up.
    const touchesOwner = body.role === 'owner' || (existingMember.toJson() as { role?: string }).role === 'owner';
    if (touchesOwner && auth.user?.id && !(await OrganizationMember.hasRole(auth.user.id, organizationId, 'owner'))) {
        return errorResponse('Only an owner can grant or modify owner-level membership', 403, { code: 'FORBIDDEN' });
    }

    const existing = existingMember.toJson() as { role?: unknown; status?: unknown };
    if (!isValidRole(existing.role) || !isValidStatus(existing.status)) {
        return errorResponse('Membership has an invalid persisted role or status', 500, {
            code: 'INVALID_MEMBERSHIP_STATE',
        });
    }

    try {
        // The model owns the cross-table invariant: any demotion revokes org-scoped user_roles in
        // the SAME D1 batch as the guarded roster update. The expected snapshot closes stale-write
        // races, and the SQL predicate prevents two concurrent requests from removing both owners.
        const expected = { role: existing.role, status: existing.status };
        const result =
            body.role !== undefined
                ? await OrganizationMember.updateRosterMembership(
                      userId,
                      organizationId,
                      { role: body.role, ...(body.status !== undefined ? { status: body.status } : {}) },
                      expected,
                  )
                : body.status !== undefined
                  ? await OrganizationMember.updateRosterMembership(
                        userId,
                        organizationId,
                        { status: body.status },
                        expected,
                    )
                  : null;

        if (!result) {
            return errorResponse('Nothing to update', 400, { code: 'VALIDATION_ERROR' });
        }

        if (result.status === 'updated') {
            // Role/status changed (incl. suspension) — revocation must not wait out the
            // membership-cache TTL.
            await invalidateMembershipCache(context.env.OBCF_KV, userId);
            // Refresh the mutable session snapshot on the next request.
            await bumpProfileVersion(context.env, userId);
            return jsonResponse({ data: result.member });
        }

        if (result.status === 'not_found') {
            return errorResponse('Member not found', 404, { code: 'MEMBER_NOT_FOUND' });
        }
        if (result.status === 'last_active_owner') {
            return errorResponse('Cannot change role or status for the last active owner', 409, {
                code: 'LAST_ACTIVE_OWNER_GUARD',
            });
        }
        if (result.status === 'stale') {
            return errorResponse('Membership changed while it was being updated; reload and retry', 409, {
                code: 'MEMBERSHIP_CHANGED',
            });
        }

        return errorResponse('Membership update was not applied', 409, { code: 'MEMBERSHIP_CHANGED' });
    } catch (err) {
        console.error(
            JSON.stringify({
                event: 'organization_member_update_failed',
                organizationId: organizationId.slice(0, 128),
                userId: userId.slice(0, 128),
                error: redactErrorForLog(err),
            }),
        );
        return errorResponse('Failed to update member', 500, {
            code: 'ORG_MEMBER_UPDATE_FAILED',
            details: err instanceof Error ? err.message : 'Unknown error',
        });
    }
}

export async function handleAdminOrganizationRemoveMember(
    context: ApiRouteContext,
    organizationId: string,
    memberId: string,
): Promise<Response> {
    const auth = await requireAdminAccess(context, { scope: 'either' });
    if (auth instanceof Response) return auth;

    const denied = await assertRosterAccess(auth, organizationId);
    if (denied) return denied;

    const existingMember = await OrganizationMember.first({ id: memberId, organizationId });
    if (!existingMember) {
        return errorResponse('Member not found', 404, { code: 'MEMBER_NOT_FOUND' });
    }

    // Role-hierarchy guard: only an OWNER may remove an OWNER — an admin must not be able to evict an
    // owner (which, combined with the last-owner guard, is how the roster-takeover attack completes).
    if (
        (existingMember.toJson() as { role?: string }).role === 'owner' &&
        auth.user?.id &&
        !(await OrganizationMember.hasRole(auth.user.id, organizationId, 'owner'))
    ) {
        return errorResponse('Only an owner can remove an owner', 403, { code: 'FORBIDDEN' });
    }

    const existing = existingMember.toJson() as { role?: unknown; status?: unknown; userId?: unknown };
    if (!isValidRole(existing.role) || !isValidStatus(existing.status)) {
        return errorResponse('Membership has an invalid persisted role or status', 500, {
            code: 'INVALID_MEMBERSHIP_STATE',
        });
    }

    try {
        if (existing.userId === null || existing.userId === undefined) {
            if (existing.status !== 'invited') {
                return errorResponse('Membership has an invalid persisted identity', 500, {
                    code: 'INVALID_MEMBERSHIP_STATE',
                });
            }
            const cancelled = await OrganizationMember.cancelPendingInvite(memberId, organizationId, existing.role);
            if (!cancelled) {
                return errorResponse('Invite changed while it was being cancelled; reload and retry', 409, {
                    code: 'MEMBERSHIP_CHANGED',
                });
            }
            return jsonResponse({ data: { id: memberId, organizationId, removed: true } });
        }
        if (typeof existing.userId !== 'string' || existing.userId.length === 0) {
            return errorResponse('Membership has an invalid persisted identity', 500, {
                code: 'INVALID_MEMBERSHIP_STATE',
            });
        }
        const userId = existing.userId;

        // Grant revocation and guarded membership deletion are one D1 transaction in the model.
        // Matching the expected snapshot makes a concurrent hierarchy change fail closed.
        const result = await OrganizationMember.removeRosterMembership(userId, organizationId, {
            role: existing.role,
            status: existing.status,
        });

        if (result.status === 'not_found') {
            return errorResponse('Member not found', 404, { code: 'MEMBER_NOT_FOUND' });
        }
        if (result.status === 'last_active_owner') {
            return errorResponse('Cannot remove the last active owner from this organization', 409, {
                code: 'LAST_ACTIVE_OWNER_GUARD',
            });
        }
        if (result.status === 'stale') {
            return errorResponse('Membership changed while it was being removed; reload and retry', 409, {
                code: 'MEMBERSHIP_CHANGED',
            });
        }

        // Membership revoked — drop the cached lookups so access ends now, not at TTL expiry.
        await invalidateMembershipCache(context.env.OBCF_KV, userId);
        // Membership change alters the user's active org (and thus org-scoped roles/permissions) —
        // refresh their live session so it isn't served the stale snapshot until the JWT expires.
        await bumpProfileVersion(context.env, userId);

        return jsonResponse({ data: { userId, organizationId, removed: true } });
    } catch (err) {
        console.error(
            JSON.stringify({
                event: 'organization_member_remove_failed',
                organizationId: organizationId.slice(0, 128),
                memberId: memberId.slice(0, 128),
                error: redactErrorForLog(err),
            }),
        );
        return errorResponse('Failed to remove member', 500, {
            code: 'ORG_MEMBER_REMOVE_FAILED',
            details: err instanceof Error ? err.message : 'Unknown error',
        });
    }
}

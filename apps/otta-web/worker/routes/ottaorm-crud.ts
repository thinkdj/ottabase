import { getSession, hashPassword } from '@ottabase/auth/backend';
import { Comment } from '@ottabase/comments';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { Post } from '@ottabase/ottablog';
import { executeSecureCrudRequest, parseCrudRequest, registerConnection } from '@ottabase/ottaorm';
import {
    normalizeGroupInviteEmail,
    OrganizationMember,
    User,
    UserGroup,
    UserGroupMember,
    USER_GROUP_MEMBER_ROLES,
} from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { CloudflareEnv } from '../../cloudflare-env';
import { getAuthOptions, getSecurityContext } from '../lib/auth-utils';

export interface OttaormCrudContext {
    request: Request;
    env: CloudflareEnv;
    url: URL;
}

export async function handleOttaormCrud(context: OttaormCrudContext): Promise<Response> {
    const { request, env, url } = context;

    if (!env.OBCF_D1) {
        return errorResponse('D1 database binding not configured', 500, {
            code: 'CONFIG_ERROR',
        });
    }

    registerConnection('default', createD1Driver(env.OBCF_D1));

    const session = await getSession(request, env as any, getAuthOptions(env));
    const securityContext = await getSecurityContext(request, session, env);
    const crudRequest = await parseCrudRequest(request, url, '/api/ottaorm');

    if (!crudRequest) {
        return errorResponse('Invalid CRUD request', 400, {
            code: 'INVALID_REQUEST',
            hint: 'Use /api/ottaorm/{model}/{id?} format',
        });
    }

    if (crudRequest.model === 'users') {
        return errorResponse('Users CRUD is disabled', 403, {
            code: 'CRUD_DISABLED',
            hint: 'Use /api/users/me for profile access',
        });
    }

    if (crudRequest.model === 'menus' || crudRequest.model === 'menu_items') {
        return errorResponse('Menus CRUD is disabled via OttaORM', 403, {
            code: 'CRUD_DISABLED',
            hint: 'Use /api/brand/menus for menu CRUD (includes cache invalidation)',
        });
    }

    if (crudRequest.model === 'organization_members') {
        return errorResponse('Organization members CRUD is disabled via OttaORM', 403, {
            code: 'CRUD_DISABLED',
            hint: 'Use /api/admin/organizations/:organizationId/members endpoints (includes last-owner safety guardrails)',
        });
    }

    if (
        crudRequest.model === 'posts' &&
        crudRequest.body &&
        (crudRequest.method === 'POST' || crudRequest.method === 'PATCH')
    ) {
        if (crudRequest.method === 'PATCH' && crudRequest.id) {
            const expectedUpdatedAt = (crudRequest.body as any).expectedUpdatedAt;
            if (expectedUpdatedAt !== undefined) {
                const expectedTimestamp =
                    expectedUpdatedAt instanceof Date ? expectedUpdatedAt.getTime() : Number(expectedUpdatedAt);

                if (!Number.isFinite(expectedTimestamp)) {
                    return errorResponse('expectedUpdatedAt must be a valid timestamp', 400, {
                        code: 'VALIDATION_ERROR',
                        fieldErrors: { expectedUpdatedAt: ['Invalid timestamp'] },
                    });
                }

                const existing = await Post.find(crudRequest.id);
                if (!existing) {
                    return errorResponse('Post not found', 404, { code: 'NOT_FOUND' });
                }

                const currentUpdatedAt = existing.get('updatedAt');
                const currentTimestamp =
                    currentUpdatedAt instanceof Date ? currentUpdatedAt.getTime() : Number(currentUpdatedAt);

                if (!Number.isFinite(currentTimestamp) || currentTimestamp !== expectedTimestamp) {
                    return errorResponse('Post was updated by another session', 409, {
                        code: 'CONFLICT',
                        details: {
                            expectedUpdatedAt: expectedTimestamp,
                            currentUpdatedAt: currentTimestamp,
                        },
                    });
                }
            }

            delete (crudRequest.body as any).expectedUpdatedAt;
        }

        const isProtected = (crudRequest.body as any).isProtected;
        const password = (crudRequest.body as any).password;
        if (isProtected === true && typeof password !== 'string') {
            let hasExistingPassword = false;
            if (crudRequest.method === 'PATCH' && crudRequest.id) {
                const existing = await Post.find(crudRequest.id);
                hasExistingPassword = !!existing?.get('passwordHash');
            }
            if (!hasExistingPassword) {
                return errorResponse('Password is required to protect a post', 400, {
                    code: 'VALIDATION_ERROR',
                    fieldErrors: { password: ['Password is required when enabling protection'] },
                });
            }
        }

        if (typeof password === 'string') {
            const plain = password;
            (crudRequest.body as any).passwordHash = await hashPassword(plain);
            delete (crudRequest.body as any).password;
        }

        // Enforce author and tenancy context
        // Note: authorId references User - use author() relationship to get author info
        const user = session?.user;
        (crudRequest.body as any).authorId = user?.id ?? (crudRequest.body as any).authorId ?? null;
        (crudRequest.body as any).userId = user?.id ?? (crudRequest.body as any).userId ?? null;
        (crudRequest.body as any).organizationId = securityContext.organizationId ?? null;
        (crudRequest.body as any).appId = securityContext.appId ?? (crudRequest.body as any).appId ?? 'web';
    }

    // Inject server-side context for comments (userId + organizationId)
    if (
        crudRequest.model === 'comments' &&
        crudRequest.body &&
        (crudRequest.method === 'POST' || crudRequest.method === 'PATCH')
    ) {
        const user = session?.user;
        if (crudRequest.method === 'POST') {
            (crudRequest.body as any).userId = user?.id ?? null;
            (crudRequest.body as any).organizationId = securityContext.organizationId ?? null;
        }

        // Reaction toggles must go through server-side validation so that a user
        // can only add/remove their own ID from the reactions map.
        // _reaction: emoji — toggles the current user's reaction on the comment.
        if (crudRequest.method === 'PATCH' && crudRequest.id) {
            const emoji = (crudRequest.body as any)._reaction;
            if (emoji && typeof emoji === 'string') {
                if (!user?.id) {
                    return errorResponse('Authentication required', 401, { code: 'UNAUTHENTICATED' });
                }
                try {
                    const comment = await Comment.find(crudRequest.id);
                    if (!comment) {
                        return errorResponse('Comment not found', 404, { code: 'NOT_FOUND' });
                    }
                    await comment.toggleReaction(emoji, user.id);
                    return jsonResponse(comment.toJson(), 200);
                } catch (err) {
                    return errorResponse('Failed to update reaction', 500, {
                        code: 'REACTION_UPDATE_FAILED',
                        details: err instanceof Error ? err.message : 'Unknown error',
                    });
                }
            }
        }
    }

    if (crudRequest.model === 'organizations' && crudRequest.body && crudRequest.method === 'POST') {
        const userId = session?.user?.id;
        if (!userId) {
            return errorResponse('Authentication required', 401, { code: 'UNAUTHENTICATED' });
        }

        (crudRequest.body as any).ownerId = userId;
        if ((crudRequest.body as any).status === undefined) {
            (crudRequest.body as any).status = 'active';
        }
        if ((crudRequest.body as any).plan === undefined) {
            (crudRequest.body as any).plan = 'free';
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // User groups: server-side hardening
    //
    // On CREATE: stamp `createdBy` from session and let RLS auto-inject `organizationId`.
    // On UPDATE: prevent reassignment of `organizationId` / `createdBy` (RLS handles cross-tenant).
    // ──────────────────────────────────────────────────────────────────────
    if (crudRequest.model === 'user_groups' && crudRequest.body) {
        const sessionUserId = session?.user?.id;
        if (!sessionUserId) {
            return errorResponse('Authentication required', 401, { code: 'UNAUTHENTICATED' });
        }
        const body = crudRequest.body as Record<string, unknown>;

        if (crudRequest.method === 'POST') {
            body.createdBy = sessionUserId;
        } else if (crudRequest.method === 'PATCH' || crudRequest.method === 'PUT') {
            // Server-controlled fields cannot be reassigned via update
            delete body.id;
            delete body.organizationId;
            delete body.createdBy;
            delete body.createdAt;
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // User group members: server-side hardening
    //
    // Threats mitigated here:
    //  - Spoofing `userId` to claim someone else's identity. Only the inviter is trusted; we
    //    derive `userId` server-side by resolving the email to an existing user (instant claim)
    //    or by leaving it null until the invitee signs up (claim-on-signup flow).
    //  - Spoofing `status` to skip the invite step. Status is derived: 'active' if userId
    //    resolved, 'invited' otherwise.
    //  - Spoofing `invitedBy`. We always stamp this from the session.
    //  - Cross-org writes by setting groupId to a group in a different tenant. We verify
    //    the group belongs to the active organization.
    // ──────────────────────────────────────────────────────────────────────
    if (crudRequest.model === 'user_group_members' && crudRequest.body) {
        const sessionUserId = session?.user?.id;
        if (!sessionUserId) {
            return errorResponse('Authentication required', 401, { code: 'UNAUTHENTICATED' });
        }
        const body = crudRequest.body as Record<string, unknown>;

        if (crudRequest.method === 'POST') {
            const groupId = typeof body.groupId === 'string' ? body.groupId : '';
            if (!groupId) {
                return errorResponse('groupId is required', 400, {
                    code: 'VALIDATION_ERROR',
                    fieldErrors: { groupId: ['groupId is required'] },
                });
            }

            // Verify the group exists and belongs to the active org
            const group = await UserGroup.find(groupId);
            if (!group) {
                return errorResponse('Group not found', 404, { code: 'NOT_FOUND' });
            }
            const groupOrgId = group.get('organizationId') as string | undefined;
            if (!securityContext.organizationId || groupOrgId !== securityContext.organizationId) {
                return errorResponse('Group not found', 404, { code: 'NOT_FOUND' });
            }

            // Normalize and resolve identity. Trust only invitedEmail / explicit existing-user
            // selection. Anything else (status, joinedAt, role manipulation) is overwritten.
            const rawEmail = typeof body.invitedEmail === 'string' ? body.invitedEmail : null;
            const normalizedEmail = normalizeGroupInviteEmail(rawEmail);

            let resolvedUserId: string | null = null;
            const requestedUserId = typeof body.userId === 'string' ? body.userId : null;

            if (requestedUserId) {
                // Verify the user exists and is a member of the active org. Without this check,
                // anyone could add an arbitrary user to a group across tenants.
                const targetMembership = await OrganizationMember.first({
                    userId: requestedUserId,
                    organizationId: securityContext.organizationId,
                    status: 'active',
                });
                if (!targetMembership) {
                    return errorResponse('User is not a member of this organization', 400, {
                        code: 'INVALID_USER',
                        fieldErrors: { userId: ['User is not a member of this organization'] },
                    });
                }
                resolvedUserId = requestedUserId;
            } else if (normalizedEmail) {
                // If the email already belongs to a registered user, resolve immediately so the
                // membership is created in 'active' status — same UX as claim-on-signup.
                const existingUser = await User.first({ email: normalizedEmail });
                if (existingUser) {
                    resolvedUserId = String(existingUser.get('id'));
                }
            } else {
                return errorResponse('Either userId or invitedEmail is required', 400, {
                    code: 'VALIDATION_ERROR',
                    fieldErrors: { invitedEmail: ['Either userId or invitedEmail is required'] },
                });
            }

            // Sanitize role (whitelist) and overwrite all server-controlled fields
            const requestedRole = typeof body.role === 'string' ? body.role : 'member';
            const role = (USER_GROUP_MEMBER_ROLES as readonly string[]).includes(requestedRole)
                ? requestedRole
                : 'member';

            const now = Date.now();
            body.groupId = groupId;
            body.organizationId = securityContext.organizationId;
            body.userId = resolvedUserId;
            body.invitedEmail = resolvedUserId ? null : normalizedEmail;
            body.role = role;
            body.status = resolvedUserId ? 'active' : 'invited';
            body.invitedBy = sessionUserId;
            body.invitedAt = now;
            body.joinedAt = resolvedUserId ? now : null;

            // Idempotency: if the (group, user) or (group, email) pair already exists, return it.
            const existing = await UserGroupMember.findExisting({
                groupId,
                userId: resolvedUserId,
                invitedEmail: normalizedEmail,
            });
            if (existing) {
                return jsonResponse({ data: existing }, 200);
            }
        } else if (crudRequest.method === 'PATCH' || crudRequest.method === 'PUT') {
            // Only `role` and `metadata` are user-editable; everything else is server-controlled.
            const allowed = new Set(['role', 'metadata']);
            for (const key of Object.keys(body)) {
                if (!allowed.has(key)) delete body[key];
            }
            if (typeof body.role === 'string' && !(USER_GROUP_MEMBER_ROLES as readonly string[]).includes(body.role)) {
                body.role = 'member';
            }
        }
    }

    const result = await executeSecureCrudRequest(crudRequest, securityContext);

    if (!result.success) {
        console.error(`[CRUD Error] ${crudRequest.method} ${crudRequest.model}:`, {
            error: result.error,
            code: result.code,
            details: result.details,
            hint: result.hint,
        });

        return errorResponse(result.error || 'Unknown error', result.status, {
            code: result.code,
            details: result.details,
            hint: result.hint,
            messages: result.messages,
            fieldErrors: result.fieldErrors,
        });
    }

    if (crudRequest.model === 'organizations' && crudRequest.method === 'POST') {
        const userId = session?.user?.id;
        const data = result.data as any;
        const orgId = data?.id;
        if (userId && orgId) {
            try {
                await OrganizationMember.create({
                    userId,
                    organizationId: orgId,
                    role: 'owner',
                    status: 'active',
                    invitedBy: userId,
                    joinedAt: Date.now(),
                } as any);
            } catch (err) {
                return errorResponse('Failed to create organization membership', 500, {
                    code: 'ORG_MEMBER_CREATE_FAILED',
                    details: err instanceof Error ? err.message : 'Unknown error',
                });
            }
        }
    }

    // Enrich comment list responses with author info (name, image, createdAt)
    if (crudRequest.model === 'comments' && crudRequest.method === 'GET' && result.data && !crudRequest.id) {
        try {
            const payload = result.data as { data?: any[]; pagination?: any };
            const rows = Array.isArray(payload.data) ? payload.data : Array.isArray(payload) ? payload : [];
            const userIds = [...new Set(rows.map((r: any) => r.userId).filter(Boolean))] as string[];
            if (userIds.length > 0) {
                const users = await User.whereIn('id', userIds);
                const userMap = new Map(
                    users.map((u) => [
                        u.get('id'),
                        { id: u.get('id'), name: u.get('name'), image: u.get('image'), createdAt: u.get('createdAt') },
                    ]),
                );
                for (const row of rows) {
                    (row as any)._user = userMap.get(row.userId) ?? null;
                }
            }
        } catch {
            // Non-fatal: comments still returned without user enrichment
        }
    }

    return jsonResponse(result.data, result.status);
}

import { getSession, hashPassword } from '@ottabase/auth/backend';
import { Comment, CommentReaction } from '@ottabase/comments';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { Post } from '@ottabase/ottablog';
import { executeSecureCrudRequest, parseCrudRequest, registerConnection } from '@ottabase/ottaorm';
import { OrganizationMember, User, UserGroupMember } from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import type { CloudflareEnv } from '../../cloudflare-env';
import { getAuthOptions, getSecurityContext, invalidateMembershipCache } from '../lib/auth-utils';

export interface OttaormCrudContext {
    request: Request;
    env: CloudflareEnv;
    url: URL;
}

/**
 * Resolve the authoritative organizationId for a comment from its TARGET entity — never from
 * the caller's own ambient/header-supplied org context. This closes two problems:
 *
 * 1. getSecurityContext only validates a caller-supplied organizationId against real membership
 *    when there IS a session (the check is gated on `userId &&`) — an anonymous request's
 *    x-org-id header flows through completely unverified. Deriving the org from the target
 *    instead means an anonymous caller's header value is simply never consulted.
 * 2. Even for an authenticated caller, comments were previously tagged with the COMMENTER's own
 *    active org rather than the TARGET's org — wrong for public content (an Org-Y member
 *    commenting on an Org-X blog post should produce a comment belonging to Org X, the post's
 *    own org, not Org Y).
 *
 * For 'post' targets (the only target type this app currently defines), the post's own
 * organizationId is authoritative regardless of the caller's own org membership — a comment on
 * a post is exactly as visible/commentable as the post itself; requiring the commenter to also
 * be a *member* of the post's org would break ordinary public blog commenting. The caller's
 * memberOrganizationIds is extended (in a local copy only, never persisted) to include the
 * resolved org so the RLS engine's enforceOrgMembership defense-in-depth doesn't spuriously
 * reject a legitimate cross-org public comment.
 *
 * Unknown/custom target types have no registered resolver — for those we fall back to requiring
 * authentication and trusting only the caller's own already-membership-validated organizationId
 * (which getSecurityContext only sets from session state, not from an unverified header, once a
 * session exists). This closes the anonymous-spoofing gap for the general case, at the cost of
 * not supporting anonymous commenting on target types this app doesn't itself define.
 */
async function resolveCommentSecurityContext(
    targetType: unknown,
    targetId: unknown,
    session: any,
    ambient: Awaited<ReturnType<typeof getSecurityContext>>,
): Promise<
    | { ok: true; organizationId: string | null; securityContext: Awaited<ReturnType<typeof getSecurityContext>> }
    | { ok: false; response: Response }
> {
    if (typeof targetType !== 'string' || !targetType || typeof targetId !== 'string' || !targetId) {
        return {
            ok: false,
            response: errorResponse('targetType and targetId are required', 400, { code: 'VALIDATION_ERROR' }),
        };
    }

    if (targetType === 'post') {
        const post = await Post.find(targetId);
        if (!post) {
            return { ok: false, response: errorResponse('Target post not found', 404, { code: 'NOT_FOUND' }) };
        }
        const targetOrgId = (post.get('organizationId') as string | null) ?? null;
        const memberOrganizationIds = Array.isArray(ambient.memberOrganizationIds)
            ? [...new Set([...ambient.memberOrganizationIds, ...(targetOrgId ? [targetOrgId] : [])])]
            : ambient.memberOrganizationIds;
        return {
            ok: true,
            organizationId: targetOrgId,
            securityContext: { ...ambient, organizationId: targetOrgId, memberOrganizationIds },
        };
    }

    if (!session?.user?.id) {
        return { ok: false, response: errorResponse('Authentication required', 401, { code: 'UNAUTHENTICATED' }) };
    }
    if (!ambient.organizationId) {
        return { ok: false, response: errorResponse('No active organization', 400, { code: 'VALIDATION_ERROR' }) };
    }
    return { ok: true, organizationId: ambient.organizationId, securityContext: ambient };
}

/**
 * Comments are considered PUBLIC content scoped to their target (matching the target's own
 * visibility — a published blog post's comments are readable by anyone). Write actions that
 * mutate someone else's comment (edit body/status, moderate) require either authorship or a
 * moderation permission — plain tenant-membership is not authorship.
 */
function isCommentOwnerOrModerator(
    comment: { get(field: string): unknown },
    session: any,
    securityContext: Awaited<ReturnType<typeof getSecurityContext>>,
): boolean {
    const userId = session?.user?.id;
    if (userId && comment.get('userId') === userId) return true;
    const permissions = (securityContext.permissions as string[] | undefined) ?? [];
    return permissions.includes('*:*') || permissions.includes('comments:moderate');
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
    // Comments override this per-request below (organizationId must come from the comment's
    // TARGET, never the caller's own ambient/header-supplied org) — every other model uses the
    // ambient securityContext unchanged.
    let effectiveSecurityContext: typeof securityContext = securityContext;
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

    if (crudRequest.model === 'comment_reactions') {
        return errorResponse('Comment reactions CRUD is disabled via OttaORM', 403, {
            code: 'CRUD_DISABLED',
            hint: "Use /api/ottaorm/comments/:id PATCH with a '_reaction' field",
        });
    }

    if (crudRequest.model === 'comments' && crudRequest.method === 'DELETE') {
        // parentId has no FK/cascade — hard-deleting a comment would leave any replies as
        // permanently unreachable orphans (still in the table, but never reachable from a
        // parentId===null root walk). Moderation must go through PATCH status:'deleted'
        // (soft-delete), which preserves the row and thread structure.
        return errorResponse('Comments cannot be hard-deleted via OttaORM', 403, {
            code: 'CRUD_DISABLED',
            hint: "PATCH status to 'deleted' instead — soft-delete preserves thread structure for replies",
        });
    }

    if (crudRequest.model === 'organization_members') {
        return errorResponse('Organization members CRUD is disabled via OttaORM', 403, {
            code: 'CRUD_DISABLED',
            hint: 'Use /api/admin/organizations/:organizationId/members endpoints (includes last-owner safety guardrails)',
        });
    }

    if (crudRequest.model === 'shortlinks') {
        // RLS's requiredRoles check (packages/ottaorm/src/rls/registry.ts) tests role NAME
        // membership only, not which organization the role was granted in — since every
        // self-registered user gets RBAC role 'owner' scoped to their own personal org, that
        // check alone doesn't actually restrict this to system admins. Force all shortlink
        // management through the dedicated /api/shortlinks routes, which correctly gate on
        // requireAdminAccess({ scope: 'system' }).
        return errorResponse('Shortlinks CRUD is disabled via OttaORM', 403, {
            code: 'CRUD_DISABLED',
            hint: 'Use /api/shortlinks endpoints (correctly scoped to system admins)',
        });
    }

    if (crudRequest.model === 'verification_tokens') {
        // PRE-EXISTING, UNRELATED TO PLATFORM_OWNER — surfaced during the platform_owner audit.
        // verification_tokens carries a PublicReadOnly RLS policy (packages/ottaorm rls/registry),
        // which yields an empty filter and no role check, and this generic CRUD route has no auth
        // gate — so anyone could `GET /api/ottaorm/verification_tokens` and read every live
        // password-reset / magic-link / email-verification token (stored in plaintext) and take
        // over accounts. Nothing legitimate reaches these through generic CRUD (they are consumed
        // server-side by the auth flows), so hard-block the model here. The deeper fix is to give
        // the model a non-public RLS policy; tracked separately.
        return errorResponse('Verification tokens are not accessible via OttaORM', 403, {
            code: 'CRUD_DISABLED',
        });
    }

    if (crudRequest.model === 'referral_tracking') {
        // PRE-EXISTING, UNRELATED TO PLATFORM_OWNER — surfaced during the platform_owner audit.
        // referral_tracking uses an app-scoped RLS policy that filters on appId only (no user/org
        // row filter), so any caller could read every user's referral rows (IP, user-agent,
        // referrer graph) and forge/delete them via this unauthenticated generic CRUD route. These
        // rows are written server-side by the referrals package, never by a browser, so hard-block
        // the model here. The deeper fix is a userId/appId-scoped RLS policy; tracked separately.
        return errorResponse('Referral tracking is not accessible via OttaORM', 403, {
            code: 'CRUD_DISABLED',
        });
    }

    if (crudRequest.model === 'scheduled_tasks') {
        // Same name-only RLS role-check gap as shortlinks above: every self-registered user
        // holds role NAME 'owner' in their personal org, so the AdminOnly policy on this
        // global (non-tenant) table doesn't restrict anything — any authenticated user could
        // read or mutate every row. Force management through /api/admin/cron, which gates on
        // requireAdminAccess({ scope: 'system' }).
        return errorResponse('Scheduled tasks CRUD is disabled via OttaORM', 403, {
            code: 'CRUD_DISABLED',
            hint: 'Use /api/admin/cron endpoints (correctly scoped to system admins)',
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

    if (crudRequest.model === 'comments') {
        const user = session?.user;

        if (crudRequest.method === 'POST' && crudRequest.body) {
            const body = crudRequest.body as Record<string, unknown>;
            const orgResolution = await resolveCommentSecurityContext(
                body.targetType,
                body.targetId,
                session,
                securityContext,
            );
            if (!orgResolution.ok) return orgResolution.response;

            const parentId = typeof body.parentId === 'string' && body.parentId ? body.parentId : null;
            const replyContext = await Comment.validateReplyParent(parentId, {
                targetType: body.targetType as string,
                targetId: body.targetId as string,
                organizationId: orgResolution.organizationId,
            });
            if (!replyContext.ok) {
                return errorResponse('parentId does not belong to this target', 400, {
                    code: 'VALIDATION_ERROR',
                    fieldErrors: { parentId: ['Parent comment not found for this target'] },
                });
            }

            body.userId = user?.id ?? null;
            body.organizationId = orgResolution.organizationId;
            // Never trust a client-supplied depth — always the server-computed value from the
            // validated parent (0 for a top-level comment).
            body.depth = replyContext.depth;
            effectiveSecurityContext = orgResolution.securityContext;
        }

        // Both PATCH branches (reaction toggle and regular field update) act on an EXISTING
        // row, so resolve the authoritative org from the comment's own stored target rather
        // than the request body (which for a reaction toggle is just `{ _reaction: emoji }` and
        // carries no target info at all). This is also what closes the cross-tenant reaction
        // IDOR: a comment whose stored organizationId doesn't match its own target's real org
        // (which can't happen for comments created after this fix, but is checked regardless)
        // is treated as not-found rather than acted upon.
        if (
            (crudRequest.method === 'PATCH' || crudRequest.method === 'PUT' || crudRequest.method === 'GET') &&
            crudRequest.id
        ) {
            const comment = await Comment.find(crudRequest.id);
            if (!comment) {
                return errorResponse('Comment not found', 404, { code: 'NOT_FOUND' });
            }
            const orgResolution = await resolveCommentSecurityContext(
                comment.get('targetType'),
                comment.get('targetId'),
                session,
                securityContext,
            );
            if (!orgResolution.ok) return orgResolution.response;
            if ((comment.get('organizationId') ?? null) !== orgResolution.organizationId) {
                // The row's org doesn't match its own target's real org (or the caller can't
                // establish that org) — fail closed as not-found rather than leaking existence.
                return errorResponse('Comment not found', 404, { code: 'NOT_FOUND' });
            }
            effectiveSecurityContext = orgResolution.securityContext;

            if ((crudRequest.method === 'PATCH' || crudRequest.method === 'PUT') && crudRequest.body) {
                const body = crudRequest.body as Record<string, unknown>;
                const emoji = body._reaction;

                if (emoji && typeof emoji === 'string') {
                    if (!user?.id) {
                        return errorResponse('Authentication required', 401, { code: 'UNAUTHENTICATED' });
                    }
                    try {
                        await comment.toggleReaction(emoji, user.id);
                        const reactions = await CommentReaction.reactionsFor([comment.get('id') as string]);
                        return jsonResponse(
                            { ...comment.toJson(), reactions: reactions.get(comment.get('id') as string) ?? {} },
                            200,
                        );
                    } catch (err) {
                        return errorResponse('Failed to update reaction', 500, {
                            code: 'REACTION_UPDATE_FAILED',
                            details: err instanceof Error ? err.message : 'Unknown error',
                        });
                    }
                }

                // Any other PATCH (body edit and/or moderation status change) requires the
                // caller to be the comment's author or hold a moderation permission — plain
                // tenant scoping is not authorship. Without this, any org member could edit or
                // moderate any other member's comment.
                if (!isCommentOwnerOrModerator(comment, session, orgResolution.securityContext)) {
                    return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
                }

                // A transition to 'deleted' must blank the body and clear reactions
                // server-side, regardless of what the client sent — this is the same guarantee
                // Comment.softDelete() provides, applied uniformly so every consumer gets it
                // even if they only PATCH {status: 'deleted'} without reimplementing the
                // side-effects client-side.
                if (body.status === 'deleted') {
                    body.body = '[deleted]';
                    await CommentReaction.deleteForComment(comment.get('id') as string);
                }
            }
        }

        if (crudRequest.method === 'GET' && !crudRequest.id) {
            // Comments are always fetched scoped to a target — requiring targetType/targetId
            // here (rather than allowing a bare, unscoped list) means the org-derivation-from-
            // target logic always has a target to resolve against, and prevents "browse every
            // comment across every target in some org" as an unintended side channel.
            const where = crudRequest.query?.where ?? {};
            const orgResolution = await resolveCommentSecurityContext(
                where.targetType,
                where.targetId,
                session,
                securityContext,
            );
            if (!orgResolution.ok) return orgResolution.response;
            effectiveSecurityContext = orgResolution.securityContext;
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

    // Group-membership mutations flow through this generic endpoint (org membership
    // is blocked above in favour of the admin routes, which invalidate directly).
    // Resolve whose membership caches are affected BEFORE executing — a DELETE
    // target row is gone afterwards.
    const affectedMembershipUserIds = await resolveAffectedMembershipUsers(crudRequest, securityContext);

    const result = await executeSecureCrudRequest(crudRequest, effectiveSecurityContext);

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

    if (affectedMembershipUserIds.length > 0) {
        await Promise.all(affectedMembershipUserIds.map((uid) => invalidateMembershipCache(env.OBCF_KV, uid)));
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
                // getSecurityContext cached this user's PRE-creation membership list
                // earlier in this very request — drop it, or the creator can't use
                // their new org until the cache TTL expires.
                await invalidateMembershipCache(env.OBCF_KV, userId);
            } catch (err) {
                return errorResponse('Failed to create organization membership', 500, {
                    code: 'ORG_MEMBER_CREATE_FAILED',
                    details: err instanceof Error ? err.message : 'Unknown error',
                });
            }
        }
    }

    // Enrich comment list responses with author info (name, image, createdAt)
    if (crudRequest.model === 'comments' && crudRequest.method === 'GET' && result.data) {
        try {
            const payload = result.data as { data?: any[]; pagination?: any } | any;
            const rows: any[] = crudRequest.id
                ? [payload]
                : Array.isArray(payload.data)
                  ? payload.data
                  : Array.isArray(payload)
                    ? payload
                    : [];
            const userIds = [...new Set(rows.map((r: any) => r.userId).filter(Boolean))] as string[];
            const commentIds = rows.map((r: any) => r.id).filter(Boolean) as string[];

            const [userMap, reactionsMap] = await Promise.all([
                userIds.length > 0
                    ? User.whereIn('id', userIds).then(
                          (users) =>
                              new Map(
                                  users.map((u) => [
                                      u.get('id'),
                                      {
                                          id: u.get('id'),
                                          name: u.get('name'),
                                          image: u.get('image'),
                                          createdAt: u.get('createdAt'),
                                      },
                                  ]),
                              ),
                      )
                    : Promise.resolve(new Map()),
                CommentReaction.reactionsFor(commentIds),
            ]);

            for (const row of rows) {
                row._user = userMap.get(row.userId) ?? null;
                row.reactions = reactionsMap.get(row.id) ?? {};
            }
        } catch {
            // Non-fatal: comments still returned without user/reaction enrichment
        }
    }

    return jsonResponse(result.data, result.status);
}

/**
 * Group-membership models whose generic-CRUD mutations must invalidate the
 * security-context membership cache. (organization_members is blocked from
 * this endpoint; the admin member routes invalidate directly.)
 */
const GROUP_MEMBERSHIP_MODELS = new Set(['user_groups', 'user_group_members']);
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Resolve which users' membership caches a CRUD mutation affects.
 *
 * - user_group_members: the target user (from the body, or read from the row
 *   before an id-based update/delete removes it).
 * - user_groups: the acting user — their created-groups set feeds
 *   groupIdsForUser. Other members of a mutated/deleted group converge via the
 *   cache TTL (their cached group id points at a gone/renamed group — benign).
 *
 * Best-effort: failures return what was resolved so far; the TTL bounds staleness.
 */
async function resolveAffectedMembershipUsers(
    crudRequest: { model: string; method: string; id?: string | number; body?: unknown },
    securityContext: { userId?: string | null },
): Promise<string[]> {
    if (!GROUP_MEMBERSHIP_MODELS.has(crudRequest.model) || !MUTATING_METHODS.has(crudRequest.method)) {
        return [];
    }

    const affected = new Set<string>();
    if (securityContext.userId) {
        affected.add(String(securityContext.userId));
    }

    if (crudRequest.model === 'user_group_members') {
        const bodyUserId = (crudRequest.body as { userId?: unknown } | undefined)?.userId;
        if (typeof bodyUserId === 'string' && bodyUserId) {
            affected.add(bodyUserId);
        } else if (crudRequest.id !== undefined && crudRequest.id !== null) {
            try {
                const record = await UserGroupMember.find(String(crudRequest.id));
                const uid = record?.get('userId');
                if (uid) affected.add(String(uid));
            } catch {
                // Row unreadable — TTL bounds the residual staleness.
            }
        }
    }

    return [...affected];
}

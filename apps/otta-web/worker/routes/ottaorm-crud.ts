import { getSession, hashPassword } from '@ottabase/auth/backend';
import { Comment, CommentReaction } from '@ottabase/comments';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { Post } from '@ottabase/ottablog';
import { executeSecureCrudRequest, parseCrudRequest, registerConnection } from '@ottabase/ottaorm';
import { Organization, OrganizationMember, User, UserGroupMember } from '@ottabase/ottaorm/models';
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
 *
 * `ambient` is the caller's ORIGINAL (pre-org-swap) security context, and `commentOrgId` is the
 * comment's resolved org. Moderation is ORG-scoped, so `comments:moderate`/`*:*` is honored only
 * when the caller is acting within the comment's own org (or is a platform admin) — otherwise a
 * moderator in org Y could edit/soft-delete a comment on a PUBLIC post belonging to org X.
 * Authorship stays identity-based and works across orgs.
 */
function isCommentOwnerOrModerator(
    comment: { get(field: string): unknown },
    session: any,
    ambient: Awaited<ReturnType<typeof getSecurityContext>>,
    commentOrgId: string | null,
): boolean {
    const userId = session?.user?.id;
    if (userId && comment.get('userId') === userId) return true;
    if (ambient.platformAdmin) return true;
    // Org-scoped moderation authority only applies inside the comment's own org.
    if (ambient.organizationId == null || ambient.organizationId !== commentOrgId) return false;
    const permissions = (ambient.permissions as string[] | undefined) ?? [];
    return permissions.includes('*:*') || permissions.includes('comments:moderate');
}

/** Wildcard-aware permission match (2-segment resource:action; '*:*' grants all). */
function permissionMatches(perms: readonly string[] | undefined, required: string): boolean {
    const list = perms ?? [];
    if (list.includes(required)) return true;
    const [reqResource, reqAction] = required.split(':');
    for (const perm of list) {
        const [permResource, permAction] = perm.split(':');
        if (permResource === '*' && permAction === '*') return true;
        if (
            (permResource === '*' || permResource === reqResource) &&
            (permAction === '*' || permAction === reqAction)
        ) {
            return true;
        }
    }
    return false;
}

/**
 * App-global blog taxonomy: one shared vocabulary per app (no organizationId column), referenced
 * by every tenant's posts. Its RLS is AppScoped with NO role/permission requirement, so generic
 * CRUD would let ANY caller — even unauthenticated — create/rename/delete every tenant's tags,
 * categories, and series, and attach them to any post via the public-writable link tables.
 * Reads stay open (the editor lists them); WRITES require org:admin, i.e. an authenticated content
 * administrator (a platform owner satisfies this via '*:*'). Deeper per-post-ownership scoping of
 * the junction links is a larger RLS change tracked separately.
 */
const APP_TAXONOMY_MODELS = new Set([
    'series',
    'categories',
    'tags',
    'post_tags',
    'post_tag_links',
    'post_category_links',
]);

const CRUD_WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Methods that mutate or destroy an EXISTING organization row (i.e. everything except create).
 * PUT is included deliberately: secure CRUD treats PUT as a full update exactly like PATCH, so any
 * authorization gate that lists only PATCH/DELETE leaves PUT as a silent bypass.
 */
const ORG_MUTATING_METHODS = new Set(['PATCH', 'PUT', 'DELETE']);

/**
 * DEFAULT-DENY allowlist for the generic `/api/ottaorm/*` route. ONLY these app-data models may be
 * read/written through generic CRUD; every other model is refused. That deliberately closes:
 *  - grant/auth/system tables (user_roles, user_group_members, sessions, accounts, authenticators,
 *    audit_logs, kill switches, …) — accessed server-side or via dedicated admin endpoints, never here,
 *  - app-global control-plane data (menus, menu_items, menu_slot_assignments, ottablog_themes/plugins,
 *    shortlinks, scheduled_tasks, …) — managed through their own scope-gated routes.
 *
 * This replaces the old DENYLIST, which repeatedly missed sensitive tables (first `user_roles`, then
 * `user_group_members`): a newly-added model is now closed by default until it is explicitly listed
 * here. The specific hard-blocks above are kept ONLY for their more helpful "use X endpoint" hints.
 * If you add a model that the frontend drives through generic CRUD, add it here (and give it a real
 * RLS policy).
 */
const GENERIC_CRUD_ALLOWLIST = new Set([
    // Blog / content
    'posts',
    'post_versions',
    'series',
    'categories',
    'tags',
    'post_tags',
    'post_tag_links',
    'post_category_links',
    // Media library
    'media',
    // Comments (org is derived from the target entity, special-cased below)
    'comments',
    // Organizations (member-scoped reads; a create also provisions the owner membership below)
    'organizations',
    // Demo data-table
    'todos',
]);

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

    // RBAC grant + definition tables. These GRANT the very roles/permissions the whole auth layer
    // reads from, so generic CRUD on them is a privilege-escalation vector — `user_roles` in
    // particular is org-scoped (its TenantScoped RLS FUNCTIONS but carries no permission gate), so
    // without this block an anonymous `POST /api/ottaorm/user_roles {roleId:<platform_owner>,
    // organizationId:'system'}` mints a real platform_owner grant, and `GET` dumps every grant.
    // (`roles`/`permissions` are additionally fail-closed today only by an RLS-field/column mismatch
    // — do NOT rely on that; this block is the real gate.) Manage roles via /api/admin/roles and
    // grants via the org-members / promote endpoints, all of which are properly scope-gated.
    //
    // NOTE: this hard-block list is a DENYLIST — every sensitive model must be remembered here. That
    // is fragile (this table was the miss that motivated the block). Treat any new grant-bearing or
    // system table as internal until it has an explicit permission gate.
    if (crudRequest.model === 'user_roles' || crudRequest.model === 'roles' || crudRequest.model === 'permissions') {
        return errorResponse('RBAC role/permission CRUD is disabled via OttaORM', 403, {
            code: 'CRUD_DISABLED',
            hint: 'Use /api/admin/roles (role definitions) and the org-members / platform-owner promote endpoints (grants) — all platform-admin scoped.',
        });
    }

    if (crudRequest.model === 'shortlinks') {
        // The shortlinks RLS policy is platform-admin gated (requirePlatformAdmin, registry.ts), so
        // generic CRUD is no longer open to org owners. This hard-block is retained as API design +
        // defense-in-depth: all shortlink management goes through the dedicated /api/shortlinks
        // routes (requireAdminAccess({ scope: 'system' })), which own analytics and slug handling.
        return errorResponse('Shortlinks CRUD is disabled via OttaORM', 403, {
            code: 'CRUD_DISABLED',
            hint: 'Use /api/shortlinks endpoints (platform-admin scoped)',
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
        // scheduled_tasks carries RLSPolicies.AdminOnly(), which now gates on the scope-aware
        // `platformAdmin` flag (requirePlatformAdmin) rather than a role NAME, so it correctly
        // restricts to platform admins. This hard-block is retained as API design +
        // defense-in-depth: management goes through /api/admin/cron (requireAdminAccess({ scope:
        // 'system' })), which owns run history and scheduling semantics.
        return errorResponse('Scheduled tasks CRUD is disabled via OttaORM', 403, {
            code: 'CRUD_DISABLED',
            hint: 'Use /api/admin/cron endpoints (platform-admin scoped)',
        });
    }

    // DEFAULT-DENY: anything not explicitly allow-listed for generic CRUD is refused. This closes
    // grant/auth/system + app-global control-plane tables (e.g. user_group_members,
    // menu_slot_assignments, ottablog_themes/plugins, audit_logs) by default, instead of relying on
    // the denylist above to remember every one — see GENERIC_CRUD_ALLOWLIST.
    if (!GENERIC_CRUD_ALLOWLIST.has(crudRequest.model)) {
        return errorResponse(`Generic CRUD is not enabled for '${crudRequest.model}'`, 403, {
            code: 'CRUD_NOT_ALLOWED',
            hint: 'This model is not exposed via /api/ottaorm; use its dedicated endpoint.',
        });
    }

    // App-global taxonomy writes require an authenticated content administrator — see
    // APP_TAXONOMY_MODELS. Reads (GET) fall through unchanged so the blog editor can list them.
    if (APP_TAXONOMY_MODELS.has(crudRequest.model) && CRUD_WRITE_METHODS.has(crudRequest.method)) {
        if (!permissionMatches(securityContext.permissions as string[] | undefined, 'org:admin')) {
            return errorResponse('Blog taxonomy changes require an organization administrator', 403, {
                code: 'FORBIDDEN',
            });
        }
    }

    // Mutating or deleting an organization requires owner/admin authority in the TARGET org. The
    // organizations RLS policy only scopes rows to the caller's memberships (ANY role) with no
    // permission/role gate, so without this a plain member could rewrite name/slug/metadata/settings
    // or DELETE the org outright (orphaning every other member + all org-scoped posts/media/comments).
    // Stripping plan/status below is not enough. POST (create) stays open — the creator isn't a
    // member until membership is provisioned right after insert (see the organizations POST block
    // below). Gate on the target org id (crudRequest.id), never the caller's ambient active org.
    // NOTE: PUT must be included — secure CRUD treats PUT as a full update just like PATCH, so
    // listing only PATCH/DELETE here would leave PUT as an unguarded bypass.
    if (
        crudRequest.model === 'organizations' &&
        ORG_MUTATING_METHODS.has(crudRequest.method) &&
        !securityContext.platformAdmin
    ) {
        const actorId = session?.user?.id;
        const targetOrgId = crudRequest.id;
        if (!actorId || !targetOrgId || !(await OrganizationMember.isOwnerOrAdmin(actorId, targetOrgId))) {
            return errorResponse('Only an organization owner or admin can modify or delete the organization', 403, {
                code: 'FORBIDDEN',
            });
        }
    }

    // Organization plan/status are billing/lifecycle fields owned by the PLATFORM, not self-service.
    // The organizations RLS policy scopes rows to the caller's memberships but does not check the
    // membership ROLE, so without this any member could self-upgrade `plan` or flip `status` on
    // their own org. Strip both from non-platform-admin writes (a platform owner passes untouched).
    // PUT is included for the same reason as the guard above.
    if (
        crudRequest.model === 'organizations' &&
        crudRequest.body &&
        (crudRequest.method === 'POST' || crudRequest.method === 'PATCH' || crudRequest.method === 'PUT') &&
        !securityContext.platformAdmin
    ) {
        const body = crudRequest.body as Record<string, unknown>;
        delete body.plan;
        delete body.status;
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
                // tenant scoping is not authorship. Pass the AMBIENT (pre-swap) context and the
                // comment's org so moderation authority is scoped to the comment's own org and
                // can't be exercised cross-tenant via the caller's other-org permissions.
                if (!isCommentOwnerOrModerator(comment, session, securityContext, orgResolution.organizationId)) {
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
                // The org row was inserted but its owner membership was not. Since the tenant
                // boundary (organizationIdsForUser) is membership-only, that would ORPHAN the org —
                // the creator couldn't even reach the org they just made. Compensating-delete the
                // org so creation is all-or-nothing (best-effort atomicity without a cross-table txn).
                try {
                    await Organization.delete(orgId);
                } catch (rollbackErr) {
                    console.error('Failed to roll back orphaned organization', orgId, rollbackErr);
                }
                return errorResponse(
                    'Failed to create organization; membership setup failed and was rolled back',
                    500,
                    {
                        code: 'ORG_MEMBER_CREATE_FAILED',
                        details: err instanceof Error ? err.message : 'Unknown error',
                    },
                );
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

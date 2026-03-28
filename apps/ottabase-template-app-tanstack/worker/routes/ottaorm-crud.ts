import { getSession, hashPassword } from '@ottabase/auth/backend';
import { Comment } from '@ottabase/comments';
import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { Post } from '@ottabase/ottablog';
import { executeSecureCrudRequest, parseCrudRequest, registerConnection } from '@ottabase/ottaorm';
import { OrganizationMember, User } from '@ottabase/ottaorm/models';
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
    const securityContext = await getSecurityContext(request, session);
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

    if (
        crudRequest.model === 'posts' &&
        crudRequest.body &&
        (crudRequest.method === 'POST' || crudRequest.method === 'PATCH')
    ) {
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
        const user = session?.user;
        (crudRequest.body as any).authorId = user?.id ?? (crudRequest.body as any).authorId ?? null;
        (crudRequest.body as any).authorName = user?.name ?? (crudRequest.body as any).authorName ?? null;
        (crudRequest.body as any).authorEmail = user?.email ?? (crudRequest.body as any).authorEmail ?? null;
        (crudRequest.body as any).userId = user?.id ?? (crudRequest.body as any).userId ?? null;
        (crudRequest.body as any).organizationId = securityContext.organizationId ?? null;
        (crudRequest.body as any).appId = securityContext.appId ?? (crudRequest.body as any).appId ?? 'web';
    }

    if (
        crudRequest.model === 'changelog_entries' &&
        crudRequest.body &&
        (crudRequest.method === 'POST' || crudRequest.method === 'PATCH')
    ) {
        const user = session?.user;
        (crudRequest.body as any).authorId = user?.id ?? (crudRequest.body as any).authorId ?? null;
        (crudRequest.body as any).authorName = user?.name ?? (crudRequest.body as any).authorName ?? null;
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

import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { getSession, hashPassword } from '@ottabase/auth/backend';
import { getAuthOptions } from '../lib/auth-utils';
import { parseCrudRequest, executeSecureCrudRequest, registerConnection } from '@ottabase/ottaorm';
import { getSecurityContext } from '../lib/auth-utils';
import { Post } from '@ottabase/ottablog';
import { Menu } from '@ottabase/ottamenu/persistence';
import { OrganizationMember } from '@ottabase/ottaorm/models';
import type { CloudflareEnv } from '../../cloudflare-env';

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

    // Menu items: inject appId from parent menu on create (denormalized for RLS)
    if (crudRequest.model === 'menu_items' && crudRequest.body && crudRequest.method === 'POST') {
        const menuId = (crudRequest.body as any).menuId;
        if (menuId) {
            const menu = await Menu.find(menuId);
            if (menu) {
                (crudRequest.body as any).appId = menu.get('appId') ?? securityContext.appId ?? null;
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

    return jsonResponse(result.data, result.status);
}

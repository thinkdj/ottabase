import { createD1Driver } from '@ottabase/db/drizzle-d1';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { getSession, hashPassword } from '@ottabase/auth/backend';
import { getAuthOptions } from '../lib/auth-utils';
import { parseCrudRequest, executeSecureCrudRequest, registerConnection } from '@ottabase/ottaorm';
import { AuditLog } from '@ottabase/ottaorm/models';
import { getSecurityContext } from '../lib/auth-utils';
import { Post } from '@ottabase/ottablog';
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
    }

    const result = await executeSecureCrudRequest(crudRequest, securityContext);

    if (result.success && ['POST', 'PATCH', 'DELETE'].includes(crudRequest.method)) {
        const userId = session?.user?.id;
        const userEmail = (session?.user as any)?.email;
        const actionMap: Record<string, string> = { POST: 'create', PATCH: 'update', DELETE: 'delete' };
        AuditLog.log({
            userId,
            userEmail,
            action: actionMap[crudRequest.method] || crudRequest.method.toLowerCase(),
            resourceType: `crud:${crudRequest.model}`,
            resourceId: crudRequest.id || (result.data as any)?.id || undefined,
            metadata: { model: crudRequest.model, method: crudRequest.method },
        }).catch(() => {});
    }

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

    return jsonResponse(result.data, result.status);
}

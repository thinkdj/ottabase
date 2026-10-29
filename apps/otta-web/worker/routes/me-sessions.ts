/**
 * The signed-in user's own sessions (the /sessions page).
 *
 * - `GET    /api/users/me/sessions`                 list, newest first, `current` marked
 * - `PATCH  /api/users/me/sessions/:id { name }`    rename (1 to 40 chars)
 * - `DELETE /api/users/me/sessions/:id`             revoke; the current one signs out (cookie cleared)
 * - `POST   /api/users/me/sessions/revoke-others`   revoke every other session
 *
 * Ids are opaque HMACs of the jti; the helpers map them back by listing the caller's own keys,
 * so no request can ever reach another user's session.
 */
import {
    buildClearSessionCookie,
    getSession,
    listUserSessions,
    readSessionIdentity,
    renameUserSession,
    revokeOtherUserSessions,
    revokeSession,
    revokeUserSessionById,
    sessionPublicId,
} from '@ottabase/auth/backend';
import { errorResponse, redactErrorForLog } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { getAuthOptions } from '../lib/auth-utils';
import { readJson } from '../lib/utils';
import type { ApiRouteContext } from './router';

const NO_STORE = { headers: { 'Cache-Control': 'private, no-store' } };
const PUBLIC_ID = /^[A-Za-z0-9_-]{16,32}$/;

async function requireIdentity(context: ApiRouteContext) {
    const { request, env } = context;
    const session = await getSession(request, env as never, getAuthOptions(env));
    const identity = await readSessionIdentity(request, env as never);
    if (!session?.user?.id || !identity || identity.userId !== session.user.id) {
        return errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
    }
    return identity;
}

export async function handleMeSessionsList(context: ApiRouteContext): Promise<Response> {
    const identity = await requireIdentity(context);
    if (identity instanceof Response) return identity;
    try {
        const sessions = await listUserSessions(identity.userId, context.env as never, identity.jti);
        return jsonResponse({ sessions }, 200, NO_STORE);
    } catch (error) {
        console.error(JSON.stringify({ event: 'me_sessions_list_failed', error: redactErrorForLog(error) }));
        return errorResponse('Could not list sessions', 500, { code: 'SESSIONS_UNAVAILABLE' });
    }
}

export async function handleMeSessionRename(context: ApiRouteContext, id: string): Promise<Response> {
    const identity = await requireIdentity(context);
    if (identity instanceof Response) return identity;
    if (!PUBLIC_ID.test(id)) return errorResponse('Session not found', 404, { code: 'SESSION_NOT_FOUND' });
    const body = await readJson<{ name?: unknown }>(context.request);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 40) {
        return errorResponse('Validation failed', 400, {
            code: 'VALIDATION_ERROR',
            fieldErrors: { name: ['Name must be 1 to 40 characters'] },
        });
    }
    const renamed = await renameUserSession(identity.userId, id, name, context.env as never);
    if (!renamed) return errorResponse('Session not found', 404, { code: 'SESSION_NOT_FOUND' });
    return jsonResponse(
        { session: { ...renamed, current: id === (await sessionPublicId(identity.jti, context.env as never)) } },
        200,
        NO_STORE,
    );
}

export async function handleMeSessionRevoke(context: ApiRouteContext, id: string): Promise<Response> {
    const identity = await requireIdentity(context);
    if (identity instanceof Response) return identity;
    if (!PUBLIC_ID.test(id)) return errorResponse('Session not found', 404, { code: 'SESSION_NOT_FOUND' });
    const { request, env } = context;
    const options = getAuthOptions(env);

    // Revoking the current session is a sign-out: tombstone it and clear the cookie.
    if (id === (await sessionPublicId(identity.jti, env as never))) {
        await revokeSession(identity.userId, identity.jti, env as never, options);
        return jsonResponse({ signedOut: true }, 200, {
            headers: { ...NO_STORE.headers, 'Set-Cookie': buildClearSessionCookie(env as never, request) },
        });
    }

    const revoked = await revokeUserSessionById(identity.userId, id, env as never, options);
    if (!revoked) return errorResponse('Session not found', 404, { code: 'SESSION_NOT_FOUND' });
    return jsonResponse({ revoked: true }, 200, NO_STORE);
}

export async function handleMeSessionsRevokeOthers(context: ApiRouteContext): Promise<Response> {
    const identity = await requireIdentity(context);
    if (identity instanceof Response) return identity;
    const count = await revokeOtherUserSessions(
        identity.userId,
        identity.jti,
        context.env as never,
        getAuthOptions(context.env),
    );
    return jsonResponse({ revoked: count }, 200, NO_STORE);
}

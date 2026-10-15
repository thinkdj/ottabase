// ============================================================
// Who is calling: one operator, one token
// ============================================================
// This app shape has no users and no sessions. `Authorization: Bearer <ADMIN_TOKEN>` is
// the platform admin; everyone else is anonymous. Package routes that take a
// `resolveCaller` get exactly that. When the app grows users, add @ottabase/auth and
// swap this for a session lookup (apps/otta-web/ottabase/packages/caller.ts).
// ============================================================

import { errorResponse } from '@ottabase/utils/http-errors';
import { getOttabaseConfig, isDevelopment } from '../config.loader';

export interface PackageCaller {
    userId: string;
    organizationId: string | null;
    appId: string;
    email: string | null;
    platformAdmin: boolean;
    canManage: boolean;
}

function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

function presentedToken(request: Request): string | null {
    const header = request.headers.get('authorization') ?? '';
    return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() || null : null;
}

/** True when the request carries the operator token. Never true when no token is configured. */
export function isOperator(request: Request, env: CloudflareEnv): boolean {
    const expected = env.ADMIN_TOKEN?.trim();
    const presented = presentedToken(request);
    return !!expected && !!presented && timingSafeEqual(presented, expected);
}

/** The operator as a package caller, or null. */
export async function resolvePackageCaller(request: Request, env: CloudflareEnv): Promise<PackageCaller | null> {
    if (!isOperator(request, env)) return null;
    return {
        userId: 'operator',
        organizationId: null,
        appId: getOttabaseConfig(env).appId,
        email: null,
        platformAdmin: true,
        canManage: true,
    };
}

/**
 * Guard for the app's own operator routes. Local development (ENVIRONMENT=development) is
 * open, like otta-web's migration routes; anywhere else the token is required, and an
 * unset token fails closed with a message that says what to set.
 */
export function requireOperator(request: Request, env: CloudflareEnv): Response | null {
    if (isDevelopment(env)) return null;
    if (!env.ADMIN_TOKEN?.trim()) {
        return errorResponse('ADMIN_TOKEN is not set; set it with `wrangler secret put ADMIN_TOKEN`', 503, {
            code: 'NOT_CONFIGURED',
        });
    }
    return isOperator(request, env) ? null : errorResponse('Unauthorized', 401, { code: 'UNAUTHORIZED' });
}

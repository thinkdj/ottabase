import { Role, User } from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { SYSTEM_ORGANIZATION_ID } from '../lib/admin-guard';
import { initDbConnection } from '../lib/db-utils';
import { readJson } from '../lib/utils';
import type { ApiRouteContext } from './router';

function clean(value: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
    return trimmed;
}

export async function handleAdminPromoteOwner(context: ApiRouteContext): Promise<Response> {
    const { env, request } = context;
    initDbConnection(env);

    const secret = env.BOOTSTRAP_OWNER_SECRET;
    if (!secret) {
        return errorResponse('Promotion secret is not configured', 500, { code: 'CONFIG_ERROR' });
    }

    const headerSecret = clean(request.headers.get('x-bootstrap-secret'));
    const querySecret = clean(context.url.searchParams.get('secret'));

    let bodySecret: string | null = null;
    let userId: string | undefined;
    let email: string | undefined;

    try {
        const body = await readJson<{ secret?: string; userId?: string; email?: string }>(request);
        bodySecret = clean(body.secret || null);
        userId = body.userId || undefined;
        email = body.email || undefined;
    } catch {
        // ignore malformed JSON
    }

    const providedSecret = headerSecret || bodySecret || querySecret;
    if (providedSecret !== secret) {
        return errorResponse('Forbidden', 403, { code: 'FORBIDDEN' });
    }

    if (!userId && !email) {
        return errorResponse('userId or email is required', 400, { code: 'VALIDATION_ERROR' });
    }

    const user = userId ? await User.find(userId) : await User.first({ email });
    if (!user) {
        return errorResponse('User not found', 404, { code: 'NOT_FOUND' });
    }

    await Role.ensureDefaultRoles();
    const ownerRole = await Role.findByName('owner');
    if (!ownerRole) {
        return errorResponse('Owner role is missing', 500, { code: 'ROLE_MISSING' });
    }

    await user.assignRole(ownerRole.get('id') as string, undefined, SYSTEM_ORGANIZATION_ID);

    return jsonResponse({
        success: true,
        userId: user.get('id'),
        role: ownerRole.get('name'),
        organizationId: SYSTEM_ORGANIZATION_ID,
    });
}

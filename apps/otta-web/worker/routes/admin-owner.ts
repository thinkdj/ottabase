import { PLATFORM_OWNER_ROLE_NAME, Role, User, UserRole } from '@ottabase/ottaorm/models';
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

function constantTimeEqual(a: string, b: string): boolean {
    const encoder = new TextEncoder();
    const bufA = encoder.encode(a);
    const bufB = encoder.encode(b);
    if (bufA.byteLength !== bufB.byteLength) return false;
    let result = 0;
    for (let i = 0; i < bufA.byteLength; i++) {
        result |= bufA[i] ^ bufB[i];
    }
    return result === 0;
}

export async function handleAdminPromotePlatformOwner(context: ApiRouteContext): Promise<Response> {
    const { env, request } = context;
    initDbConnection(env);

    const secret = env.BOOTSTRAP_OWNER_SECRET;
    if (!secret) {
        return errorResponse('Promotion secret is not configured', 500, { code: 'CONFIG_ERROR' });
    }

    const headerSecret = clean(request.headers.get('x-bootstrap-secret'));

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

    const providedSecret = headerSecret || bodySecret;
    if (!providedSecret || !constantTimeEqual(providedSecret, secret)) {
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
    const platformOwnerRole = await Role.findByName(PLATFORM_OWNER_ROLE_NAME);
    if (!platformOwnerRole) {
        return errorResponse('Platform owner role is missing', 500, { code: 'ROLE_MISSING' });
    }

    const roleId = platformOwnerRole.get('id') as string;
    const existingGrants = await UserRole.where({
        roleId,
        organizationId: SYSTEM_ORGANIZATION_ID,
    });
    if (existingGrants.length > 0) {
        const existingIds = existingGrants.map((g: any) => g.get('userId'));
        console.warn(
            `[platform-owner] Promoting user ${user.get('id')} to platform_owner while ` +
                `${existingGrants.length} existing grant(s) exist (user IDs: ${existingIds.join(', ')})`,
        );
    }

    await user.assignRole(roleId, undefined, SYSTEM_ORGANIZATION_ID);

    return jsonResponse({
        success: true,
        userId: user.get('id'),
        role: platformOwnerRole.get('name'),
        organizationId: SYSTEM_ORGANIZATION_ID,
    });
}

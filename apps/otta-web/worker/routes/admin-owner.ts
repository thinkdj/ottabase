import { provisionPlatformOwnerOrganization } from '@ottabase/auth/backend';
import { PLATFORM_OWNER_ROLE_NAME, Role, User, UserRole } from '@ottabase/ottaorm/models';
import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { SYSTEM_ORGANIZATION_ID } from '../lib/admin-guard';
import { reconcileSystemRoleSessions } from '../lib/auth-utils';
import { initDbConnection } from '../lib/db-utils';
import { enforceBruteForceThrottle } from '../lib/rate-limiting';
import { getClientIpAddress, normalizeEmail, readJson } from '../lib/utils';
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

    // Rate-limit by IP before the secret compare, so this grant-of-ultimate-privilege endpoint can't
    // be brute-forced — matching the throttling on register/reset. Throttled BEFORE reading the body.
    // enforceBruteForceThrottle fails OPEN with a logged warning if the limiter binding is missing (a
    // real 429 still blocks) — the secret compare below is the authoritative gate, and this shares the
    // exact policy the bootstrap secret check uses so break-glass recovery isn't bricked by a missing
    // limiter binding.
    const ip = getClientIpAddress(request);
    const rateLimited = await enforceBruteForceThrottle(
        request,
        env,
        `admin:promote-owner:${ip}`,
        'platform-owner promote',
    );
    if (rateLimited) return rateLimited;

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
        // Normalize like every other account path (login/register/reset) — a plain unique email
        // column is case-sensitive, so a correct-but-miscased address must not 404 this break-glass tool.
        email = typeof body.email === 'string' && body.email.trim() ? normalizeEmail(body.email) : undefined;
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
    const targetUserId = String(user.get('id'));
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

    let personalOrganizationId: string | null;
    try {
        // Provision the tenant facts before granting system authority. If this fails,
        // no platform-owner grant has been written and there is nothing privileged to
        // compensate or race with another promotion request.
        personalOrganizationId = await provisionPlatformOwnerOrganization(env, {
            id: targetUserId,
            email: (user.get('email') as string | null) ?? null,
            name: (user.get('name') as string | null) ?? null,
        });
    } catch (error) {
        console.error('[platform-owner] Workspace provisioning failed during promotion:', error);
        return errorResponse('Platform owner workspace setup could not be completed. Please try again.', 500, {
            code: 'ACCOUNT_PROVISIONING_FAILED',
            exposure: 'public',
        });
    }

    try {
        await user.assignRole(roleId, undefined, SYSTEM_ORGANIZATION_ID);
    } catch (error) {
        // User.assignRole() intentionally keeps model-level behavior simple, but two
        // identical promotion requests can race its read-before-insert. A duplicate
        // is success only after the desired system-scoped grant is authoritative.
        const persistedGrant = await UserRole.first({
            userId: targetUserId,
            roleId,
            organizationId: SYSTEM_ORGANIZATION_ID,
        });
        if (!persistedGrant) {
            throw error;
        }
    }

    // Make the grant take effect on the target's live session. Without this the endpoint returns
    // success while the promoted user's cached session snapshot keeps platformAdmin=false (and the
    // RBAC cache omits the grant) until the ~30-day JWT expires — so they stay blocked from the
    // control plane. reconcileSystemRoleSessions drops the 'rbac:' cache and bumps every
    // platform_owner holder's profile version (now including this user), the same refresh contract
    // the bootstrap seed path uses. Best-effort: no-ops without OBCF_KV and swallows errors, so it
    // can't break the success response.
    await reconcileSystemRoleSessions(env);

    return jsonResponse({
        success: true,
        userId: user.get('id'),
        role: platformOwnerRole.get('name'),
        organizationId: SYSTEM_ORGANIZATION_ID,
        personalOrganizationId,
    });
}

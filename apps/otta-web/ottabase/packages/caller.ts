// ============================================================
// Who is calling, for packages that own tenant data
// ============================================================
// DERIVED SERVER-SIDE FROM A VERIFIED SESSION, never from request headers. `appId` comes
// from `getOttabaseConfig(env)` rather than the browser's `x-app-id`, and the organization
// comes from the session the server issued: a header is a request, not an answer, and this
// value is the only thing separating two customers' rows.
//
// The auth imports are DYNAMIC so that merely loading a manifest stays cheap.
// ============================================================

import { hasGrantedPermission } from '@ottabase/utils/permissions';
import { getOttabaseConfig } from '../config.loader';

export interface PackageCaller {
    userId: string;
    organizationId: string | null;
    appId: string;
    /** Session email, for packages that mail or bill the caller. */
    email: string | null;
    /** Platform (system-scoped) administrator: the operator of the deployment. */
    platformAdmin: boolean;
    /** May manage the organization's own settings and resources. */
    canManage: boolean;
}

export async function resolvePackageCaller(request: Request, env: CloudflareEnv): Promise<PackageCaller | null> {
    const [{ getSession }, { getAuthOptions }] = await Promise.all([
        import('@ottabase/auth/backend'),
        import('../../worker/lib/auth-utils'),
    ]);
    const session = await getSession(request, env as never, getAuthOptions(env));
    const user = session?.user;
    if (!user?.id) return null;
    const permissions = (user.permissions as string[] | undefined) ?? [];
    const platformAdmin = hasGrantedPermission(permissions, '*:*');
    return {
        userId: user.id,
        organizationId: (user.organizationId as string | null | undefined) ?? null,
        appId: getOttabaseConfig(env).appId,
        email: (user.email as string | null | undefined) ?? null,
        platformAdmin,
        canManage: platformAdmin || hasGrantedPermission(permissions, 'org:admin'),
    };
}

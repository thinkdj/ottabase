// ============================================================
// Outbound webhooks — the Premium Package that ships with Ottabase as the worked example
// ============================================================
// Delete this file and its entry in `../packages.ts` (and the dependency) in a real app
// unless you actually want it. It is here so the premium framework has something real to
// demonstrate: a free tier of one endpoint, a licensed ceiling of 25, and a delivery log
// behind a feature gate.
// ============================================================

import { createWebhooksPackage } from '@ottabase/premium-webhooks';
import { hasGrantedPermission } from '@ottabase/utils/permissions';
import { reserveWebhookEndpointSlot, synchronizeWebhookEndpointQuota } from '../../worker/lib/webhook-endpoint-quota';
import { getOttabaseConfig } from '../config.loader';

/**
 * Resolve who is calling, for packages that own tenant data.
 *
 * DERIVED SERVER-SIDE FROM A VERIFIED SESSION, never from request headers. `appId` comes
 * from `getOttabaseConfig(env)` rather than the browser's `x-app-id`, and the
 * organization comes from the session the server issued: a header is a request, not an
 * answer, and this value is the only thing separating two customers' rows.
 *
 * The auth imports are DYNAMIC so that merely loading the manifest stays cheap.
 */
async function resolveCaller(request: Request, env: CloudflareEnv) {
    const [{ getSession }, { getAuthOptions }] = await Promise.all([
        import('@ottabase/auth/backend'),
        import('../../worker/lib/auth-utils'),
    ]);
    const session = await getSession(request, env as never, getAuthOptions(env));
    const user = session?.user;
    if (!user?.id) return null;
    const permissions = (user.permissions as string[] | undefined) ?? [];
    return {
        userId: user.id,
        organizationId: (user.organizationId as string | null | undefined) ?? null,
        appId: getOttabaseConfig(env).appId,
        canManage: hasGrantedPermission(permissions, 'org:admin') || hasGrantedPermission(permissions, '*:*'),
    };
}

export const webhooksPackage = createWebhooksPackage<CloudflareEnv>({
    resolveCaller,
    events: ['ping'],
    endpointQuota: {
        reserve: reserveWebhookEndpointSlot,
        synchronize: synchronizeWebhookEndpointQuota,
    },
});

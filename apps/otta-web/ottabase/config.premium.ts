// ============================================================
// PREMIUM PACKAGE REGISTRATION  (User-zone)
// ============================================================
// The ONE file you edit to install a Premium Package. Everything else — database
// tables, migrations, model registration, API routes, admin navigation and the
// license gates — is derived from the manifests in `PREMIUM_PACKAGES`.
//
// ── Installing a package ─────────────────────────────────────
//   1. pnpm add @vendor/their-package
//   2. import its manifest (or manifest factory) below
//   3. add it to PREMIUM_PACKAGES
//   4. curl -X POST http://localhost:3004/api/ottaorm/init   (creates its tables)
//   5. Admin → Growth → Premium packages → paste the license key
//
// ── Removing one ─────────────────────────────────────────────
//   Delete it from PREMIUM_PACKAGES. Its routes and nav disappear on the next
//   deploy. Its TABLES are deliberately left alone — dropping customer data as a
//   side effect of an import removal is not recoverable.
//
// ── An app with no Premium Packages ──────────────────────────
//   Leave the array empty. Nothing mounts, nothing is fetched, nothing appears in
//   the admin UI beyond an explicit "none installed" note. That is the default.
// ============================================================

import type { PremiumPackage } from '@ottabase/premium';
import { createWebhooksPackage } from '@ottabase/premium-webhooks';
import { hasGrantedPermission } from '@ottabase/utils/permissions';
import type { CloudflareEnv } from '../cloudflare-env';
import { reserveWebhookEndpointSlot, synchronizeWebhookEndpointQuota } from '../worker/lib/webhook-endpoint-quota';
import { getOttabaseConfig } from './config.loader';

/**
 * Resolve who is calling, for packages that own tenant data.
 *
 * DERIVED SERVER-SIDE FROM A VERIFIED SESSION, never from request headers. `appId` comes
 * from `getOttabaseConfig(env)` rather than the browser's `x-app-id`, and the
 * organization comes from the session the server issued — a header is a request, not an
 * answer, and this value is the only thing separating two customers' rows.
 *
 * The auth imports are DYNAMIC so that merely reading this file's manifests stays cheap:
 * `config.migrations.ts` and `drizzle-kit push` import it for the table list alone, and a
 * static `@ottabase/auth/backend` import would drag the whole auth stack into both.
 */
async function resolveCaller(request: Request, env: CloudflareEnv) {
    const [{ getSession }, { getAuthOptions }] = await Promise.all([
        import('@ottabase/auth/backend'),
        import('../worker/lib/auth-utils'),
    ]);

    const session = await getSession(request, env as never, getAuthOptions(env));
    const user = session?.user;
    if (!user?.id) return null;

    const permissions = (user.permissions as string[] | undefined) ?? [];
    return {
        userId: user.id,
        organizationId: (user.organizationId as string | null | undefined) ?? null,
        appId: getOttabaseConfig(env).appId,
        // Managing a tenant's webhook endpoints is an administrative act: an endpoint is a
        // standing export of that tenant's events to a third party.
        canManage: hasGrantedPermission(permissions, 'org:admin') || hasGrantedPermission(permissions, '*:*'),
    };
}

/**
 * Outbound webhooks — the worked example that ships with Ottabase.
 *
 * Delete this entry (and the dependency) in a real app unless you actually want it. It is
 * here so the premium framework has something real to demonstrate: a free tier of one
 * endpoint, a licensed ceiling of 25, and a delivery log behind a feature gate.
 */
export const webhooksPackage = createWebhooksPackage<CloudflareEnv>({
    resolveCaller,
    // The template only emits the package's built-in signed test delivery. Add product
    // events only beside real, tenant-scoped producers that call dispatchWebhookEvent().
    events: ['ping'],
    endpointQuota: {
        reserve: reserveWebhookEndpointSlot,
        synchronize: synchronizeWebhookEndpointQuota,
    },
});

/** Every Premium Package installed in this app. */
export const PREMIUM_PACKAGES: Array<PremiumPackage<CloudflareEnv>> = [webhooksPackage];

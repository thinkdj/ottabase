// ============================================================
// PAYPORT — Server-only wiring
// ============================================================
//
// Imported ONLY by `worker/` and `ottabase/config.routes.ts`.
// Never import this from `ottabase.config.ts`, client code, or
// anything pulled into the Vite browser bundle — it depends on
// `@ottabase/auth/backend` (which pulls in nodemailer) and on
// every server route handler.
//
// Plans + tables + model registrations live in the client-safe
// sibling `./config.payport.ts` so they can be referenced by
// `ottabase.config.ts` without dragging server deps into the
// browser bundle.
// ============================================================

import { getSession } from '@ottabase/auth/backend';
import { payport, type PaymentProviderName, type SeedPlanInput } from '@ottabase/payport';
import { PolarProvider } from '@ottabase/payport/providers/polar';
import {
    handleActivateLicense,
    handleAdminProvidersInfo,
    handleAdminResyncCustomer,
    handleAdminStats,
    handleBillingPortal,
    handleCancelSubscription,
    handleCreateCheckout,
    handleCreateRefund,
    handleDeactivateLicense,
    handleGetCustomerMeter,
    handleGetEntitlements,
    handleGetSubscription,
    handleListDiscounts,
    handleListPublicPlans,
    handleListRefunds,
    handleRecordUsage,
    handleResumeSubscription,
    handleValidateLicense,
    handleWebhook,
} from '@ottabase/payport/server';
import { requireAdminAccess } from '../worker/lib/admin-guard';
import { getAuthOptions } from '../worker/lib/auth-utils';
import type { ApiRouteContext } from '../worker/routes/router';
import { PAYPORT_ENABLED } from './config.payport';

// ── Default seed plans (first-run only) ───────────────────────
//
// The DB is the canonical source: admins edit plans at /admin/billing.
// These defaults are inserted ONLY when `payment_plans` is empty so
// fresh installs have a working pricing page out-of-the-box. Once
// rows exist (even one) this seeder is a no-op forever.
function defaultSeedPlans(env: Record<string, string | undefined>): SeedPlanInput[] {
    const polarPro = env.POLAR_PRO_PRODUCT_ID;
    return [
        {
            slug: 'free',
            name: 'Free',
            description: 'Get started — no credit card required.',
            features: ['basic.read'],
            priceLabel: '$0/mo',
            priceMonthly: 0,
            priceYearly: 0,
            currency: 'USD',
            displayOrder: 0,
            isDefault: true,
            isPublic: true,
            provider: 'none',
        },
        {
            slug: 'pro',
            name: 'Pro',
            description: 'Everything in Free, plus advanced features.',
            features: ['basic.read', 'basic.write', 'ai.assist'],
            priceLabel: '$19/mo',
            priceMonthly: 1900,
            priceYearly: 19000,
            currency: 'USD',
            displayOrder: 1,
            isPublic: true,
            ...(polarPro ? { provider: 'polar' as const, providerProductId: polarPro } : { provider: 'none' as const }),
        },
    ];
}

// ── Provider + plan bootstrap (idempotent per isolate) ────────
//
// Two-step: register the provider adapter synchronously (cheap),
// then load the plan catalog from the DB on first request. We keep
// the loaded promise so concurrent requests share a single load.
let bootstrapped = false;
let plansLoadPromise: Promise<void> | null = null;

export function bootstrapPayport(env: Record<string, string | undefined>): void {
    if (!PAYPORT_ENABLED || bootstrapped) return;
    if (!env.POLAR_ACCESS_TOKEN || !env.POLAR_WEBHOOK_SECRET) {
        console.warn(
            '[payport] POLAR_ACCESS_TOKEN / POLAR_WEBHOOK_SECRET missing — payport routes will return errors until secrets are set.',
        );
    }
    payport.registerProvider(
        new PolarProvider({
            accessToken: env.POLAR_ACCESS_TOKEN ?? '',
            webhookSecret: env.POLAR_WEBHOOK_SECRET ?? '',
            organizationId: env.POLAR_ORG_ID,
        }),
    );
    bootstrapped = true;
}

/**
 * Hydrate the in-memory plan catalog from the DB (single-flight per isolate).
 * Best-effort — logs and swallows errors so a misconfigured DB doesn't take
 * down the whole worker. Called from `handlePayportRoute` before dispatching.
 */
async function ensurePlansHydrated(env: Record<string, string | undefined>): Promise<void> {
    if (plansLoadPromise) return plansLoadPromise;
    plansLoadPromise = (async () => {
        try {
            await payport.seedPlansIfEmpty(defaultSeedPlans(env));
            await payport.loadPlansFromDb();
        } catch (err) {
            console.error('[payport] failed to hydrate plans from DB:', err);
            // Reset so a later request can retry.
            plansLoadPromise = null;
            throw err;
        }
    })();
    return plansLoadPromise;
}

// ── HTTP dispatcher ───────────────────────────────────────────
// Single function exported into `handleCustomRoutes`. Resolves the
// session lazily — only for routes that need it — and returns null
// when the path isn't a payport route so the framework can fall
// through to the next handler.
async function resolveUserId(context: ApiRouteContext): Promise<string | null> {
    try {
        const session = await getSession(context.request, context.env as never, getAuthOptions(context.env));
        return session?.user?.id ?? null;
    } catch {
        return null;
    }
}

export async function handlePayportRoute(context: ApiRouteContext): Promise<Response | null> {
    if (!PAYPORT_ENABLED) return null;
    if (!context.route.startsWith('/api/payport/')) return null;

    bootstrapPayport(context.env as unknown as Record<string, string | undefined>);
    // Best-effort plan hydration — does not block routes that don't need it
    // (e.g. webhooks, license endpoints), but kicks off the load so subsequent
    // calls hit a warm cache.
    void ensurePlansHydrated(context.env as unknown as Record<string, string | undefined>);

    const { request, route, method } = context;

    // Webhooks first — they verify signatures themselves and don't need a session.
    const webhookMatch = route.match(/^\/api\/payport\/webhooks\/([^/]+)$/);
    if (method === 'POST' && webhookMatch) {
        return handleWebhook({ request, provider: webhookMatch[1] as PaymentProviderName });
    }

    // Public storefront endpoints (no auth required).
    if (method === 'GET' && route === '/api/payport/plans') {
        await ensurePlansHydrated(context.env as unknown as Record<string, string | undefined>);
        return handleListPublicPlans({ request, userId: null });
    }
    if (method === 'GET' && route === '/api/payport/discounts') return handleListDiscounts();
    if (method === 'POST' && route === '/api/payport/license/validate') return handleValidateLicense({ request });
    if (method === 'POST' && route === '/api/payport/license/activate') return handleActivateLicense({ request });
    if (method === 'POST' && route === '/api/payport/license/deactivate') return handleDeactivateLicense({ request });

    // ── Admin routes ──────────────────────────────────────────
    // /api/payport/admin/* is server-side gated here, mirroring the
    // client-side *:* permission check in the admin route factory.
    //
    //   /api/payport/admin/stats       → system admin (owner / admin role)
    //   /api/payport/admin/providers   → super-admin (*:* wildcard)
    //   /api/payport/admin/resync-customer → super-admin (*:* wildcard)
    if (route.startsWith('/api/payport/admin/')) {
        await ensurePlansHydrated(context.env as unknown as Record<string, string | undefined>);
        const ctx = { request, userId: null };

        // Stats page is accessible to any system admin (owner/admin role).
        if (method === 'GET' && route === '/api/payport/admin/stats') {
            const auth = await requireAdminAccess(context, { scope: 'system' });
            if (auth instanceof Response) return auth;
            return handleAdminStats(ctx);
        }

        // Providers info and resync-customer expose provider credentials + allow
        // arbitrary customer mutations — require the *:* super-admin permission.
        if (method === 'GET' && route === '/api/payport/admin/providers') {
            const auth = await requireAdminAccess(context, { scope: 'system', requiredPermissions: ['*:*'] });
            if (auth instanceof Response) return auth;
            return handleAdminProvidersInfo(ctx);
        }

        if (method === 'POST' && route === '/api/payport/admin/resync-customer') {
            const auth = await requireAdminAccess(context, { scope: 'system', requiredPermissions: ['*:*'] });
            if (auth instanceof Response) return auth;
            return handleAdminResyncCustomer(ctx);
        }

        // Unknown /admin/* route — fall through to 404.
        return null;
    }

    // ── Session-gated user routes ─────────────────────────────
    // Everything below needs a session (handlers themselves enforce 401).
    const userId = await resolveUserId(context);
    // Make sure plan catalog is loaded before any handler that calls
    // resolvePlanBySlug (checkout, entitlements, subscription views).
    await ensurePlansHydrated(context.env as unknown as Record<string, string | undefined>);
    const ctx = { request, userId };

    if (method === 'POST') {
        if (route === '/api/payport/checkout') return handleCreateCheckout(ctx);
        if (route === '/api/payport/portal') return handleBillingPortal(ctx);
        if (route === '/api/payport/subscription/cancel') return handleCancelSubscription(ctx);
        if (route === '/api/payport/subscription/resume') return handleResumeSubscription(ctx);
        if (route === '/api/payport/usage') return handleRecordUsage(ctx);
        if (route === '/api/payport/refunds') return handleCreateRefund(ctx);
    }
    if (method === 'GET') {
        if (route === '/api/payport/subscription') return handleGetSubscription(ctx);
        if (route === '/api/payport/entitlements') return handleGetEntitlements(ctx);
        if (route === '/api/payport/refunds') return handleListRefunds(ctx);
        const meterMatch = route.match(/^\/api\/payport\/meters\/([^/]+)$/);
        if (meterMatch) return handleGetCustomerMeter(ctx, decodeURIComponent(meterMatch[1]));
    }

    return null;
}

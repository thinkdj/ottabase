// ============================================================
// Payport — Admin HTTP routes
// ============================================================
//
// Endpoints powering the @ottabase/payport/admin React pages:
//
//   GET /api/payport/admin/stats     → PayportDashboardStats
//   GET /api/payport/admin/providers → PayportProvidersInfo
//
// Authentication / authorization is the host app's responsibility:
// gate these in your router behind a super-admin permission
// (`*:*` wildcard or equivalent) before invoking the handlers.
// ============================================================

import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import {
    PaymentCustomer,
    PaymentDiscount,
    PaymentEvent,
    PaymentLicenseKey,
    PaymentMeter,
    PaymentPlan,
    PaymentProduct,
    PaymentRefund,
    PaymentSubscription,
} from '../models';
import { payport } from '../payport';
import type { PayportRouteContext } from './routes';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// ------------------------------------------------------------
// GET /api/payport/admin/stats
// ------------------------------------------------------------
export async function handleAdminStats(_ctx: PayportRouteContext): Promise<Response> {
    try {
        const provider = payport.getProvider();

        // Run counts in parallel.
        const [
            customers,
            activeSubs,
            trialingSubs,
            cancelledSubs,
            pastDueSubs,
            plansCount,
            productsCount,
            discountsCount,
            metersCount,
            refundsCount,
            licenseKeysCount,
            recentEvents,
            allActiveSubs,
        ] = await Promise.all([
            PaymentCustomer.count(),
            PaymentSubscription.count({ status: 'active' }),
            PaymentSubscription.count({ status: 'trialing' }),
            PaymentSubscription.count({ status: 'cancelled' }),
            PaymentSubscription.count({ status: 'past_due' }),
            PaymentPlan.count(),
            PaymentProduct.count(),
            PaymentDiscount.count(),
            PaymentMeter.count(),
            PaymentRefund.count(),
            PaymentLicenseKey.count(),
            PaymentEvent.paginate(1, 20, {}, { orderBy: 'receivedAt', orderDirection: 'desc' }),
            // For MRR we need active subs with planSlug; fetch them and look up local plan prices.
            PaymentSubscription.where({ status: 'active' }),
        ]);

        // Build planSlug → priceMonthly map from the local Plan mirror first
        // (source of truth), falling back to the in-memory plan catalog.
        const planRecords = (await PaymentPlan.all()) as Array<{ get: (k: string) => unknown }>;
        const planPriceBySlug = new Map<string, { monthly: number; currency: string }>();
        for (const row of planRecords) {
            const slug = row.get('slug') as string | null;
            const monthly = (row.get('priceMonthly') as number | null) ?? 0;
            const currency = (row.get('currency') as string | null) ?? 'USD';
            if (slug) planPriceBySlug.set(slug, { monthly, currency });
        }
        // Backfill from in-memory catalog where the DB mirror is silent.
        // The in-memory catalog carries no pricing — only slug/features mapping —
        // so we only backfill the entry so MRR doesn't drop active subs entirely.
        for (const plan of Object.values(payport.getPlanCatalog())) {
            if (!planPriceBySlug.has(plan.slug)) {
                planPriceBySlug.set(plan.slug, { monthly: 0, currency: 'USD' });
            }
        }

        let mrrCents = 0;
        let currency = 'USD';
        for (const sub of allActiveSubs as Array<{ get: (k: string) => unknown }>) {
            const slug = sub.get('planSlug') as string | null;
            if (!slug) continue;
            const price = planPriceBySlug.get(slug);
            if (!price) continue;
            mrrCents += price.monthly;
            currency = price.currency;
        }

        // events in last 24h: filter the latest 20; if you have huge volume,
        // replace with a SQL count(receivedAt > cutoff).
        const cutoff = Date.now() - ONE_DAY_MS;
        const eventsLast24h = recentEvents.data.filter(
            (e: { get: (k: string) => unknown }) => Number(e.get('receivedAt') ?? 0) > cutoff,
        ).length;

        return jsonResponse({
            counts: {
                customers,
                subscriptions: {
                    active: activeSubs,
                    trialing: trialingSubs,
                    cancelled: cancelledSubs,
                    pastDue: pastDueSubs,
                },
                plans: plansCount,
                products: productsCount,
                discounts: discountsCount,
                meters: metersCount,
                refunds: refundsCount,
                licenseKeys: licenseKeysCount,
                eventsLast24h,
            },
            mrrCents,
            arrCents: mrrCents * 12,
            currency,
            provider: {
                name: provider.name,
                healthy: true,
                capabilities: (provider.capabilities ?? {}) as unknown as Record<string, boolean>,
            },
            recentEvents: recentEvents.data.map((e: { get: (k: string) => unknown }) => ({
                id: e.get('id') as string,
                type: e.get('type') as string,
                provider: e.get('provider') as string,
                receivedAt: Number(e.get('receivedAt') ?? 0),
                processed: Boolean(e.get('processed')),
            })),
        });
    } catch (err) {
        return errorResponse(`[payport/admin] stats failed: ${(err as Error).message}`, 500);
    }
}

// ------------------------------------------------------------
// GET /api/payport/admin/providers
// ------------------------------------------------------------
export async function handleAdminProvidersInfo(_ctx: PayportRouteContext): Promise<Response> {
    try {
        const active = payport.getProvider();
        const providers = payport.listProviders().map((name) => {
            const p = payport.getProvider(name);
            return {
                name: p.name,
                capabilities: (p.capabilities ?? {}) as unknown as Record<string, boolean>,
            };
        });
        // Merge in-memory catalog (slug/name/features/provider product ids) with the
        // DB-backed PaymentPlan mirror (pricing). DB rows take precedence.
        const dbPlans = (await PaymentPlan.all()) as Array<{ get: (k: string) => unknown }>;
        const dbBySlug = new Map<string, { get: (k: string) => unknown }>();
        for (const row of dbPlans) {
            const slug = row.get('slug') as string | null;
            if (slug) dbBySlug.set(slug, row);
        }
        const plans = Object.values(payport.getPlanCatalog()).map((p) => {
            const db = dbBySlug.get(p.slug);
            return {
                slug: p.slug,
                name: p.name,
                features: p.features,
                priceLabel: p.priceLabel ?? null,
                providerProductIds: p.providerProductIds,
                priceMonthly: db ? ((db.get('priceMonthly') as number | null) ?? null) : null,
                priceYearly: db ? ((db.get('priceYearly') as number | null) ?? null) : null,
                currency: db ? ((db.get('currency') as string | null) ?? 'USD') : 'USD',
            };
        });
        return jsonResponse({ active: active.name, providers, plans });
    } catch (err) {
        return errorResponse(`[payport/admin] providers failed: ${(err as Error).message}`, 500);
    }
}

// ------------------------------------------------------------
// POST /api/payport/admin/resync-customer
// body: { userId: string }
// Re-fetches the customer record from the provider and updates the local mirror.
// ------------------------------------------------------------
export async function handleAdminResyncCustomer(ctx: PayportRouteContext): Promise<Response> {
    try {
        const body = (await ctx.request.json().catch(() => ({}))) as { userId?: string };
        if (!body.userId) return errorResponse('userId required', 400);
        const result = await payport.customer.sync(body.userId);
        return jsonResponse({ customer: result });
    } catch (err) {
        return errorResponse((err as Error).message, 500);
    }
}

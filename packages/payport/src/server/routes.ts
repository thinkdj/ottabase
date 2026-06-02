// ============================================================
// Payport — HTTP Route Handlers (provider-neutral)
// ============================================================
//
// Designed for Cloudflare Workers + Ottabase router. Hand any
// of these to your `handleCustomRoutes()` switch in
// `ottabase/config.routes.ts`. They take a minimal context so
// they are not coupled to a specific app framework.
// ============================================================

import { errorResponse } from '@ottabase/utils/http-errors';
import { jsonResponse } from '@ottabase/utils/http-response';
import { ensurePlansLoaded } from '../core/plans';
import { PaymentPlan } from '../models';
import { payport } from '../payport';
import type { PaymentProviderName } from '../types';

export interface PayportRouteContext {
    request: Request;
    /** Authenticated user id. Use null for unauthenticated/public routes. */
    userId: string | null;
    /** App identifier for app-scoped reporting. Optional. */
    appId?: string | null;
}

// ------------------------------------------------------------
// GET /api/payport/plans   — public catalog for pricing pages
//
// Returns active plans sorted by displayOrder. Reads from the DB
// (canonical source) and includes pricing fields the homepage
// needs to render. Hot-cache lookups (resolvePlanBySlug) get a
// free side-effect refresh.
// ------------------------------------------------------------
export async function handleListPublicPlans(_ctx: PayportRouteContext): Promise<Response> {
    try {
        await ensurePlansLoaded();
        const rows = (await PaymentPlan.where({ active: true, isPublic: true })) as Array<{
            get: (k: string) => unknown;
        }>;
        const plans = rows
            .map((row) => ({
                slug: row.get('slug') as string,
                name: row.get('name') as string,
                description: (row.get('description') as string | null) ?? null,
                features: parseFeatures(row.get('features')),
                priceLabel: (row.get('priceLabel') as string | null) ?? null,
                priceMonthly: (row.get('priceMonthly') as number | null) ?? 0,
                priceYearly: (row.get('priceYearly') as number | null) ?? 0,
                currency: (row.get('currency') as string | null) ?? 'USD',
                displayOrder: Number(row.get('displayOrder') ?? 0),
                isDefault: Boolean(row.get('isDefault')),
            }))
            .sort((a, b) => a.displayOrder - b.displayOrder);
        return jsonResponse({ plans });
    } catch (err) {
        return errorResponse((err as Error).message, 500);
    }
}

function parseFeatures(raw: unknown): string[] {
    if (Array.isArray(raw)) return raw.filter((f): f is string => typeof f === 'string');
    if (typeof raw !== 'string' || !raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((f): f is string => typeof f === 'string') : [];
    } catch {
        return [];
    }
}

// ------------------------------------------------------------
// POST /api/payport/checkout
// body: { plan: string; successUrl: string; cancelUrl: string; email?: string; metadata?: Record<string,string> }
// ------------------------------------------------------------
export async function handleCreateCheckout(ctx: PayportRouteContext): Promise<Response> {
    if (!ctx.userId) return errorResponse('Authentication required', 401);
    const body = await safeJson<{
        plan?: string;
        successUrl?: string;
        cancelUrl?: string;
        email?: string;
        metadata?: Record<string, string>;
    }>(ctx.request);

    if (!body.plan || !body.successUrl || !body.cancelUrl) {
        return errorResponse('plan, successUrl and cancelUrl are required', 400);
    }

    try {
        const result = await payport.checkout.create({
            userId: ctx.userId,
            plan: body.plan,
            email: body.email,
            successUrl: body.successUrl,
            cancelUrl: body.cancelUrl,
            metadata: body.metadata,
            appId: ctx.appId ?? undefined,
        });
        return jsonResponse(result);
    } catch (err) {
        return errorResponse((err as Error).message, 500);
    }
}

// ------------------------------------------------------------
// GET /api/payport/subscription   — current active subscription
// ------------------------------------------------------------
export async function handleGetSubscription(ctx: PayportRouteContext): Promise<Response> {
    if (!ctx.userId) return errorResponse('Authentication required', 401);
    const subscription = await payport.subscriptions.forUser(ctx.userId);
    return jsonResponse({ subscription });
}

// ------------------------------------------------------------
// GET /api/payport/entitlements   — features + plan
// ------------------------------------------------------------
export async function handleGetEntitlements(ctx: PayportRouteContext): Promise<Response> {
    if (!ctx.userId) return errorResponse('Authentication required', 401);
    const entitlements = await payport.entitlements.resolve(ctx.userId);
    return jsonResponse(entitlements);
}

// ------------------------------------------------------------
// POST /api/payport/portal
// body: { returnUrl: string }
// ------------------------------------------------------------
export async function handleBillingPortal(ctx: PayportRouteContext): Promise<Response> {
    if (!ctx.userId) return errorResponse('Authentication required', 401);
    const body = await safeJson<{ returnUrl?: string }>(ctx.request);
    if (!body.returnUrl) return errorResponse('returnUrl is required', 400);

    try {
        const result = await payport.getProvider().createBillingPortalSession({
            userId: ctx.userId,
            returnUrl: body.returnUrl,
        });
        return jsonResponse(result);
    } catch (err) {
        return errorResponse((err as Error).message, 500);
    }
}

// ------------------------------------------------------------
// POST /api/payport/subscription/cancel
// body: { subscriptionId: string; immediate?: boolean }
// ------------------------------------------------------------
export async function handleCancelSubscription(ctx: PayportRouteContext): Promise<Response> {
    if (!ctx.userId) return errorResponse('Authentication required', 401);
    const body = await safeJson<{ subscriptionId?: string; immediate?: boolean }>(ctx.request);
    if (!body.subscriptionId) return errorResponse('subscriptionId is required', 400);

    try {
        const subscription = await payport.subscriptions.cancel(body.subscriptionId, body.immediate ?? false);
        if (subscription.userId !== ctx.userId) return errorResponse('Forbidden', 403);
        return jsonResponse({ subscription });
    } catch (err) {
        return errorResponse((err as Error).message, 500);
    }
}

// ------------------------------------------------------------
// POST /api/payport/subscription/resume
// body: { subscriptionId: string }
// ------------------------------------------------------------
export async function handleResumeSubscription(ctx: PayportRouteContext): Promise<Response> {
    if (!ctx.userId) return errorResponse('Authentication required', 401);
    const body = await safeJson<{ subscriptionId?: string }>(ctx.request);
    if (!body.subscriptionId) return errorResponse('subscriptionId is required', 400);

    try {
        const subscription = await payport.subscriptions.resume(body.subscriptionId);
        if (subscription.userId !== ctx.userId) return errorResponse('Forbidden', 403);
        return jsonResponse({ subscription });
    } catch (err) {
        return errorResponse((err as Error).message, 500);
    }
}

// ------------------------------------------------------------
// POST /api/payport/webhooks/:provider  — provider webhook entrypoint
// (no auth — signature verification is the auth)
// ------------------------------------------------------------
export async function handleWebhook(ctx: { request: Request; provider?: PaymentProviderName }): Promise<Response> {
    return payport.webhooks.handle(ctx.request, ctx.provider ? { provider: ctx.provider } : undefined);
}

async function safeJson<T extends object>(request: Request): Promise<T> {
    try {
        return (await request.json()) as T;
    } catch {
        return {} as T;
    }
}

// ------------------------------------------------------------
// POST /api/payport/usage
// body: { meter: string; value: number; externalEventId?: string; metadata?: Record<string,string|number|boolean>; occurredAt?: string }
// Records a usage event against a metered product. Idempotent on externalEventId.
// ------------------------------------------------------------
export async function handleRecordUsage(ctx: PayportRouteContext): Promise<Response> {
    if (!ctx.userId) return errorResponse('Authentication required', 401);
    const body = await safeJson<{
        meter?: string;
        value?: number;
        externalEventId?: string;
        metadata?: Record<string, string | number | boolean>;
        occurredAt?: string;
    }>(ctx.request);

    if (!body.meter || typeof body.value !== 'number') {
        return errorResponse('meter and numeric value are required', 400);
    }

    try {
        const event = await payport.meters.recordUsage({
            userId: ctx.userId,
            meter: body.meter,
            value: body.value,
            externalEventId: body.externalEventId,
            metadata: body.metadata,
            occurredAt: body.occurredAt ? new Date(body.occurredAt) : undefined,
        });
        return jsonResponse({ event });
    } catch (err) {
        return errorResponse((err as Error).message, 500);
    }
}

// ------------------------------------------------------------
// GET /api/payport/meters/:slug — current customer balance for a meter
// ------------------------------------------------------------
export async function handleGetCustomerMeter(ctx: PayportRouteContext, meterSlug: string): Promise<Response> {
    if (!ctx.userId) return errorResponse('Authentication required', 401);
    if (!meterSlug) return errorResponse('meter slug is required', 400);
    try {
        const meter = await payport.meters.getCustomerMeter({ userId: ctx.userId, meter: meterSlug });
        return jsonResponse({ meter });
    } catch (err) {
        return errorResponse((err as Error).message, 500);
    }
}

// ------------------------------------------------------------
// GET /api/payport/discounts — public storefront list of active discounts
// (no auth — discounts surfaced on pricing pages)
// ------------------------------------------------------------
export async function handleListDiscounts(): Promise<Response> {
    try {
        const discounts = await payport.discounts.list();
        return jsonResponse({ discounts });
    } catch (err) {
        return errorResponse((err as Error).message, 500);
    }
}

// ------------------------------------------------------------
// POST /api/payport/refunds
// body: { orderId: string; amount?: number; reason?: string; comment?: string; metadata?: Record<string,string> }
// ------------------------------------------------------------
export async function handleCreateRefund(ctx: PayportRouteContext): Promise<Response> {
    if (!ctx.userId) return errorResponse('Authentication required', 401);
    const body = await safeJson<{
        orderId?: string;
        amount?: number;
        reason?: string;
        comment?: string;
        metadata?: Record<string, string>;
    }>(ctx.request);
    if (!body.orderId) return errorResponse('orderId is required', 400);
    try {
        const refund = await payport.refunds.create({
            userId: ctx.userId,
            orderId: body.orderId,
            amount: body.amount,
            reason: body.reason,
            comment: body.comment,
            metadata: body.metadata,
        });
        return jsonResponse({ refund });
    } catch (err) {
        return errorResponse((err as Error).message, 500);
    }
}

// ------------------------------------------------------------
// GET /api/payport/refunds — refunds for the authenticated user
// (queries the local mirror; provider sync runs via webhooks).
// ------------------------------------------------------------
export async function handleListRefunds(ctx: PayportRouteContext): Promise<Response> {
    if (!ctx.userId) return errorResponse('Authentication required', 401);
    try {
        const { PaymentRefund } = await import('../models');
        const rows = await PaymentRefund.where({ userId: ctx.userId });
        return jsonResponse({ refunds: rows.map((r) => r.toJson()) });
    } catch (err) {
        return errorResponse((err as Error).message, 500);
    }
}

// ------------------------------------------------------------
// POST /api/payport/license/validate
// body: { key: string; activationId?: string; incrementUsage?: number }
// (public — license validation is by the key holder, not the dashboard user)
// ------------------------------------------------------------
export async function handleValidateLicense(ctx: { request: Request }): Promise<Response> {
    const body = await safeJson<{ key?: string; activationId?: string; incrementUsage?: number }>(ctx.request);
    if (!body.key) return errorResponse('key is required', 400);
    try {
        const result = await payport.licenses.validate({
            key: body.key,
            activationId: body.activationId,
            incrementUsage: body.incrementUsage,
        });
        return jsonResponse(result);
    } catch (err) {
        return errorResponse((err as Error).message, 500);
    }
}

// ------------------------------------------------------------
// POST /api/payport/license/activate
// body: { key: string; label?: string; metadata?: Record<string, string> }
// ------------------------------------------------------------
export async function handleActivateLicense(ctx: { request: Request }): Promise<Response> {
    const body = await safeJson<{ key?: string; label?: string; metadata?: Record<string, string> }>(ctx.request);
    if (!body.key) return errorResponse('key is required', 400);
    try {
        const activation = await payport.licenses.activate({
            key: body.key,
            label: body.label,
            metadata: body.metadata,
        });
        return jsonResponse({ activation });
    } catch (err) {
        return errorResponse((err as Error).message, 500);
    }
}

// ------------------------------------------------------------
// POST /api/payport/license/deactivate
// body: { key: string; activationId: string }
// ------------------------------------------------------------
export async function handleDeactivateLicense(ctx: { request: Request }): Promise<Response> {
    const body = await safeJson<{ key?: string; activationId?: string }>(ctx.request);
    if (!body.key || !body.activationId) return errorResponse('key and activationId are required', 400);
    try {
        await payport.licenses.deactivate({ key: body.key, activationId: body.activationId });
        return jsonResponse({ ok: true });
    } catch (err) {
        return errorResponse((err as Error).message, 500);
    }
}

// ============================================================
// Payport — Polar.sh Provider Adapter
// ============================================================
//
// Implements the Payport `PaymentProvider` contract against
// Polar.sh's REST API. Cloudflare Workers-friendly: uses
// `fetch` + Web Crypto, no Node SDK.
//
// Polar has a published TS SDK (`@polar-sh/sdk`); we deliberately
// hit the REST API directly so this package stays edge-safe and
// dependency-light. Swap to the SDK later if needed without
// changing the public surface.
//
// Docs: https://polar.sh/docs/api-reference/introduction
// ============================================================

import { resolvePlanByProviderProduct, resolvePlanBySlug } from '../../core/plans';
import type { CreateCustomerInput, PaymentProvider, UpdateSubscriptionInput } from '../../provider';
import type {
    ActivateLicenseInput,
    CreateDiscountInput,
    CreateRefundInput,
    CreateSubscriptionInput,
    CustomerMeterDTO,
    CustomerMeterQuery,
    DeactivateLicenseInput,
    DiscountDTO,
    DiscountType,
    LicenseActivationDTO,
    LicenseKeyDTO,
    LicenseKeyStatus,
    MeterAggregation,
    MeterDTO,
    NormalizedWebhook,
    PaymentCustomerDTO,
    PayportEvent,
    PayportEventType,
    ProductDTO,
    RecordUsageInput,
    RefundDTO,
    RefundStatus,
    SubscriptionDTO,
    ValidateLicenseInput,
    ValidateLicenseResult,
    VerifyWebhookInput,
} from '../../types';

export interface PolarProviderConfig {
    /** Polar API access token (server only). */
    accessToken: string;
    /** Webhook signing secret. */
    webhookSecret: string;
    /** Override base URL (e.g. sandbox). Defaults to production. */
    baseUrl?: string;
    /** Polar organization id this app sells under. */
    organizationId?: string;
}

export class PolarProvider implements PaymentProvider {
    readonly name = 'polar' as const;
    readonly capabilities = {
        meters: true,
        refunds: true,
        discounts: true,
        licenseKeys: true,
        serverSideSubscriptions: true,
    } as const;
    private readonly baseUrl: string;

    constructor(private readonly config: PolarProviderConfig) {
        this.baseUrl = (config.baseUrl ?? 'https://api.polar.sh').replace(/\/$/, '');
    }

    // ------------------------------------------------------------
    // Customers
    // ------------------------------------------------------------

    async createCustomer(input: CreateCustomerInput): Promise<PaymentCustomerDTO> {
        const body = {
            email: input.email,
            name: input.name,
            external_id: input.userId,
            metadata: input.metadata ?? {},
            organization_id: this.config.organizationId,
        };
        const created = await this.request<PolarCustomer>('POST', '/v1/customers/', body);
        return this.customerToDTO(created, input.userId);
    }

    async getCustomer(externalCustomerId: string): Promise<PaymentCustomerDTO | null> {
        try {
            const customer = await this.request<PolarCustomer>('GET', `/v1/customers/${externalCustomerId}`);
            return this.customerToDTO(customer, customer.external_id ?? '');
        } catch (err) {
            if ((err as PolarError).status === 404) return null;
            throw err;
        }
    }

    // ------------------------------------------------------------
    // Products
    // ------------------------------------------------------------

    async listProducts(): Promise<ProductDTO[]> {
        const query = this.config.organizationId ? `?organization_id=${this.config.organizationId}` : '';
        const page = await this.request<PolarPage<PolarProduct>>('GET', `/v1/products/${query}`);
        return (page.items ?? []).map((p) => ({
            id: p.id,
            externalProductId: p.id,
            provider: 'polar',
            name: p.name,
            description: p.description ?? null,
        }));
    }

    // ------------------------------------------------------------
    // Checkout
    // ------------------------------------------------------------

    async createCheckout(input: {
        userId: string;
        plan: string;
        email?: string;
        successUrl: string;
        cancelUrl: string;
        metadata?: Record<string, string>;
        discount?: string;
        externalCustomerId?: string;
    }) {
        const plan = resolvePlanBySlug(input.plan);
        const productId = plan?.providerProductIds.polar;
        if (!productId) {
            throw new Error(`[payport/polar] Plan "${input.plan}" has no polar product id.`);
        }

        const body: Record<string, unknown> = {
            product_id: productId,
            success_url: input.successUrl,
            customer_external_id: input.userId,
            customer_email: input.email,
            metadata: {
                ...(input.metadata ?? {}),
                payport_user_id: input.userId,
                payport_plan: input.plan,
            },
        };
        if (input.discount) {
            // Polar accepts either a discount id or a code on checkout creation.
            // The caller has already resolved a slug → external id where possible.
            body.discount_id = input.discount;
        }
        if (input.externalCustomerId) body.customer_id = input.externalCustomerId;

        const checkout = await this.request<PolarCheckout>('POST', '/v1/checkouts/', body);
        return {
            checkoutUrl: checkout.url,
            externalCheckoutId: checkout.id,
        };
    }

    // ------------------------------------------------------------
    // Subscriptions
    // ------------------------------------------------------------

    async getSubscription(externalSubscriptionId: string): Promise<SubscriptionDTO | null> {
        try {
            const sub = await this.request<PolarSubscription>('GET', `/v1/subscriptions/${externalSubscriptionId}`);
            return this.subscriptionToDTO(sub);
        } catch (err) {
            if ((err as PolarError).status === 404) return null;
            throw err;
        }
    }

    async updateSubscription(input: UpdateSubscriptionInput): Promise<SubscriptionDTO> {
        const body: Record<string, unknown> = {};
        if (input.newPlan) {
            const plan = resolvePlanBySlug(input.newPlan);
            const productId = plan?.providerProductIds.polar;
            if (!productId) throw new Error(`[payport/polar] Plan "${input.newPlan}" has no polar product id.`);
            body.product_id = productId;
        }
        if (input.cancelAtPeriodEnd !== undefined) body.cancel_at_period_end = input.cancelAtPeriodEnd;
        if (input.metadata) body.metadata = input.metadata;

        const updated = await this.request<PolarSubscription>(
            'PATCH',
            `/v1/subscriptions/${input.externalSubscriptionId}`,
            body,
        );
        return this.subscriptionToDTO(updated);
    }

    async cancelSubscription(externalSubscriptionId: string, immediate = false): Promise<SubscriptionDTO> {
        if (immediate) {
            const updated = await this.request<PolarSubscription>(
                'DELETE',
                `/v1/subscriptions/${externalSubscriptionId}`,
            );
            return this.subscriptionToDTO(updated);
        }
        const updated = await this.request<PolarSubscription>('PATCH', `/v1/subscriptions/${externalSubscriptionId}`, {
            cancel_at_period_end: true,
        });
        return this.subscriptionToDTO(updated);
    }

    async resumeSubscription(externalSubscriptionId: string): Promise<SubscriptionDTO> {
        const updated = await this.request<PolarSubscription>('PATCH', `/v1/subscriptions/${externalSubscriptionId}`, {
            cancel_at_period_end: false,
        });
        return this.subscriptionToDTO(updated);
    }

    // ------------------------------------------------------------
    // Billing portal
    // ------------------------------------------------------------

    async createBillingPortalSession(input: { userId: string; returnUrl: string }) {
        // Polar uses customer-session links; surface the customer portal URL.
        const session = await this.request<PolarCustomerSession>('POST', '/v1/customer-sessions/', {
            customer_external_id: input.userId,
        });
        return { portalUrl: session.customer_portal_url ?? input.returnUrl };
    }

    // ------------------------------------------------------------
    // Server-side subscription create
    // ------------------------------------------------------------

    async createSubscription(input: CreateSubscriptionInput): Promise<SubscriptionDTO> {
        const plan = resolvePlanBySlug(input.plan);
        const productId = plan?.providerProductIds.polar;
        if (!productId) throw new Error(`[payport/polar] Plan "${input.plan}" has no polar product id.`);

        const body: Record<string, unknown> = {
            product_id: productId,
            customer_external_id: input.userId,
            customer_email: input.email,
            metadata: {
                ...(input.metadata ?? {}),
                payport_user_id: input.userId,
                payport_plan: input.plan,
            },
        };
        if (input.discount) body.discount_id = input.discount;
        if (input.trialDays) body.trial_period_days = input.trialDays;

        const sub = await this.request<PolarSubscription>('POST', '/v1/subscriptions/', body);
        return this.subscriptionToDTO(sub);
    }

    // ------------------------------------------------------------
    // Discounts
    // ------------------------------------------------------------

    async listDiscounts(): Promise<DiscountDTO[]> {
        const query = this.config.organizationId ? `?organization_id=${this.config.organizationId}` : '';
        const page = await this.request<PolarPage<PolarDiscount>>('GET', `/v1/discounts/${query}`);
        return (page.items ?? []).map((d) => this.discountToDTO(d));
    }

    async getDiscount(externalDiscountId: string): Promise<DiscountDTO | null> {
        try {
            const d = await this.request<PolarDiscount>('GET', `/v1/discounts/${externalDiscountId}`);
            return this.discountToDTO(d);
        } catch (err) {
            if ((err as PolarError).status === 404) return null;
            throw err;
        }
    }

    async createDiscount(input: CreateDiscountInput): Promise<DiscountDTO> {
        const body: Record<string, unknown> = {
            name: input.name,
            code: input.code,
            type: input.type === 'fixed' ? 'fixed' : 'percentage',
            duration: input.duration ?? 'once',
            duration_in_months: input.durationInMonths,
            max_redemptions: input.maxRedemptions,
            ends_at: input.redeemBy?.toISOString(),
            organization_id: this.config.organizationId,
            metadata: input.metadata ?? {},
        };
        // Polar uses different fields for percentage vs fixed amounts.
        if (input.type === 'percentage') body.basis_points = Math.round(input.amount * 100);
        else {
            body.amount = input.amount;
            body.currency = input.currency ?? 'USD';
        }
        if (input.productIds?.length) body.products = input.productIds;

        const created = await this.request<PolarDiscount>('POST', '/v1/discounts/', body);
        return this.discountToDTO(created);
    }

    async deleteDiscount(externalDiscountId: string): Promise<void> {
        await this.request<void>('DELETE', `/v1/discounts/${externalDiscountId}`);
    }

    // ------------------------------------------------------------
    // Meters / Usage
    // ------------------------------------------------------------

    async listMeters(): Promise<MeterDTO[]> {
        const query = this.config.organizationId ? `?organization_id=${this.config.organizationId}` : '';
        const page = await this.request<PolarPage<PolarMeter>>('GET', `/v1/meters/${query}`);
        return (page.items ?? []).map((m) => this.meterToDTO(m));
    }

    async getMeter(externalMeterId: string): Promise<MeterDTO | null> {
        try {
            const m = await this.request<PolarMeter>('GET', `/v1/meters/${externalMeterId}`);
            return this.meterToDTO(m);
        } catch (err) {
            if ((err as PolarError).status === 404) return null;
            throw err;
        }
    }

    async recordUsage(input: RecordUsageInput): Promise<void> {
        // Polar's usage events are ingested via the events API.
        // Each event must carry an idempotency key (externalEventId) and
        // either a meter id or the meter's `name` filter via metadata.
        const body = {
            events: [
                {
                    name: input.meter,
                    external_customer_id: input.userId,
                    timestamp: (input.occurredAt ?? new Date()).toISOString(),
                    metadata: {
                        ...(input.metadata ?? {}),
                        value: input.value,
                        payport_event_id: input.externalEventId,
                    },
                },
            ],
        };
        await this.request<void>('POST', '/v1/events/ingest', body);
    }

    async getCustomerMeter(input: CustomerMeterQuery): Promise<CustomerMeterDTO | null> {
        const params = new URLSearchParams({ customer_external_id: input.userId });
        if (input.meter) params.set('meter_id', input.meter);
        const page = await this.request<PolarPage<PolarCustomerMeter>>(
            'GET',
            `/v1/customer-meters/?${params.toString()}`,
        );
        const cm = page.items?.[0];
        if (!cm) return null;
        return this.customerMeterToDTO(cm);
    }

    // ------------------------------------------------------------
    // Refunds
    // ------------------------------------------------------------

    async listRefunds(query?: { externalOrderId?: string; externalSubscriptionId?: string }): Promise<RefundDTO[]> {
        const params = new URLSearchParams();
        if (query?.externalOrderId) params.set('order_id', query.externalOrderId);
        if (query?.externalSubscriptionId) params.set('subscription_id', query.externalSubscriptionId);
        const qs = params.toString();
        const page = await this.request<PolarPage<PolarRefund>>('GET', `/v1/refunds/${qs ? `?${qs}` : ''}`);
        return (page.items ?? []).map((r) => this.refundToDTO(r));
    }

    async getRefund(externalRefundId: string): Promise<RefundDTO | null> {
        try {
            const r = await this.request<PolarRefund>('GET', `/v1/refunds/${externalRefundId}`);
            return this.refundToDTO(r);
        } catch (err) {
            if ((err as PolarError).status === 404) return null;
            throw err;
        }
    }

    async createRefund(input: CreateRefundInput): Promise<RefundDTO> {
        const body: Record<string, unknown> = {
            order_id: input.orderId,
            reason: input.reason ?? 'requested_by_customer',
            comment: input.comment,
            metadata: input.metadata ?? {},
        };
        if (input.amount !== undefined) body.amount = input.amount;
        const created = await this.request<PolarRefund>('POST', '/v1/refunds/', body);
        return this.refundToDTO(created);
    }

    // ------------------------------------------------------------
    // License Keys (issued as Polar "benefits" of type license_keys)
    // ------------------------------------------------------------

    async listLicenseKeys(query?: { userId?: string; externalCustomerId?: string }): Promise<LicenseKeyDTO[]> {
        const params = new URLSearchParams();
        if (query?.userId) params.set('customer_external_id', query.userId);
        if (query?.externalCustomerId) params.set('customer_id', query.externalCustomerId);
        if (this.config.organizationId) params.set('organization_id', this.config.organizationId);
        const qs = params.toString();
        const page = await this.request<PolarPage<PolarLicenseKey>>('GET', `/v1/license-keys/${qs ? `?${qs}` : ''}`);
        return (page.items ?? []).map((k) => this.licenseKeyToDTO(k));
    }

    async getLicenseKey(externalLicenseKeyId: string): Promise<LicenseKeyDTO | null> {
        try {
            const k = await this.request<PolarLicenseKey>('GET', `/v1/license-keys/${externalLicenseKeyId}`);
            return this.licenseKeyToDTO(k);
        } catch (err) {
            if ((err as PolarError).status === 404) return null;
            throw err;
        }
    }

    async validateLicenseKey(input: ValidateLicenseInput): Promise<ValidateLicenseResult> {
        const body: Record<string, unknown> = { key: input.key };
        if (input.activationId) body.activation_id = input.activationId;
        if (input.incrementUsage) body.increment_usage = input.incrementUsage;
        try {
            const res = await this.request<PolarLicenseValidation>('POST', '/v1/license-keys/validate', body);
            return {
                valid: !!res.license_key && res.license_key.status === 'granted',
                licenseKey: res.license_key ? this.licenseKeyToDTO(res.license_key) : null,
                activation: res.activation ? this.licenseActivationToDTO(res.activation) : null,
            };
        } catch (err) {
            const status = (err as PolarError).status;
            if (status === 404 || status === 400 || status === 422) {
                return { valid: false, licenseKey: null, reason: (err as PolarError).body ?? 'invalid' };
            }
            throw err;
        }
    }

    async activateLicenseKey(input: ActivateLicenseInput): Promise<LicenseActivationDTO> {
        const body = {
            key: input.key,
            label: input.label,
            metadata: input.metadata ?? {},
        };
        const res = await this.request<PolarLicenseActivation>('POST', '/v1/license-keys/activate', body);
        return this.licenseActivationToDTO(res);
    }

    async deactivateLicenseKey(input: DeactivateLicenseInput): Promise<void> {
        await this.request<void>('POST', '/v1/license-keys/deactivate', {
            key: input.key,
            activation_id: input.activationId,
        });
    }

    // ------------------------------------------------------------
    // Webhooks
    // ------------------------------------------------------------

    async verifyWebhook(input: VerifyWebhookInput): Promise<void> {
        const headers = normalizeHeaders(input.headers);
        const signature = headers['webhook-signature'] ?? headers['polar-signature'] ?? '';
        const timestamp = headers['webhook-timestamp'] ?? '';
        const id = headers['webhook-id'] ?? '';
        if (!signature) throw new Error('Missing webhook signature header');

        // Polar uses the standard "Standard Webhooks" signature scheme: v1,<base64(hmacSha256(secret, `${id}.${ts}.${body}`))>
        const expected = await hmacSha256Base64(this.config.webhookSecret, `${id}.${timestamp}.${input.rawBody}`);
        const provided = signature
            .split(' ')
            .map((part) => part.trim())
            .filter((p) => p.startsWith('v1,'))
            .map((p) => p.slice(3));

        const matched = provided.some((sig) => timingSafeEqual(sig, expected));
        if (!matched) throw new Error('Webhook signature mismatch');
    }

    async handleWebhook(input: VerifyWebhookInput): Promise<NormalizedWebhook> {
        const payload = JSON.parse(input.rawBody) as PolarWebhookEnvelope;
        const externalEventId =
            payload.id ?? normalizeHeaders(input.headers)['webhook-id'] ?? `${payload.type}:${Date.now()}`;

        const event = this.mapWebhookToEvent(payload);
        return {
            externalEventId,
            events: event ? [event] : [],
        };
    }

    // ------------------------------------------------------------
    // Mappers
    // ------------------------------------------------------------

    private mapWebhookToEvent(payload: PolarWebhookEnvelope): PayportEvent | null {
        const occurredAt = payload.created_at ? new Date(payload.created_at) : new Date();
        const type = mapPolarEventType(payload.type);
        if (!type) return null;

        let data: unknown = payload.data;
        if (payload.type.startsWith('subscription.') && payload.data) {
            data = this.subscriptionToDTO(payload.data as PolarSubscription);
        }

        return {
            type,
            provider: 'polar',
            externalEventId: payload.id ?? `${payload.type}:${occurredAt.getTime()}`,
            data,
            occurredAt,
        };
    }

    private customerToDTO(customer: PolarCustomer, fallbackUserId: string): PaymentCustomerDTO {
        return {
            id: customer.id,
            provider: 'polar',
            externalCustomerId: customer.id,
            userId: customer.external_id ?? fallbackUserId,
            email: customer.email,
            metadata: (customer.metadata ?? null) as Record<string, string> | null,
        };
    }

    private subscriptionToDTO(sub: PolarSubscription): SubscriptionDTO {
        const planSlug =
            (sub.metadata?.payport_plan as string | undefined) ??
            resolvePlanByProviderProduct('polar', sub.product_id ?? '')?.slug ??
            'unknown';

        return {
            id: sub.id,
            userId:
                (sub.metadata?.payport_user_id as string | undefined) ??
                sub.customer?.external_id ??
                sub.customer_id ??
                '',
            provider: 'polar',
            externalSubscriptionId: sub.id,
            planId: planSlug,
            planSlug,
            status: mapPolarSubscriptionStatus(sub.status),
            currentPeriodStart: sub.current_period_start ? new Date(sub.current_period_start) : null,
            currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end) : null,
            cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
            trialEndsAt: sub.trial_ends_at ? new Date(sub.trial_ends_at) : null,
            metadata: (sub.metadata ?? null) as Record<string, unknown> | null,
        };
    }

    private discountToDTO(d: PolarDiscount): DiscountDTO {
        const isPercent = (d.type ?? '').toLowerCase() === 'percentage' || typeof d.basis_points === 'number';
        const type: DiscountType = isPercent ? 'percentage' : 'fixed';
        const amount = isPercent ? (typeof d.basis_points === 'number' ? d.basis_points / 100 : 0) : (d.amount ?? 0);
        return {
            id: d.id,
            provider: 'polar',
            externalDiscountId: d.id,
            code: d.code ?? null,
            name: d.name ?? d.code ?? d.id,
            type,
            amount,
            currency: d.currency ?? null,
            duration: (d.duration as DiscountDTO['duration']) ?? null,
            durationInMonths: d.duration_in_months ?? null,
            maxRedemptions: d.max_redemptions ?? null,
            redeemBy: d.ends_at ? new Date(d.ends_at) : null,
            active: d.is_active ?? true,
            metadata: (d.metadata ?? null) as Record<string, unknown> | null,
        };
    }

    private meterToDTO(m: PolarMeter): MeterDTO {
        const aggregation = (m.aggregation?.func ?? 'sum').toLowerCase() as MeterAggregation;
        return {
            id: m.id,
            provider: 'polar',
            externalMeterId: m.id,
            slug: m.slug ?? m.name ?? m.id,
            name: m.name ?? m.slug ?? m.id,
            aggregation,
            unit: m.unit ?? null,
            metadata: (m.metadata ?? null) as Record<string, unknown> | null,
        };
    }

    private customerMeterToDTO(cm: PolarCustomerMeter): CustomerMeterDTO {
        const consumed = cm.consumed_units ?? 0;
        const credited = cm.credited_units ?? 0;
        return {
            id: cm.id,
            provider: 'polar',
            externalCustomerMeterId: cm.id,
            externalCustomerId: cm.customer_id ?? cm.customer?.id ?? '',
            externalMeterId: cm.meter_id ?? cm.meter?.id ?? '',
            consumedUnits: consumed,
            creditedUnits: credited,
            balance: cm.balance ?? consumed - credited,
            metadata: (cm.metadata ?? null) as Record<string, unknown> | null,
        };
    }

    private refundToDTO(r: PolarRefund): RefundDTO {
        const status = (r.status ?? 'pending').toLowerCase() as RefundStatus;
        return {
            id: r.id,
            provider: 'polar',
            externalRefundId: r.id,
            externalOrderId: r.order_id ?? null,
            externalSubscriptionId: r.subscription_id ?? null,
            externalCustomerId: r.customer_id ?? null,
            userId: (r.metadata?.payport_user_id as string | undefined) ?? null,
            amount: r.amount ?? 0,
            currency: r.currency ?? 'USD',
            reason: r.reason ?? null,
            status,
            metadata: (r.metadata ?? null) as Record<string, unknown> | null,
            createdAt: r.created_at ? new Date(r.created_at) : new Date(),
        };
    }

    private licenseKeyToDTO(k: PolarLicenseKey): LicenseKeyDTO {
        const status = (k.status ?? 'granted').toLowerCase() as LicenseKeyStatus;
        return {
            id: k.id,
            provider: 'polar',
            externalLicenseKeyId: k.id,
            key: k.key ?? '',
            externalCustomerId: k.customer_id ?? k.user?.id ?? null,
            userId: k.customer?.external_id ?? null,
            externalProductId: k.benefit_id ?? k.product_id ?? null,
            status,
            activationsLimit: k.limit_activations ?? null,
            activationsCount: k.activations?.length ?? k.activation_count ?? 0,
            usageLimit: k.limit_usage ?? null,
            usage: k.usage ?? 0,
            validations: k.validations ?? 0,
            expiresAt: k.expires_at ? new Date(k.expires_at) : null,
            metadata: (k.metadata ?? null) as Record<string, unknown> | null,
        };
    }

    private licenseActivationToDTO(a: PolarLicenseActivation): LicenseActivationDTO {
        return {
            id: a.id,
            provider: 'polar',
            externalActivationId: a.id,
            licenseKeyId: a.license_key_id ?? '',
            label: a.label ?? null,
            metadata: (a.meta ?? a.metadata ?? null) as Record<string, unknown> | null,
            createdAt: a.created_at ? new Date(a.created_at) : new Date(),
        };
    }

    // ------------------------------------------------------------
    // HTTP
    // ------------------------------------------------------------

    private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
        const res = await fetch(`${this.baseUrl}${path}`, {
            method,
            headers: {
                authorization: `Bearer ${this.config.accessToken}`,
                'content-type': 'application/json',
                accept: 'application/json',
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        });

        if (!res.ok) {
            const text = await res.text();
            const error = new Error(`[payport/polar] ${method} ${path} → ${res.status}: ${text}`) as PolarError;
            error.status = res.status;
            error.body = text;
            throw error;
        }

        if (res.status === 204) return undefined as T;
        return (await res.json()) as T;
    }
}

// ============================================================
// Polar API types (minimal, only what we touch)
// ============================================================

interface PolarPage<T> {
    items?: T[];
    pagination?: { total_count?: number };
}

interface PolarCustomer {
    id: string;
    email: string;
    name?: string;
    external_id?: string;
    metadata?: Record<string, unknown>;
}

interface PolarProduct {
    id: string;
    name: string;
    description?: string;
}

interface PolarCheckout {
    id: string;
    url: string;
}

interface PolarCustomerSession {
    id: string;
    customer_portal_url?: string;
}

interface PolarSubscription {
    id: string;
    status: string;
    product_id?: string;
    customer_id?: string;
    customer?: { external_id?: string };
    current_period_start?: string | number;
    current_period_end?: string | number;
    cancel_at_period_end?: boolean;
    trial_ends_at?: string | number | null;
    metadata?: Record<string, unknown>;
}

interface PolarWebhookEnvelope {
    id?: string;
    type: string;
    created_at?: string;
    data: unknown;
}

interface PolarError extends Error {
    status: number;
    body?: string;
}

interface PolarDiscount {
    id: string;
    name?: string;
    code?: string;
    type?: string;
    amount?: number;
    basis_points?: number;
    currency?: string;
    duration?: string;
    duration_in_months?: number;
    max_redemptions?: number;
    ends_at?: string;
    is_active?: boolean;
    metadata?: Record<string, unknown>;
}

interface PolarMeter {
    id: string;
    slug?: string;
    name?: string;
    aggregation?: { func?: string };
    unit?: string;
    metadata?: Record<string, unknown>;
}

interface PolarCustomerMeter {
    id: string;
    customer_id?: string;
    customer?: { id?: string; external_id?: string };
    meter_id?: string;
    meter?: { id?: string };
    consumed_units?: number;
    credited_units?: number;
    balance?: number;
    metadata?: Record<string, unknown>;
}

interface PolarRefund {
    id: string;
    order_id?: string;
    subscription_id?: string;
    customer_id?: string;
    amount?: number;
    currency?: string;
    reason?: string;
    status?: string;
    created_at?: string;
    metadata?: Record<string, unknown>;
}

interface PolarLicenseKey {
    id: string;
    key?: string;
    status?: string;
    customer_id?: string;
    customer?: { id?: string; external_id?: string };
    user?: { id?: string };
    benefit_id?: string;
    product_id?: string;
    limit_activations?: number;
    activation_count?: number;
    activations?: PolarLicenseActivation[];
    limit_usage?: number;
    usage?: number;
    validations?: number;
    expires_at?: string;
    metadata?: Record<string, unknown>;
}

interface PolarLicenseActivation {
    id: string;
    license_key_id?: string;
    label?: string;
    meta?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    created_at?: string;
}

interface PolarLicenseValidation {
    license_key?: PolarLicenseKey;
    activation?: PolarLicenseActivation;
}

// ============================================================
// Mappers
// ============================================================

function mapPolarSubscriptionStatus(status: string): SubscriptionDTO['status'] {
    switch (status) {
        case 'trialing':
            return 'trialing';
        case 'active':
            return 'active';
        case 'past_due':
        case 'unpaid':
            return 'past_due';
        case 'canceled':
        case 'cancelled':
            return 'cancelled';
        case 'expired':
            return 'expired';
        case 'paused':
            return 'paused';
        case 'incomplete':
        case 'incomplete_expired':
            return 'incomplete';
        default:
            return 'incomplete';
    }
}

const POLAR_EVENT_MAP: Record<string, PayportEventType> = {
    'customer.created': 'payment.customer.created',
    'customer.updated': 'payment.customer.updated',
    'checkout.created': 'payment.checkout.created',
    'checkout.updated': 'payment.checkout.completed',
    'subscription.created': 'payment.subscription.created',
    'subscription.active': 'payment.subscription.activated',
    'subscription.updated': 'payment.subscription.updated',
    'subscription.canceled': 'payment.subscription.cancelled',
    'subscription.cancelled': 'payment.subscription.cancelled',
    'subscription.revoked': 'payment.subscription.expired',
    'subscription.uncanceled': 'payment.subscription.resumed',
    'order.created': 'payment.invoice.created',
    'order.paid': 'payment.invoice.paid',
    'order.refunded': 'payment.refund.completed',
    'refund.created': 'payment.refund.created',
    'refund.updated': 'payment.refund.completed',
    // Discounts
    'discount.created': 'payment.discount.created',
    'discount.updated': 'payment.discount.updated',
    // Meters
    'meter.created': 'payment.meter.created',
    'meter.updated': 'payment.meter.updated',
    // Customer state changes carry meter balances + license updates
    'customer.state_changed': 'payment.customer.updated',
    // Benefit grants — Polar issues license keys as benefits
    'benefit_grant.created': 'payment.license_key.created',
    'benefit_grant.cycled': 'payment.license_key.updated',
    'benefit_grant.revoked': 'payment.license_key.revoked',
    'benefit_grant.updated': 'payment.license_key.updated',
};

function mapPolarEventType(polarType: string): PayportEventType | null {
    return POLAR_EVENT_MAP[polarType] ?? null;
}

// ============================================================
// Crypto helpers (Web Crypto — works on Cloudflare Workers)
// ============================================================

function normalizeHeaders(headers: Headers | Record<string, string>): Record<string, string> {
    if (headers instanceof Headers) {
        const out: Record<string, string> = {};
        headers.forEach((v, k) => {
            out[k.toLowerCase()] = v;
        });
        return out;
    }
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) out[k.toLowerCase()] = v;
    return out;
}

async function hmacSha256Base64(secret: string, message: string): Promise<string> {
    // Polar's signing secret is base64-encoded ("whsec_..."); strip prefix and decode if present.
    const secretBytes = decodePolarSecret(secret);
    const key = await crypto.subtle.importKey('raw', secretBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message).buffer as ArrayBuffer);
    return bufferToBase64(signature);
}

function decodePolarSecret(secret: string): ArrayBuffer {
    const stripped = secret.startsWith('whsec_') ? secret.slice(6) : secret;
    try {
        return base64ToArrayBuffer(stripped);
    } catch {
        return new TextEncoder().encode(secret).buffer as ArrayBuffer;
    }
}

function bufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
}

function base64ToArrayBuffer(input: string): ArrayBuffer {
    const binary = atob(input);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer as ArrayBuffer;
}

function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}

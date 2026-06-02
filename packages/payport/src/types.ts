// ============================================================
// Payport — Provider-Agnostic Payment Types
// ============================================================

/** All supported provider identifiers. Add new ones here when wiring a new adapter. */
export type PaymentProviderName = 'polar' | 'stripe' | 'paddle' | 'lemonsqueezy';

/** Universal subscription status (mapped from provider-native states). */
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'paused' | 'cancelled' | 'expired' | 'incomplete';

/** Universal checkout status. */
export type CheckoutStatus = 'open' | 'completed' | 'expired' | 'cancelled';

/** Universal event types emitted on the unified event bus. Adapters MUST normalize to these. */
export const PAYPORT_EVENTS = [
    'payment.customer.created',
    'payment.customer.updated',

    'payment.checkout.created',
    'payment.checkout.completed',

    'payment.subscription.created',
    'payment.subscription.trial_started',
    'payment.subscription.activated',
    'payment.subscription.updated',
    'payment.subscription.paused',
    'payment.subscription.resumed',
    'payment.subscription.cancelled',
    'payment.subscription.expired',
    'payment.subscription.past_due',
    'payment.subscription.payment_failed',
    'payment.subscription.payment_succeeded',

    'payment.plan.changed',

    'payment.refund.created',
    'payment.refund.completed',

    'payment.invoice.created',
    'payment.invoice.paid',
    'payment.invoice.failed',

    'payment.entitlement.granted',
    'payment.entitlement.revoked',

    // Meters / usage-based billing
    'payment.meter.created',
    'payment.meter.updated',
    'payment.meter.usage_recorded',

    // Discounts / coupons
    'payment.discount.created',
    'payment.discount.updated',
    'payment.discount.revoked',

    // License keys (typically issued as benefits/entitlements)
    'payment.license_key.created',
    'payment.license_key.updated',
    'payment.license_key.revoked',
    'payment.license_key.activated',
    'payment.license_key.deactivated',
] as const;

export type PayportEventType = (typeof PAYPORT_EVENTS)[number];

// ============================================================
// Domain objects (provider-neutral)
// ============================================================

export interface PaymentCustomerDTO {
    id: string;
    provider: PaymentProviderName;
    externalCustomerId: string;
    userId: string;
    email: string;
    metadata?: Record<string, string> | null;
}

export interface ProductDTO {
    id: string;
    name: string;
    description?: string | null;
    provider: PaymentProviderName;
    externalProductId: string;
}

export interface PlanDTO {
    id: string;
    slug: string;
    name: string;
    provider: PaymentProviderName;
    providerProductId: string;
    /** Application-level feature flags resolved by the entitlements engine. */
    features: string[];
    /** Optional human-facing price string (provider truth lives in the provider). */
    priceLabel?: string | null;
    metadata?: Record<string, unknown> | null;
}

export interface SubscriptionDTO {
    id: string;
    userId: string;
    provider: PaymentProviderName;
    externalSubscriptionId: string;
    planId: string;
    planSlug: string;
    status: SubscriptionStatus;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd?: boolean;
    trialEndsAt?: Date | null;
    metadata?: Record<string, unknown> | null;
}

export interface CheckoutDTO {
    id: string;
    userId: string;
    provider: PaymentProviderName;
    planSlug: string;
    externalCheckoutId: string;
    checkoutUrl: string;
    status: CheckoutStatus;
    successUrl?: string | null;
    cancelUrl?: string | null;
    metadata?: Record<string, unknown> | null;
}

// ============================================================
// Unified event payload
// ============================================================

export interface PayportEvent<T = unknown> {
    /** Universal event name. */
    type: PayportEventType;
    /** Provider that produced the event. */
    provider: PaymentProviderName;
    /** Provider-native event id (used for idempotency). */
    externalEventId: string;
    /** Universal payload (subscription, customer, invoice, etc.) — adapter decides shape. */
    data: T;
    /** When the event occurred at the provider. */
    occurredAt: Date;
}

// ============================================================
// Provider configuration / options
// ============================================================

export interface CreateCheckoutInput {
    userId: string;
    /** Application plan slug (e.g. `pro`). Resolved via `PlanResolver` to a provider product. */
    plan: string;
    /** Optional pre-resolved customer email (falls back to user lookup if your adapter is wired). */
    email?: string;
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
    /** Optional discount slug, code, or provider id to attach to the checkout. */
    discount?: string;
    /** Optional pre-resolved provider customer id (skips ensureCustomer round-trip). */
    externalCustomerId?: string;
}

export interface CreateCheckoutResult {
    checkoutUrl: string;
    externalCheckoutId: string;
}

export interface CreateBillingPortalInput {
    userId: string;
    returnUrl: string;
}

export interface BillingPortalResult {
    portalUrl: string;
}

export interface VerifyWebhookInput {
    rawBody: string;
    headers: Headers | Record<string, string>;
}

export interface NormalizedWebhook {
    /** Provider event id used for idempotency. */
    externalEventId: string;
    events: PayportEvent[];
}

// ============================================================
// Discounts / Coupons
// ============================================================

export type DiscountType = 'percentage' | 'fixed';
export type DiscountDuration = 'once' | 'forever' | 'repeating';

export interface DiscountDTO {
    id: string;
    provider: PaymentProviderName;
    externalDiscountId: string;
    /** Customer-facing redeemable code (optional — some discounts are auto-applied). */
    code?: string | null;
    name: string;
    type: DiscountType;
    /** Percentage (0-100) for `percentage`; minor units for `fixed`. */
    amount: number;
    currency?: string | null;
    duration?: DiscountDuration | null;
    durationInMonths?: number | null;
    maxRedemptions?: number | null;
    redeemBy?: Date | null;
    active: boolean;
    metadata?: Record<string, unknown> | null;
}

export interface CreateDiscountInput {
    name: string;
    code?: string;
    type: DiscountType;
    amount: number;
    currency?: string;
    duration?: DiscountDuration;
    durationInMonths?: number;
    maxRedemptions?: number;
    redeemBy?: Date;
    productIds?: string[];
    metadata?: Record<string, string>;
}

// ============================================================
// Meters / Usage-based billing
// ============================================================

export type MeterAggregation = 'sum' | 'count' | 'max' | 'min' | 'last';

export interface MeterDTO {
    id: string;
    provider: PaymentProviderName;
    externalMeterId: string;
    slug: string;
    name: string;
    aggregation: MeterAggregation;
    unit?: string | null;
    metadata?: Record<string, unknown> | null;
}

export interface CustomerMeterDTO {
    id: string;
    provider: PaymentProviderName;
    externalCustomerMeterId: string;
    externalCustomerId: string;
    externalMeterId: string;
    /** Total units consumed across the period. */
    consumedUnits: number;
    /** Total units credited (e.g. from a plan allowance). */
    creditedUnits: number;
    /** consumedUnits - creditedUnits, can be negative if pre-credited. */
    balance: number;
    metadata?: Record<string, unknown> | null;
}

export interface RecordUsageInput {
    /** App user id — adapter resolves to provider customer id. */
    userId: string;
    /** Meter slug from your local catalog OR direct provider meter id. */
    meter: string;
    /** Quantity recorded (must be ≥ 0 for `sum`/`count`). */
    value: number;
    /** Idempotency key — adapter de-dupes events by this id within the provider's window. */
    externalEventId?: string;
    /** When the usage occurred. Defaults to now. */
    occurredAt?: Date;
    /** Free-form metadata that providers store on the event. */
    metadata?: Record<string, string | number | boolean>;
}

export interface CustomerMeterQuery {
    userId: string;
    /** Slug or external meter id. */
    meter: string;
}

// ============================================================
// Refunds
// ============================================================

export type RefundStatus = 'pending' | 'succeeded' | 'failed' | 'cancelled';

export interface RefundDTO {
    id: string;
    provider: PaymentProviderName;
    externalRefundId: string;
    /** Provider-native order/charge id (Polar = order id). */
    externalOrderId?: string | null;
    externalSubscriptionId?: string | null;
    externalCustomerId?: string | null;
    userId?: string | null;
    /** Amount refunded in minor units (e.g. cents). */
    amount: number;
    currency: string;
    reason?: string | null;
    status: RefundStatus;
    metadata?: Record<string, unknown> | null;
    createdAt: Date;
}

export interface CreateRefundInput {
    /** Provider order/charge id to refund against. */
    orderId: string;
    /** Amount in minor units. Omit for full refund. */
    amount?: number;
    /** Provider-defined reason code (e.g. 'duplicate', 'requested_by_customer'). */
    reason?: string;
    /** Free-form comment shown in dashboards / receipts. */
    comment?: string;
    metadata?: Record<string, string>;
}

// ============================================================
// License Keys
// ============================================================

export type LicenseKeyStatus = 'granted' | 'revoked' | 'expired' | 'disabled';

export interface LicenseKeyDTO {
    id: string;
    provider: PaymentProviderName;
    externalLicenseKeyId: string;
    /** Full license key string when first issued; usually masked on subsequent reads. */
    key: string;
    /** Provider customer id. */
    externalCustomerId?: string | null;
    /** Application user id (resolved via customer mirror). */
    userId?: string | null;
    externalProductId?: string | null;
    status: LicenseKeyStatus;
    /** Maximum allowed activations (devices). */
    activationsLimit?: number | null;
    /** Current activation count. */
    activationsCount: number;
    /** Maximum usage units (for usage-gated keys). */
    usageLimit?: number | null;
    usage: number;
    expiresAt?: Date | null;
    validations: number;
    metadata?: Record<string, unknown> | null;
}

export interface LicenseActivationDTO {
    id: string;
    provider: PaymentProviderName;
    externalActivationId: string;
    licenseKeyId: string;
    label?: string | null;
    metadata?: Record<string, unknown> | null;
    createdAt: Date;
}

export interface ValidateLicenseInput {
    key: string;
    /** Optional activation id when validating a specific instance. */
    activationId?: string;
    /** Increment usage counter on success (for usage-gated keys). */
    incrementUsage?: number;
}

export interface ValidateLicenseResult {
    valid: boolean;
    licenseKey: LicenseKeyDTO | null;
    activation?: LicenseActivationDTO | null;
    /** Provider-native error code when invalid (e.g. 'expired', 'revoked', 'limit_reached'). */
    reason?: string;
}

export interface ActivateLicenseInput {
    key: string;
    /** Free-form label (e.g. machine name). */
    label?: string;
    metadata?: Record<string, string>;
}

export interface DeactivateLicenseInput {
    key: string;
    activationId: string;
}

// ============================================================
// Server-side subscription creation
// ============================================================

export interface CreateSubscriptionInput {
    userId: string;
    /** Plan slug from the local catalog. */
    plan: string;
    /** Optional discount id or code to attach. */
    discount?: string;
    /** Optional pre-resolved customer email. */
    email?: string;
    /** Trial length in days (provider must support). */
    trialDays?: number;
    metadata?: Record<string, string>;
}

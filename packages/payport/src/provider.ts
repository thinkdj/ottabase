// ============================================================
// Payport — Provider Contract
// ============================================================
//
// Every billing provider (Polar v1, Stripe later, etc.) must
// implement this contract. Application code never imports a
// provider directly — it goes through the `Payport` facade,
// which dispatches to the active provider via this interface.
// ============================================================

import type {
    ActivateLicenseInput,
    BillingPortalResult,
    CreateBillingPortalInput,
    CreateCheckoutInput,
    CreateCheckoutResult,
    CreateDiscountInput,
    CreateRefundInput,
    CreateSubscriptionInput,
    CustomerMeterDTO,
    CustomerMeterQuery,
    DeactivateLicenseInput,
    DiscountDTO,
    LicenseActivationDTO,
    LicenseKeyDTO,
    MeterDTO,
    NormalizedWebhook,
    PaymentCustomerDTO,
    PaymentProviderName,
    ProductDTO,
    RecordUsageInput,
    RefundDTO,
    SubscriptionDTO,
    ValidateLicenseInput,
    ValidateLicenseResult,
    VerifyWebhookInput,
} from './types';

export interface CreateCustomerInput {
    userId: string;
    email: string;
    name?: string;
    metadata?: Record<string, string>;
}

export interface UpdateSubscriptionInput {
    /** Provider-native subscription id. */
    externalSubscriptionId: string;
    /** New plan slug (resolved to provider product by adapter). */
    newPlan?: string;
    cancelAtPeriodEnd?: boolean;
    metadata?: Record<string, string>;
}

/**
 * Capability matrix advertised by an adapter so the facade can fail fast
 * with clear errors when an app calls into a provider that does not
 * support a feature (e.g. Stripe-only flows on Polar, or vice-versa).
 */
export interface ProviderCapabilities {
    meters: boolean;
    refunds: boolean;
    discounts: boolean;
    licenseKeys: boolean;
    serverSideSubscriptions: boolean;
}

export interface PaymentProvider {
    readonly name: PaymentProviderName;
    /** Optional self-declared capability matrix. Missing flags default to `false`. */
    readonly capabilities?: Partial<ProviderCapabilities>;

    // -- Customers --
    createCustomer(input: CreateCustomerInput): Promise<PaymentCustomerDTO>;
    getCustomer(externalCustomerId: string): Promise<PaymentCustomerDTO | null>;

    // -- Products / Plans (used by `payport sync-products`) --
    listProducts(): Promise<ProductDTO[]>;

    // -- Checkout --
    createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;

    // -- Subscriptions --
    getSubscription(externalSubscriptionId: string): Promise<SubscriptionDTO | null>;
    updateSubscription(input: UpdateSubscriptionInput): Promise<SubscriptionDTO>;
    cancelSubscription(externalSubscriptionId: string, immediate?: boolean): Promise<SubscriptionDTO>;
    resumeSubscription(externalSubscriptionId: string): Promise<SubscriptionDTO>;

    // -- Billing portal --
    createBillingPortalSession(input: CreateBillingPortalInput): Promise<BillingPortalResult>;

    // -- Webhooks --
    /** Throws on signature failure. */
    verifyWebhook(input: VerifyWebhookInput): Promise<void> | void;
    /** Convert a verified provider payload into the universal Payport event(s). */
    handleWebhook(input: VerifyWebhookInput): Promise<NormalizedWebhook>;

    // -- Optional: Server-side subscription creation --
    createSubscription?(input: CreateSubscriptionInput): Promise<SubscriptionDTO>;

    // -- Optional: Discounts --
    listDiscounts?(): Promise<DiscountDTO[]>;
    getDiscount?(externalDiscountId: string): Promise<DiscountDTO | null>;
    createDiscount?(input: CreateDiscountInput): Promise<DiscountDTO>;
    deleteDiscount?(externalDiscountId: string): Promise<void>;

    // -- Optional: Meters / usage-based billing --
    listMeters?(): Promise<MeterDTO[]>;
    getMeter?(externalMeterId: string): Promise<MeterDTO | null>;
    recordUsage?(input: RecordUsageInput): Promise<void>;
    getCustomerMeter?(input: CustomerMeterQuery): Promise<CustomerMeterDTO | null>;

    // -- Optional: Refunds --
    listRefunds?(query?: { externalOrderId?: string; externalSubscriptionId?: string }): Promise<RefundDTO[]>;
    getRefund?(externalRefundId: string): Promise<RefundDTO | null>;
    createRefund?(input: CreateRefundInput): Promise<RefundDTO>;

    // -- Optional: License keys --
    listLicenseKeys?(query?: { userId?: string; externalCustomerId?: string }): Promise<LicenseKeyDTO[]>;
    getLicenseKey?(externalLicenseKeyId: string): Promise<LicenseKeyDTO | null>;
    validateLicenseKey?(input: ValidateLicenseInput): Promise<ValidateLicenseResult>;
    activateLicenseKey?(input: ActivateLicenseInput): Promise<LicenseActivationDTO>;
    deactivateLicenseKey?(input: DeactivateLicenseInput): Promise<void>;
}

// ============================================================
// @ottabase/payport — Public API
// ============================================================

export { ProviderCapabilityError } from './core/capabilities';
export {
    can,
    clearEntitlementsCache,
    hasFeature,
    requireActiveSubscription,
    requireFeature,
    requirePlan,
    resolveEntitlements,
} from './core/entitlements';
export {
    clearEventBus,
    emit,
    on,
    onCheckoutCompleted,
    onPlanChanged,
    onSubscriptionActivated,
    onSubscriptionCancelled,
    onSubscriptionPaymentFailed,
    onSubscriptionTrialStarted,
} from './core/events';
export {
    definePlans,
    ensurePlansLoaded,
    getPlanCatalog,
    loadPlansFromDb,
    refreshPlans,
    registerPlans,
    resolvePlanBySlug,
    seedPlansIfEmpty,
} from './core/plans';
export type { PlanCatalog, PlanDefinition, SeedPlanInput } from './core/plans';
export {
    PaymentCheckout,
    PaymentCustomer,
    PaymentDiscount,
    PaymentEntitlement,
    PaymentEvent,
    PaymentLicenseActivation,
    PaymentLicenseKey,
    PaymentMeter,
    PaymentMeterEvent,
    PaymentPlan,
    PaymentProduct,
    PaymentRefund,
    PaymentSubscription,
    PAYPORT_MODELS,
} from './models';
export * from './payport';
export * from './provider';
export {
    paymentCheckoutsTable,
    paymentCustomersTable,
    paymentDiscountsTable,
    paymentEntitlementsTable,
    paymentEventsTable,
    paymentLicenseActivationsTable,
    paymentLicenseKeysTable,
    paymentMeterEventsTable,
    paymentMetersTable,
    paymentPlansTable,
    paymentProductsTable,
    paymentRefundsTable,
    paymentSubscriptionsTable,
} from './schema';
export type {
    PaymentCheckoutRecord,
    PaymentCustomerRecord,
    PaymentDiscountRecord,
    PaymentEntitlementRecord,
    PaymentEventRecord,
    PaymentLicenseActivationRecord,
    PaymentLicenseKeyRecord,
    PaymentMeterEventRecord,
    PaymentMeterRecord,
    PaymentPlanRecord,
    PaymentProductRecord,
    PaymentRefundRecord,
    PaymentSubscriptionRecord,
} from './schema';
export * from './types';

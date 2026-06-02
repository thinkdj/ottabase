// ============================================================
// Payport — Public Facade
// ============================================================
//
// Application code uses `payport.*` so it never depends on a
// specific provider SDK. Adapters are registered once at boot.
// ============================================================

import { ProviderCapabilityError } from './core/capabilities';
import { createCheckout } from './core/checkout';
import { ensureCustomer, getCustomerForUser, linkUserToCustomer, syncCustomer } from './core/customers';
import { createDiscount, deleteDiscount, getDiscount, listDiscounts, resolveDiscount } from './core/discounts';
import {
    ActiveSubscriptionRequiredError,
    can,
    clearEntitlementsCache,
    EntitlementError,
    hasFeature,
    PlanRequiredError,
    requireActiveSubscription,
    requireFeature,
    requirePlan,
    resolveEntitlements,
} from './core/entitlements';
import { clearEventBus, emit, on } from './core/events';
import {
    activateLicenseKey,
    deactivateLicenseKey,
    getLicenseKey,
    listLicenseKeys,
    validateLicenseKey,
} from './core/licenses';
import { getCustomerMeter, listMeters, recordUsage } from './core/meters';
import {
    definePlans,
    ensurePlansLoaded,
    getPlanCatalog,
    loadPlansFromDb,
    refreshPlans,
    registerPlans,
    resolvePlanBySlug,
    seedPlansIfEmpty,
} from './core/plans';
import { createRefund, getRefund, listRefunds } from './core/refunds';
import { getProvider, listProviders, registerProvider, setActiveProvider } from './core/registry';
import {
    cancelSubscription,
    changePlan,
    createSubscriptionForUser,
    getUserSubscription,
    listUserSubscriptions,
    resumeSubscription,
} from './core/subscriptions';
import { handleWebhookRequest, ingest, replayEvent } from './core/webhooks';

export const payport = {
    // provider lifecycle
    registerProvider,
    setActiveProvider,
    getProvider,
    listProviders,

    // plans
    definePlans,
    registerPlans,
    getPlanCatalog,
    resolvePlanBySlug,
    loadPlansFromDb,
    refreshPlans,
    ensurePlansLoaded,
    seedPlansIfEmpty,

    // customers
    customer: { ensure: ensureCustomer, get: getCustomerForUser, sync: syncCustomer, link: linkUserToCustomer },

    // checkout
    checkout: { create: createCheckout },

    // subscriptions
    subscriptions: {
        forUser: getUserSubscription,
        listForUser: listUserSubscriptions,
        cancel: cancelSubscription,
        resume: resumeSubscription,
        changePlan,
        create: createSubscriptionForUser,
    },

    // discounts / coupons
    discounts: {
        list: listDiscounts,
        get: getDiscount,
        create: createDiscount,
        delete: deleteDiscount,
        resolve: resolveDiscount,
    },

    // meters / usage-based billing
    meters: {
        list: listMeters,
        recordUsage,
        getCustomerMeter,
    },

    // refunds
    refunds: {
        create: createRefund,
        get: getRefund,
        list: listRefunds,
    },

    // license keys
    licenses: {
        list: listLicenseKeys,
        get: getLicenseKey,
        validate: validateLicenseKey,
        activate: activateLicenseKey,
        deactivate: deactivateLicenseKey,
    },

    // entitlements
    entitlements: {
        resolve: resolveEntitlements,
        has: hasFeature,
        can,
        requireFeature,
        requirePlan,
        requireActiveSubscription,
        /** Evict the short-TTL cache for a user (call after cancel/upgrade mutations). */
        clearCache: clearEntitlementsCache,
    },

    // webhooks
    webhooks: { handle: handleWebhookRequest, ingest, replay: replayEvent },

    // events
    events: { on, emit, clear: clearEventBus },
};

export type Payport = typeof payport;

export { ActiveSubscriptionRequiredError, EntitlementError, PlanRequiredError, ProviderCapabilityError };

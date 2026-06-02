// ============================================================
// Payport — Server-side public surface
// ============================================================

export {
    handleActivateLicense,
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
    type PayportRouteContext,
} from './routes';

export { PAYPORT_MODELS } from '../models';
export { payport } from '../payport';

// Admin endpoints (super-admin gated — caller must enforce auth).
export { handleAdminProvidersInfo, handleAdminResyncCustomer, handleAdminStats } from './admin-routes';

// ============================================================
// @ottabase/premium/server — worker-side entrypoint
// ============================================================
// Everything a Cloudflare Worker needs: the request-path gates, the route mounting
// helper, and the `/api/premium` control-plane router.
// ============================================================

export {
    premiumDeniedResponse,
    premiumDeniedStatus,
    requirePremium,
    requirePremiumFeature,
    requirePremiumLimit,
} from './guard';
export { mountPremiumPackages, type MountPremiumOptions } from './mount';
export { createPremiumAdminRouter, type PremiumAdminRouterOptions, type PremiumRouteGuard } from './routes';

// ============================================================
// @ottabase/premium/react — rendered entrypoint
// ============================================================
// Everything here renders or hooks into React. The root entrypoint stays headless so a
// Worker bundle never pulls a component library in through the back door.
// ============================================================

export {
    PremiumProvider,
    PremiumRequestError,
    usePremiumClient,
    type PremiumClientConfig,
    type PremiumRequest,
} from './context';

export {
    PREMIUM_ENTITY,
    premiumQueryKeys,
    usePremiumEnabled,
    usePremiumFeature,
    usePremiumLicense,
    usePremiumLimit,
    usePremiumPackage,
    usePremiumPackages,
} from './hooks';

export { PremiumBadge, PremiumGate, PremiumUpsell, type PremiumGateProps } from './PremiumGate';
export { PremiumPackagesManager, type PremiumPackagesManagerProps } from './PremiumPackagesManager';

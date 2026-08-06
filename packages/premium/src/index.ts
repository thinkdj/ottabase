// ============================================================
// @ottabase/premium — headless entrypoint
// ============================================================
// Types, manifest definition, license verification, entitlements, lifecycle and the
// registry. NO REACT LIVES HERE: rendered components are behind `@ottabase/premium/react`
// and the worker helpers behind `@ottabase/premium/server`, so a Worker bundle never
// pulls in a component library and the browser never pulls in the router.
// ============================================================

export {
    collectPremiumMigrations,
    collectPremiumModels,
    collectPremiumNav,
    collectPremiumPolicies,
    collectPremiumTables,
} from './collect';

export { definePremiumPackage } from './define';

export {
    UNLIMITED,
    checkFeature,
    checkLimit,
    isServingState,
    resolveFeatures,
    resolveLimits,
    type EntitlementInput,
} from './entitlements';

export {
    LICENSE_TOKEN_PREFIX,
    base64UrlToBytes,
    bytesToBase64Url,
    parseLicenseToken,
    verifyLicenseSignature,
    type ParsedLicenseToken,
} from './license/token';
export { DEFAULT_GRACE_DAYS, licenseExpiresAt, verifyLicense, type VerifyLicenseOptions } from './license/verify';

export {
    applyDisabledLifecycle,
    applyLifecycle,
    applyUninstall,
    type ApplyLifecycleInput,
    type ApplyLifecycleResult,
    type PremiumLogger,
    type PremiumTransition,
} from './lifecycle';

export {
    LICENSE_MAP_ENV_KEY,
    createPremiumRegistry,
    licenseEnvKey,
    toggleEnvKey,
    type PremiumRegistry,
    type PremiumRegistryOptions,
    type PremiumResolution,
} from './registry';

export { DEFAULT_STATE_PREFIX, createKvStateStore, createMemoryStateStore, type KVNamespaceLike } from './state-store';

export { checkFeatureFromStatus, checkLimitFromStatus } from './status-gates';

export type {
    PremiumGateAnswer,
    PremiumInstallRecord,
    PremiumLicenseClaims,
    PremiumLicenseResult,
    PremiumLicenseSource,
    PremiumLifecycleContext,
    PremiumLifecycleHooks,
    PremiumNavItem,
    PremiumPackage,
    PremiumPackageStatus,
    PremiumReason,
    PremiumRouteContribution,
    PremiumState,
    PremiumStateStore,
} from './types';

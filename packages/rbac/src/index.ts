// ============================================================
// @ottabase/rbac - Main Export
// ============================================================

// Types
export { RBACError } from './types';
export type { PermissionCheckResult, RBACCheckOptions, RBACContext } from './types';

// Utils
export {
    createRBACContext,
    evaluatePermission,
    evaluateRole,
    formatPermission,
    getAllowedActions,
    hasPermission,
    hasRole,
    isAdmin,
    parsePermission,
} from './utils';

// Middleware
export { checkPermission, checkRole, requirePermission, requireRole, withRBAC } from './middleware';

// Cache
export { RBACCache, clearRBACCache, getRBACCache, initRBACCache } from './cache';
export type { RBACCacheConfig } from './cache';

// App Context (Unified Tenant > App > User hierarchy)
export {
    buildAppContext,
    hasPermission as contextHasPermission,
    createAuditData,
    hasAllRoles,
    hasAnyRole,
    isOwnerOrAdmin,
} from './app-context';
export type { AppContext, BuildAppContextOptions } from './app-context';

// Request context + admin guard
export { assertAdmin, assertBrandEditAccess, isOrgAdmin, isPlatformAdmin, requireAdminAccess } from './admin-guard';
export type { AdminScope, AssertAdminOptions, AssertPermissionOptions } from './admin-guard';
export { SYSTEM_ORGANIZATION_ID, getRequestContext } from './request-context';
export type { GetRequestContextOptions, RequestContext } from './request-context';

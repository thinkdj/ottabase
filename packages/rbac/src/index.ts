// ============================================================
// @ottabase/rbac - Main Export
// ============================================================

// Types
export type { RBACContext, RBACCheckOptions, PermissionCheckResult } from './types';
export { RBACError } from './types';

// Utils
export {
    createRBACContext,
    hasPermission,
    hasRole,
    isAdmin,
    getAllowedActions,
    formatPermission,
    parsePermission,
} from './utils';

// Middleware
export { withRBAC, requirePermission, requireRole, checkPermission, checkRole } from './middleware';

// Context (React)
export type { RBACContextValue } from './context';

// Cache
export type { RBACCacheConfig } from './cache';
export { RBACCache, initRBACCache, getRBACCache, clearRBACCache } from './cache';

// App Context (Unified Tenant > App > User hierarchy)
export type { AppContext, BuildAppContextOptions, ExtractOrgOptions, ExtractAppOptions } from './app-context';
export {
    buildAppContext,
    extractOrganizationId,
    extractAppId,
    hasPermission as contextHasPermission,
    hasAnyRole,
    hasAllRoles,
    isOwnerOrAdmin,
    createAuditData,
} from './app-context';

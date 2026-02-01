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

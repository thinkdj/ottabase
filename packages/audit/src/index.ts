// ============================================================
// @ottabase/audit - Main Export
// ============================================================

// Types
export type { AuditAction, AuditStatus, AuditLogData, AuditRequestContext, AuditMiddlewareOptions } from './types';

// Utils
export {
    log, // Simple: log(userId, action, metadata?, userEmail?)
    logAudit,
    logCreate,
    logUpdate,
    logDelete,
    logRead,
    logAuth,
    logRoleAssign,
    logRoleRemove,
    logFailure,
    extractRequestContext,
    detectChanges,
    sanitizeData,
} from './utils';

// Middleware
export { withAudit, createAuditMiddleware, Audit } from './middleware';

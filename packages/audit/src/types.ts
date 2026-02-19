// ============================================================
// @ottabase/audit - Types
// ============================================================

/**
 * Audit action types
 */
export type AuditAction =
    | 'create'
    | 'read'
    | 'update'
    | 'delete'
    | 'login'
    | 'logout'
    | 'signup'
    | 'password_change'
    | 'password_reset'
    | 'email_verify'
    | 'role_assign'
    | 'role_remove'
    | 'permission_grant'
    | 'permission_revoke'
    | 'export'
    | 'import'
    | 'custom';

/**
 * Audit status
 */
export type AuditStatus = 'success' | 'failure' | 'error';

/**
 * Audit log data (multi-tenant and multi-app aware)
 * Hierarchy: Tenant > App > User
 */
export interface AuditLogData {
    userId?: string;
    userEmail?: string;
    organizationId?: string; // Organization/tenant context
    appId?: string; // App context (web, admin, api)
    action: AuditAction | string;
    resourceType: string;
    resourceId?: string;
    changes?: Record<string, { from?: any; to?: any }>;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    status?: AuditStatus;
    errorMessage?: string;
}

/**
 * Request context for audit logging (multi-tenant and multi-app aware)
 * Hierarchy: Tenant > App > User
 */
export interface AuditRequestContext {
    userId?: string;
    userEmail?: string;
    organizationId?: string; // Organization/tenant context
    appId?: string; // App context (web, admin, api)
    ipAddress?: string;
    userAgent?: string;
    url?: string;
    method?: string;
}

/**
 * Audit middleware options
 */
export interface AuditMiddlewareOptions {
    resourceType: string;
    action?: AuditAction | string;
    getResourceId?: (request: Request, params?: any) => string | Promise<string | undefined>;
    getChanges?: (request: Request, params?: any) => Record<string, any> | Promise<Record<string, any> | undefined>;
    includeRequestBody?: boolean;
    includeResponseBody?: boolean;
}

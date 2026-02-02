// ============================================================
// @ottabase/rbac - Types
// ============================================================

import type { User } from '@ottabase/ottaorm/models';

/**
 * RBAC Context - contains user and their permissions with multi-tenant support
 */
export interface RBACContext {
    user: User | null;
    roles: string[];
    permissions: string[];
    isAuthenticated: boolean;
    organizationId?: string; // Organization/tenant context
    tenantId?: string; // Alternative tenant identifier
}

/**
 * RBAC Check Options
 */
export interface RBACCheckOptions {
    requireAll?: boolean; // Require all permissions/roles (default: false)
    organizationId?: string; // Optional organization scoping
}

/**
 * RBAC Error
 */
export class RBACError extends Error {
    constructor(
        message: string,
        public code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'INVALID_PERMISSION' = 'FORBIDDEN',
        public details?: any
    ) {
        super(message);
        this.name = 'RBACError';
    }
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
    allowed: boolean;
    reason?: string;
    missingPermissions?: string[];
    missingRoles?: string[];
}

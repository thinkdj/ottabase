// ============================================================
// @ottabase/audit - Utilities
// ============================================================

import { AuditLog } from '@ottabase/ottaorm/models';
import type { AuditLogData, AuditRequestContext } from './types';
import logger from '@ottabase/logger';

/**
 * Log an audit event
 */
export async function logAudit(data: AuditLogData): Promise<void> {
    try {
        await AuditLog.log(data);
    } catch (error: any) {
        logger.error('Failed to log audit event', error instanceof Error ? error : new Error(String(error)), { data });
        throw error;
    }
}

/**
 * Simple audit logger - logs which user did what action with optional metadata
 *
 * @example
 * ```typescript
 * // Simple usage
 * await log('user-123', 'updated_profile', { field: 'name', value: 'John' });
 *
 * // With user email
 * await log('user-123', 'deleted_post', { postId: 'post-456' }, 'user@example.com');
 * ```
 */
export async function log(
    userId: string,
    action: string,
    metadata?: Record<string, any>,
    userEmail?: string,
): Promise<void> {
    await logAudit({
        userId,
        userEmail,
        action,
        resourceType: 'custom',
        metadata,
        status: 'success',
    });
}

/**
 * Log create action
 */
export async function logCreate(
    resourceType: string,
    resourceId: string,
    data: Record<string, any>,
    context?: AuditRequestContext,
): Promise<void> {
    await logAudit({
        userId: context?.userId,
        userEmail: context?.userEmail,
        action: 'create',
        resourceType,
        resourceId,
        changes: { created: data },
        metadata: {
            url: context?.url,
            method: context?.method,
        },
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        status: 'success',
    });
}

/**
 * Log update action
 */
export async function logUpdate(
    resourceType: string,
    resourceId: string,
    changes: Record<string, { from: any; to: any }>,
    context?: AuditRequestContext,
): Promise<void> {
    await logAudit({
        userId: context?.userId,
        userEmail: context?.userEmail,
        action: 'update',
        resourceType,
        resourceId,
        changes,
        metadata: {
            url: context?.url,
            method: context?.method,
        },
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        status: 'success',
    });
}

/**
 * Log delete action
 */
export async function logDelete(
    resourceType: string,
    resourceId: string,
    context?: AuditRequestContext,
): Promise<void> {
    await logAudit({
        userId: context?.userId,
        userEmail: context?.userEmail,
        action: 'delete',
        resourceType,
        resourceId,
        metadata: {
            url: context?.url,
            method: context?.method,
        },
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        status: 'success',
    });
}

/**
 * Log read/access action
 */
export async function logRead(resourceType: string, resourceId: string, context?: AuditRequestContext): Promise<void> {
    await logAudit({
        userId: context?.userId,
        userEmail: context?.userEmail,
        action: 'read',
        resourceType,
        resourceId,
        metadata: {
            url: context?.url,
            method: context?.method,
        },
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        status: 'success',
    });
}

/**
 * Log authentication action
 */
export async function logAuth(
    action: 'login' | 'logout' | 'signup',
    userId: string,
    userEmail: string,
    context?: AuditRequestContext,
    success: boolean = true,
): Promise<void> {
    await logAudit({
        userId,
        userEmail,
        action,
        resourceType: 'auth',
        resourceId: userId,
        metadata: {
            url: context?.url,
            method: context?.method,
        },
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        status: success ? 'success' : 'failure',
    });
}

/**
 * Log role assignment
 */
export async function logRoleAssign(
    userId: string,
    roleId: string,
    roleName: string,
    assignedBy?: string,
    context?: AuditRequestContext,
): Promise<void> {
    await logAudit({
        userId: assignedBy,
        userEmail: context?.userEmail,
        action: 'role_assign',
        resourceType: 'user_role',
        resourceId: userId,
        changes: {
            role: { to: roleName },
        },
        metadata: {
            roleId,
            roleName,
            assignedTo: userId,
            url: context?.url,
            method: context?.method,
        },
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        status: 'success',
    });
}

/**
 * Log role removal
 */
export async function logRoleRemove(
    userId: string,
    roleId: string,
    roleName: string,
    removedBy?: string,
    context?: AuditRequestContext,
): Promise<void> {
    await logAudit({
        userId: removedBy,
        userEmail: context?.userEmail,
        action: 'role_remove',
        resourceType: 'user_role',
        resourceId: userId,
        changes: {
            role: { from: roleName },
        },
        metadata: {
            roleId,
            roleName,
            removedFrom: userId,
            url: context?.url,
            method: context?.method,
        },
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        status: 'success',
    });
}

/**
 * Log failed action
 */
export async function logFailure(
    action: string,
    resourceType: string,
    error: Error | string,
    context?: AuditRequestContext,
    resourceId?: string,
): Promise<void> {
    await logAudit({
        userId: context?.userId,
        userEmail: context?.userEmail,
        action,
        resourceType,
        resourceId,
        metadata: {
            url: context?.url,
            method: context?.method,
        },
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        status: 'failure',
        errorMessage: typeof error === 'string' ? error : error.message,
    });
}

/**
 * Extract request context from Request object
 */
export function extractRequestContext(request: Request, userId?: string, userEmail?: string): AuditRequestContext {
    return {
        userId,
        userEmail,
        ipAddress: request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        url: request.url,
        method: request.method,
    };
}

/**
 * Compare objects and extract changes
 */
export function detectChanges(
    oldData: Record<string, any>,
    newData: Record<string, any>,
): Record<string, { from: any; to: any }> {
    const changes: Record<string, { from: any; to: any }> = {};

    // Check for changed and new fields
    for (const key in newData) {
        if (oldData[key] !== newData[key]) {
            changes[key] = {
                from: oldData[key],
                to: newData[key],
            };
        }
    }

    // Check for removed fields
    for (const key in oldData) {
        if (!(key in newData)) {
            changes[key] = {
                from: oldData[key],
                to: undefined,
            };
        }
    }

    return changes;
}

/**
 * Sanitize sensitive data before logging
 */
export function sanitizeData(
    data: Record<string, any>,
    sensitiveFields: string[] = ['password', 'token', 'secret', 'apiKey'],
): Record<string, any> {
    const sanitized = { ...data };

    for (const field of sensitiveFields) {
        if (field in sanitized) {
            sanitized[field] = '[REDACTED]';
        }
    }

    return sanitized;
}

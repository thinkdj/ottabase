/**
 * RLS Security Violation Logger
 *
 * Logs security violations for monitoring and audit.
 * Integrates with @ottabase/ottaorm AuditLog model
 * to persist violations to the audit_logs D1 table.
 */

import type { RLSViolation } from './types';
import { AuditLog } from '../models/AuditLog';

// Type declaration for process (may not exist in all environments)
declare const process: { env?: { NODE_ENV?: string } } | undefined;

/** Resource type used for RLS violation audit entries */
const RLS_RESOURCE_TYPE = 'rls_security';

/**
 * Log security violation
 * In production, send to monitoring service (Sentry, CloudWatch, etc.)
 */
export function logSecurityViolation(violation: RLSViolation): void {
    const logEntry = {
        severity: 'ERROR',
        type: 'SECURITY_VIOLATION',
        violation: {
            type: violation.type,
            model: violation.model,
            timestamp: new Date(violation.timestamp).toISOString(),
            context: {
                userId: violation.context.userId || 'anonymous',
                organizationId: violation.context.organizationId || null,
                appId: violation.context.appId || null,
            },
            attemptedAccess: violation.attemptedAccess,
        },
    };

    // Log to console in development (Cloudflare Workers have no process; use env or assume dev when not in production)
    const isProduction = typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
    if (!isProduction) {
        console.error('🚨 RLS VIOLATION:', JSON.stringify(logEntry, null, 2));
    }

    // In production, send to monitoring
    // Example: Sentry, CloudWatch, Datadog, etc.
    // if (process.env.NODE_ENV === 'production') {
    //   Sentry.captureException(new Error('RLS Violation'), {
    //     extra: logEntry,
    //   });
    // }

    // Store in audit log for compliance
    // This is async, but we don't await to avoid blocking the request
    storeAuditLog(violation).catch((err) => {
        console.error('Failed to store RLS violation audit log:', err);
    });
}

/**
 * Store RLS violation in the audit_logs table via the AuditLog model.
 */
async function storeAuditLog(violation: RLSViolation): Promise<void> {
    await AuditLog.log({
        userId: violation.context.userId,
        organizationId: violation.context.organizationId || undefined,
        action: 'security_violation',
        resourceType: RLS_RESOURCE_TYPE,
        resourceId: violation.model,
        status: 'failure',
        errorMessage: `RLS ${violation.type} on model "${violation.model}"`,
        metadata: {
            violationType: violation.type,
            attemptedAccess: violation.attemptedAccess,
            appId: violation.context.appId,
            roles: violation.context.roles,
            permissions: violation.context.permissions,
        },
    });
}

/**
 * Get recent violations (for monitoring dashboard).
 * Queries the audit_logs table for entries with resourceType 'rls_security'.
 */
export async function getRecentViolations(limit = 100): Promise<RLSViolation[]> {
    const logs = await AuditLog.where({
        resourceType: RLS_RESOURCE_TYPE,
        action: 'security_violation',
    });

    return logs.slice(0, limit).map((log) => {
        const metadata = log.getMetadata();
        return {
            type: metadata.violationType || 'unauthorized_access',
            model: log.get('resourceId') || 'unknown',
            context: {
                userId: log.get('userId') || undefined,
                organizationId: log.get('organizationId') || undefined,
                appId: metadata.appId || undefined,
                roles: metadata.roles || undefined,
                permissions: metadata.permissions || undefined,
            },
            attemptedAccess: metadata.attemptedAccess,
            timestamp: log.get('createdAt') instanceof Date
                ? log.get('createdAt').getTime()
                : Date.now(),
        };
    });
}

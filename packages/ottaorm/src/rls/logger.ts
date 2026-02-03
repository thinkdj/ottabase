/**
 * RLS Security Violation Logger
 *
 * Logs security violations for monitoring and audit
 */

import type { RLSViolation } from './types';

// Type declaration for process (may not exist in all environments)
declare const process: { env?: { NODE_ENV?: string } } | undefined;

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
    storeAuditLog(logEntry).catch((err) => {
        console.error('Failed to store RLS violation audit log:', err);
    });
}

/**
 * Store audit log (implementation depends on your audit system)
 */
async function storeAuditLog(logEntry: any): Promise<void> {
    // TODO: Integrate with @ottabase/audit package
    // For now, just log to console
    // In production, write to D1 audit_logs table
}

/**
 * Get recent violations (for monitoring dashboard)
 */
export async function getRecentViolations(limit = 100): Promise<RLSViolation[]> {
    // TODO: Fetch from audit logs
    return [];
}

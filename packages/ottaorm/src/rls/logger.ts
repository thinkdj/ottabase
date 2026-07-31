/**
 * RLS Security Violation Logger
 *
 * Logs security violations for monitoring and audit.
 * Integrates with @ottabase/ottaorm AuditLog model
 * to persist violations to the audit_logs D1 table.
 */

import { redactErrorForLog } from '@ottabase/utils/http-errors';
import { hasConnection } from '../context';
import { AuditLog } from '../models/AuditLog';
import type { RLSViolation } from './types';

/** Resource type used for RLS violation audit entries */
const RLS_RESOURCE_TYPE = 'rls_security';
const MAX_IDENTIFIER_LENGTH = 128;
const MAX_ATTEMPTED_FIELDS = 50;
const MAX_FIELD_NAME_LENGTH = 64;
const MAX_RECENT_VIOLATIONS = 1_000;

export interface RLSAttemptSummary {
    operation?: string;
    fields?: string[];
    fieldCount?: number;
    truncated?: boolean;
}

export interface SanitizedRLSViolation {
    type: RLSViolation['type'];
    model: string;
    context: {
        userId?: string;
        organizationId?: string;
        appId?: string;
    };
    attemptedAccess?: RLSAttemptSummary;
    timestamp: number;
}

function boundedIdentifier(value: unknown, maxLength = MAX_IDENTIFIER_LENGTH): string | undefined {
    if (typeof value !== 'string') return undefined;
    const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '');
    return cleaned ? cleaned.slice(0, maxLength) : undefined;
}

function summarizeAttemptedAccess(attemptedAccess: unknown): RLSAttemptSummary | undefined {
    if (!attemptedAccess || typeof attemptedAccess !== 'object' || Array.isArray(attemptedAccess)) {
        return undefined;
    }

    const attempted = attemptedAccess as Record<string, unknown>;
    const operation = boundedIdentifier(attempted.operation, 32);
    const data =
        attempted.data && typeof attempted.data === 'object' && !Array.isArray(attempted.data)
            ? (attempted.data as Record<string, unknown>)
            : undefined;
    const storedFields = Array.isArray(attempted.fields) ? attempted.fields : undefined;
    const rawFields = data ? Object.keys(data) : (storedFields ?? []);
    const fields = rawFields
        .slice(0, MAX_ATTEMPTED_FIELDS)
        .map((field) => boundedIdentifier(field, MAX_FIELD_NAME_LENGTH))
        .filter((field): field is string => Boolean(field));
    const storedFieldCount =
        typeof attempted.fieldCount === 'number' && Number.isFinite(attempted.fieldCount)
            ? Math.max(0, Math.floor(attempted.fieldCount))
            : undefined;
    const fieldCount = storedFieldCount ?? rawFields.length;

    if (!operation && fields.length === 0) return undefined;

    return {
        operation,
        fields: fields.length > 0 ? fields : undefined,
        fieldCount: fieldCount > 0 ? fieldCount : undefined,
        truncated: fieldCount > MAX_ATTEMPTED_FIELDS || attempted.truncated === true || undefined,
    };
}

/**
 * Reduce a violation to bounded identifiers and attempted field names. Request
 * values, roles, permissions, credentials, and other body content never enter
 * console or persistent audit logs.
 */
export function sanitizeRlsViolationForAudit(violation: RLSViolation): SanitizedRLSViolation {
    return {
        type: violation.type,
        model: boundedIdentifier(violation.model) ?? 'unknown',
        context: {
            userId: boundedIdentifier(violation.context.userId),
            organizationId: boundedIdentifier(violation.context.organizationId),
            appId: boundedIdentifier(violation.context.appId),
        },
        attemptedAccess: summarizeAttemptedAccess(violation.attemptedAccess),
        timestamp: Number.isFinite(violation.timestamp) ? violation.timestamp : Date.now(),
    };
}

/**
 * Log security violation and persist to audit log.
 * Returns a promise that resolves when the audit entry is stored.
 * Callers that cannot await (e.g. constructor paths) should use
 * `logSecurityViolation(...).catch(...)` explicitly.
 */
export async function logSecurityViolation(violation: RLSViolation): Promise<void> {
    const sanitizedViolation = sanitizeRlsViolationForAudit(violation);
    console.error(
        JSON.stringify({
            event: 'rls_security_violation',
            severity: 'error',
            violation: sanitizedViolation,
        }),
    );

    // Store in audit log for compliance
    try {
        await storeAuditLog(sanitizedViolation);
    } catch (err) {
        console.error(
            JSON.stringify({
                event: 'rls_audit_write_failed',
                error: redactErrorForLog(err),
            }),
        );
    }
}

/**
 * Store RLS violation in the audit_logs table via the AuditLog model.
 * Skips silently when no database connection is registered (e.g. in tests).
 */
async function storeAuditLog(violation: SanitizedRLSViolation): Promise<void> {
    if (!hasConnection('default')) return;

    await AuditLog.log({
        userId: violation.context.userId,
        organizationId: violation.context.organizationId,
        action: 'security_violation',
        resourceType: RLS_RESOURCE_TYPE,
        resourceId: violation.model,
        status: 'failure',
        errorMessage: `RLS ${violation.type} on model "${violation.model}"`,
        metadata: {
            violationType: violation.type,
            attemptedAccess: violation.attemptedAccess,
            appId: violation.context.appId,
        },
    });
}

/**
 * Get recent violations (for monitoring dashboard).
 * Queries the audit_logs table for entries with resourceType 'rls_security'.
 */
export async function getRecentViolations(limit = 100): Promise<RLSViolation[]> {
    const boundedLimit = Number.isFinite(limit) ? Math.min(MAX_RECENT_VIOLATIONS, Math.max(1, Math.floor(limit))) : 100;

    // Order + limit at the DB layer so this returns the genuinely most-recent N rows
    // and never loads the whole audit_logs table into memory.
    const logs = await AuditLog.where(
        {
            resourceType: RLS_RESOURCE_TYPE,
            action: 'security_violation',
        },
        { orderBy: 'createdAt', orderDirection: 'desc', limit: boundedLimit },
    );

    return logs.map((log) => {
        const metadata = log.getMetadata();
        return {
            type: metadata.violationType || 'unauthorized_access',
            model: log.get('resourceId') || 'unknown',
            context: {
                userId: log.get('userId') || undefined,
                organizationId: log.get('organizationId') || undefined,
                appId: boundedIdentifier(metadata.appId),
            },
            attemptedAccess: summarizeAttemptedAccess(metadata.attemptedAccess),
            timestamp: log.get('createdAt') instanceof Date ? log.get('createdAt').getTime() : Date.now(),
        };
    });
}

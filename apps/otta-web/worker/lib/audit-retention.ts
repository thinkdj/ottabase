// Audit-log retention. `audit_logs` is append-only (every secure-CRUD violation, auth event and
// admin mutation adds a row), so without a prune it grows without bound toward D1's database
// size limit. A DB-driven scheduled task (handler `audit:prune`) deletes this app's rows (and
// unowned rows) older than the retention window once a day. The window lives in the task
// payload — an operator changes it in the Cron admin, and a task they paused stays paused.
//
// The handler and its default schedule are declared by the core package manifest
// (ottabase/packages/core.ts); `ensurePackageSchedules` seeds the task on install.

import { AuditLog } from '@ottabase/ottaorm/models';

export const AUDIT_PRUNE_HANDLER = 'audit:prune';
export const DEFAULT_AUDIT_RETENTION_DAYS = 90;

export interface AuditPrunePayload {
    olderThanDays?: number;
}

/** The retention window from an operator-edited payload; a non-positive window is refused, never "delete everything". */
export function auditRetentionDays(payload: unknown): number {
    const raw =
        payload && typeof payload === 'object' && !Array.isArray(payload)
            ? (payload as AuditPrunePayload).olderThanDays
            : undefined;
    if (raw === undefined || raw === null) return DEFAULT_AUDIT_RETENTION_DAYS;
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) {
        throw new Error(`Handler ${AUDIT_PRUNE_HANDLER}: payload.olderThanDays must be a positive number`);
    }
    return raw;
}

/** Delete this app's audit rows older than the window. Returns how many went. */
export async function pruneAuditLogs(payload: unknown, appId: string): Promise<number> {
    return AuditLog.pruneOlderThan(auditRetentionDays(payload), appId);
}

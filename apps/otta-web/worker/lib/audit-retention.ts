// Audit-log retention. `audit_logs` is append-only (every secure-CRUD violation, auth event and
// admin mutation adds a row), so without a prune it grows without bound toward D1's database
// size limit. A DB-driven scheduled task (handler `audit:prune`) deletes this app's rows (and
// unowned rows) older than the retention window once a day. The window lives in the task
// payload — an operator changes it in the Cron admin, and a task they paused stays paused.

import { AuditLog, ScheduledTask } from '@ottabase/ottaorm/models';

export const AUDIT_PRUNE_HANDLER = 'audit:prune';
const AUDIT_PRUNE_TASK = 'Prune audit logs';
/** Default retention when the task payload names none. */
export const DEFAULT_AUDIT_RETENTION_DAYS = 90;

export interface AuditPrunePayload {
    olderThanDays?: number;
}

/** Resolve the retention window from an operator-edited payload; anything not a positive number is rejected. */
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

/** Delete this app's audit rows older than the window; returns the number removed. */
export async function pruneAuditLogs(payload: unknown, appId: string): Promise<number> {
    return AuditLog.pruneOlderThan(auditRetentionDays(payload), appId);
}

/**
 * Create the daily prune task for this app if it does not exist yet. Idempotent; called from the
 * same seed step as the default brand kit, so every initialised app has a retention policy.
 * Runs at 03:17 UTC — off the top-of-the-hour bunching every other schedule gravitates to.
 */
export async function ensureAuditPruneTask(appId: string): Promise<void> {
    if (await ScheduledTask.findByName(appId, AUDIT_PRUNE_TASK)) return;
    await ScheduledTask.createRegistered(
        {
            name: AUDIT_PRUNE_TASK,
            description: `Deletes this app's audit_logs rows older than the retention window (payload olderThanDays, default ${DEFAULT_AUDIT_RETENTION_DAYS}).`,
            schedule: '17 3 * * *',
            taskType: 'handler',
            task: AUDIT_PRUNE_HANDLER,
            payload: JSON.stringify({ olderThanDays: DEFAULT_AUDIT_RETENTION_DAYS }),
            isActive: true,
            appId,
        },
        [AUDIT_PRUNE_HANDLER],
    );
}

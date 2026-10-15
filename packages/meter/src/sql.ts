// ============================================================
// The statements, as pure functions. Everything the meter does is one of these plus a
// look at `meta.changes` or `results`. Keeping them here means the test for "does the
// SQL say what we mean" is a string comparison, and the test for the state machine is a
// fake driver that interprets these few shapes.
// ============================================================

import type { GrantInput, Subject } from './types';

export interface Statement {
    sql: string;
    params: unknown[];
}

/**
 * Personal and org-wide balances store '' rather than NULL in the two scope columns: SQLite
 * treats every NULL as distinct in a UNIQUE index, so NULL scopes could not be unique.
 */
export function scopeColumns(subject: Subject): { organizationId: string; userId: string } {
    return { organizationId: subject.organizationId ?? '', userId: subject.userId ?? '' };
}

const WHERE_BALANCE = 'app_id = ? AND organization_id = ? AND user_id = ? AND meter = ?';

function balanceKey(subject: Subject, meter: string): unknown[] {
    const scope = scopeColumns(subject);
    return [subject.appId, scope.organizationId, scope.userId, meter];
}

export function selectBalance(subject: Subject, meter: string): Statement {
    return {
        sql: `SELECT id, meter, credits, used, period_start, period_end, reset_credits FROM meter_balances WHERE ${WHERE_BALANCE} LIMIT 1`,
        params: balanceKey(subject, meter),
    };
}

export function selectBalances(subject: Subject): Statement {
    const scope = scopeColumns(subject);
    return {
        sql: 'SELECT id, meter, credits, used, period_start, period_end, reset_credits FROM meter_balances WHERE app_id = ? AND organization_id = ? AND user_id = ? ORDER BY meter',
        params: [subject.appId, scope.organizationId, scope.userId],
    };
}

/** The one that matters: moves `used` only while the result still fits and the period is open. */
export function consumeBalance(subject: Subject, meter: string, amount: number, now: number): Statement {
    return {
        sql: `UPDATE meter_balances SET used = used + ?, updated_at = ? WHERE ${WHERE_BALANCE} AND (credits IS NULL OR used + ? <= credits) AND (period_end IS NULL OR period_end > ?)`,
        params: [amount, now, ...balanceKey(subject, meter), amount, now],
    };
}

export function refundBalance(subject: Subject, meter: string, amount: number, now: number): Statement {
    return {
        sql: `UPDATE meter_balances SET used = MAX(0, used - ?), updated_at = ? WHERE ${WHERE_BALANCE}`,
        params: [amount, now, ...balanceKey(subject, meter)],
    };
}

export function upsertBalance(id: string, subject: Subject, meter: string, input: GrantInput, now: number): Statement {
    const scope = scopeColumns(subject);
    const resetCredits = input.resetCredits === undefined ? input.credits : input.resetCredits;
    return {
        sql: `INSERT INTO meter_balances (id, app_id, organization_id, user_id, meter, credits, used, period_start, period_end, reset_credits, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
ON CONFLICT(app_id, organization_id, user_id, meter) DO UPDATE SET credits = excluded.credits, used = 0, period_start = excluded.period_start, period_end = excluded.period_end, reset_credits = excluded.reset_credits, updated_at = excluded.updated_at`,
        params: [
            id,
            subject.appId,
            scope.organizationId,
            scope.userId,
            meter,
            input.credits,
            now,
            input.periodEnd ?? null,
            resetCredits,
            now,
            now,
        ],
    };
}

export function topUpBalance(subject: Subject, meter: string, amount: number, now: number): Statement {
    return {
        sql: `UPDATE meter_balances SET credits = credits + ?, updated_at = ? WHERE ${WHERE_BALANCE} AND credits IS NOT NULL`,
        params: [amount, now, ...balanceKey(subject, meter)],
    };
}

export function resetBalance(
    subject: Subject,
    meter: string,
    periodEnd: number | null | undefined,
    now: number,
): Statement {
    // `periodEnd === undefined` keeps the row's own period end; null clears it.
    const keepPeriodEnd = periodEnd === undefined;
    return {
        sql: `UPDATE meter_balances SET used = 0, credits = COALESCE(reset_credits, credits), period_start = ?, period_end = ${keepPeriodEnd ? 'period_end' : '?'}, updated_at = ? WHERE ${WHERE_BALANCE}`,
        params: keepPeriodEnd
            ? [now, now, ...balanceKey(subject, meter)]
            : [now, periodEnd, now, ...balanceKey(subject, meter)],
    };
}

export function insertUsage(
    id: string,
    balanceId: string,
    subject: Subject,
    meter: string,
    amount: number,
    ref: string | null,
    now: number,
): Statement {
    const scope = scopeColumns(subject);
    return {
        sql: 'INSERT INTO meter_usage (id, balance_id, app_id, organization_id, user_id, meter, amount, ref, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        params: [id, balanceId, subject.appId, scope.organizationId, scope.userId, meter, amount, ref, now],
    };
}

export function selectUsage(subject: Subject, meter: string, limit: number): Statement {
    const scope = scopeColumns(subject);
    return {
        sql: 'SELECT id, meter, amount, ref, created_at FROM meter_usage WHERE app_id = ? AND organization_id = ? AND user_id = ? AND meter = ? ORDER BY created_at DESC LIMIT ?',
        params: [subject.appId, scope.organizationId, scope.userId, meter, Math.max(1, Math.min(limit, 500))],
    };
}

export function deleteUsageBefore(appId: string, before: number): Statement {
    return {
        sql: 'DELETE FROM meter_usage WHERE app_id = ? AND created_at < ?',
        params: [appId, before],
    };
}

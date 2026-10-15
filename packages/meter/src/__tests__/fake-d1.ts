// ============================================================
// A D1 stand-in that understands the meter's own statements and nothing else. Just enough
// SQL semantics (the conditional UPDATEs, the upsert, the selects, the prune) that the state
// machine in meter.ts is exercised for real, including the race that matters: a consume
// that no longer fits must change nothing.
// ============================================================
import type { RawDriver, RawResult } from '../types';

type Row = Record<string, unknown>;

export function fakeD1(): RawDriver & { balances: Row[]; usage: Row[]; log: string[] } {
    const balances: Row[] = [];
    const usage: Row[] = [];
    const log: string[] = [];
    const key = (row: Row) => `${row.app_id}|${row.organization_id}|${row.user_id}|${row.meter}`;
    const find = (appId: unknown, org: unknown, user: unknown, meter: unknown) =>
        balances.find((row) => key(row) === `${appId}|${org}|${user}|${meter}`);
    const num = (value: unknown) => (value === null || value === undefined ? null : Number(value));

    return {
        balances,
        usage,
        log,
        async executeRaw(sql, params = []): Promise<RawResult> {
            log.push(sql.split('\n')[0]);
            const p = params;
            if (
                sql.startsWith(
                    'SELECT id, meter, credits, used, period_start, period_end, reset_credits FROM meter_balances WHERE app_id = ? AND organization_id = ? AND user_id = ? AND meter = ?',
                )
            ) {
                const row = find(p[0], p[1], p[2], p[3]);
                return { results: row ? [{ ...row }] : [] };
            }
            if (
                sql.startsWith(
                    'SELECT id, meter, credits, used, period_start, period_end, reset_credits FROM meter_balances WHERE app_id = ? AND organization_id = ? AND user_id = ? ORDER BY meter',
                )
            ) {
                return {
                    results: balances
                        .filter((row) => row.app_id === p[0] && row.organization_id === p[1] && row.user_id === p[2])
                        .sort((a, b) => String(a.meter).localeCompare(String(b.meter)))
                        .map((row) => ({ ...row })),
                };
            }
            if (sql.startsWith('UPDATE meter_balances SET used = used + ?')) {
                const [amount, now, appId, org, user, meter, amount2, now2] = p as number[];
                const row = find(appId, org, user, meter);
                if (!row) return { meta: { changes: 0 } };
                const credits = num(row.credits);
                const periodEnd = num(row.period_end);
                const fits = credits === null || Number(row.used) + amount2 <= credits;
                const open = periodEnd === null || periodEnd > now2;
                if (!fits || !open) return { meta: { changes: 0 } };
                row.used = Number(row.used) + amount;
                row.updated_at = now;
                return { meta: { changes: 1 } };
            }
            if (sql.startsWith('UPDATE meter_balances SET used = MAX(0, used - ?)')) {
                const [amount, now, appId, org, user, meter] = p as number[];
                const row = find(appId, org, user, meter);
                if (!row) return { meta: { changes: 0 } };
                row.used = Math.max(0, Number(row.used) - amount);
                row.updated_at = now;
                return { meta: { changes: 1 } };
            }
            if (sql.startsWith('INSERT INTO meter_balances')) {
                const [
                    id,
                    appId,
                    org,
                    user,
                    meter,
                    credits,
                    periodStart,
                    periodEnd,
                    resetCredits,
                    createdAt,
                    updatedAt,
                ] = p;
                const existing = find(appId, org, user, meter);
                if (existing) {
                    Object.assign(existing, {
                        credits,
                        used: 0,
                        period_start: periodStart,
                        period_end: periodEnd,
                        reset_credits: resetCredits,
                        updated_at: updatedAt,
                    });
                } else {
                    balances.push({
                        id,
                        app_id: appId,
                        organization_id: org,
                        user_id: user,
                        meter,
                        credits,
                        used: 0,
                        period_start: periodStart,
                        period_end: periodEnd,
                        reset_credits: resetCredits,
                        created_at: createdAt,
                        updated_at: updatedAt,
                    });
                }
                return { meta: { changes: 1 } };
            }
            if (sql.startsWith('UPDATE meter_balances SET credits = credits + ?')) {
                const [amount, now, appId, org, user, meter] = p as number[];
                const row = find(appId, org, user, meter);
                if (!row || row.credits === null) return { meta: { changes: 0 } };
                row.credits = Number(row.credits) + amount;
                row.updated_at = now;
                return { meta: { changes: 1 } };
            }
            if (sql.startsWith('UPDATE meter_balances SET used = 0, credits = COALESCE(reset_credits, credits)')) {
                const keepPeriod = sql.includes('period_end = period_end');
                const [now, maybePeriodEnd, ...rest] = keepPeriod ? [p[0], undefined, ...p.slice(1)] : p;
                const [, appId, org, user, meter] = rest as unknown[];
                const row = find(appId, org, user, meter);
                if (!row) return { meta: { changes: 0 } };
                row.used = 0;
                row.credits = row.reset_credits ?? row.credits;
                row.period_start = now;
                if (!keepPeriod) row.period_end = maybePeriodEnd ?? null;
                return { meta: { changes: 1 } };
            }
            if (sql.startsWith('INSERT INTO meter_usage')) {
                const [id, balanceId, appId, org, user, meter, amount, ref, createdAt] = p;
                usage.push({
                    id,
                    balance_id: balanceId,
                    app_id: appId,
                    organization_id: org,
                    user_id: user,
                    meter,
                    amount,
                    ref,
                    created_at: createdAt,
                });
                return { meta: { changes: 1 } };
            }
            if (sql.startsWith('SELECT id, meter, amount, ref, created_at FROM meter_usage')) {
                const [appId, org, user, meter, limit] = p;
                return {
                    results: usage
                        .filter(
                            (row) =>
                                row.app_id === appId &&
                                row.organization_id === org &&
                                row.user_id === user &&
                                row.meter === meter,
                        )
                        .sort((a, b) => Number(b.created_at) - Number(a.created_at))
                        .slice(0, Number(limit))
                        .map((row) => ({ ...row })),
                };
            }
            if (sql.startsWith('DELETE FROM meter_usage')) {
                const [appId, before] = p;
                const keep = usage.filter((row) => !(row.app_id === appId && Number(row.created_at) < Number(before)));
                const changes = usage.length - keep.length;
                usage.splice(0, usage.length, ...keep);
                return { meta: { changes } };
            }
            throw new Error(`fakeD1: unknown statement ${sql}`);
        },
    };
}

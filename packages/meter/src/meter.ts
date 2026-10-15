import { getConnection } from '@ottabase/ottaorm';
import { errorResponse } from '@ottabase/utils/http-errors';
import {
    consumeBalance,
    deleteUsageBefore,
    insertUsage,
    refundBalance,
    resetBalance,
    selectBalance,
    selectBalances,
    selectUsage,
    topUpBalance,
    upsertBalance,
} from './sql';
import type { Balance, Meter, MeterOptions, RawDriver, Subject, UsageEntry } from './types';

function toNumber(value: unknown): number {
    return typeof value === 'number' ? value : Number(value ?? 0);
}

function toNullableNumber(value: unknown): number | null {
    return value === null || value === undefined ? null : toNumber(value);
}

export function rowToBalance(row: Record<string, unknown>): Balance {
    const credits = toNullableNumber(row.credits);
    const used = toNumber(row.used);
    return {
        id: String(row.id),
        meter: String(row.meter),
        credits,
        used,
        remaining: credits === null ? null : Math.max(0, credits - used),
        periodStart: toNumber(row.period_start),
        periodEnd: toNullableNumber(row.period_end),
        resetCredits: toNullableNumber(row.reset_credits),
    };
}

function assertAmount(amount: number): void {
    if (!Number.isSafeInteger(amount) || amount <= 0) {
        throw new Error(`[meter] amount must be a positive integer (got ${String(amount)})`);
    }
}

function assertMeter(meter: string): void {
    if (!/^[a-z][a-z0-9._:-]{0,63}$/i.test(meter)) {
        throw new Error(`[meter] invalid meter name "${meter}"`);
    }
}

/**
 * The app's meter. One per app, in its package composition:
 *
 * ```typescript
 * export const meter = createMeter<CloudflareEnv>({ driver: (env) => createD1Driver(env.OBCF_D1), upgradeHref: '/billing' });
 * ```
 */
export function createMeter<Env = unknown>(options: MeterOptions<Env> = {}): Meter<Env> {
    const now = options.now ?? Date.now;
    const id = options.id ?? (() => crypto.randomUUID());
    const driverFor = options.driver ?? (() => getConnection('default') as RawDriver);

    async function read(driver: RawDriver, subject: Subject, meter: string): Promise<Balance | null> {
        const { sql, params } = selectBalance(subject, meter);
        const row = (await driver.executeRaw(sql, params)).results?.[0];
        return row ? rowToBalance(row) : null;
    }

    async function changed(driver: RawDriver, statement: { sql: string; params: unknown[] }): Promise<boolean> {
        const result = await driver.executeRaw(statement.sql, statement.params);
        return (result.meta?.changes ?? 0) > 0;
    }

    async function ledger(
        driver: RawDriver,
        balance: Balance,
        subject: Subject,
        meter: string,
        amount: number,
        ref: string | null,
    ): Promise<void> {
        // Best effort: the balance already moved; a ledger hiccup must not fail the request.
        try {
            const { sql, params } = insertUsage(id(), balance.id, subject, meter, amount, ref, now());
            await driver.executeRaw(sql, params);
        } catch (error) {
            console.warn(
                JSON.stringify({
                    event: 'meter_usage_write_failed',
                    meter,
                    error: error instanceof Error ? error.name : 'unknown',
                }),
            );
        }
    }

    const api: Meter<Env> = {
        async consume(env, subject, meter, amount, consumeOptions = {}) {
            assertMeter(meter);
            assertAmount(amount);
            const driver = driverFor(env);
            const at = now();
            if (await changed(driver, consumeBalance(subject, meter, amount, at))) {
                const balance = (await read(driver, subject, meter))!;
                await ledger(driver, balance, subject, meter, amount, consumeOptions.ref ?? null);
                return { ok: true, remaining: balance.remaining, balance };
            }
            const balance = await read(driver, subject, meter);
            if (!balance) return { ok: false, reason: 'NO_BALANCE', remaining: null, balance: null };
            if (balance.periodEnd !== null && balance.periodEnd <= at) {
                return { ok: false, reason: 'PERIOD_ENDED', remaining: balance.remaining, balance };
            }
            return { ok: false, reason: 'INSUFFICIENT', remaining: balance.remaining, balance };
        },

        async refund(env, subject, meter, amount, refundOptions = {}) {
            assertMeter(meter);
            assertAmount(amount);
            const driver = driverFor(env);
            if (!(await changed(driver, refundBalance(subject, meter, amount, now())))) return null;
            const balance = (await read(driver, subject, meter))!;
            await ledger(driver, balance, subject, meter, -amount, refundOptions.ref ?? null);
            return balance;
        },

        balance(env, subject, meter) {
            assertMeter(meter);
            return read(driverFor(env), subject, meter);
        },

        async balances(env, subject) {
            const { sql, params } = selectBalances(subject);
            return ((await driverFor(env).executeRaw(sql, params)).results ?? []).map(rowToBalance);
        },

        async grant(env, subject, meter, input) {
            assertMeter(meter);
            if (input.credits !== null && (!Number.isSafeInteger(input.credits) || input.credits < 0)) {
                throw new Error('[meter] credits must be null (unlimited) or a non-negative integer');
            }
            const driver = driverFor(env);
            const { sql, params } = upsertBalance(id(), subject, meter, input, now());
            await driver.executeRaw(sql, params);
            return (await read(driver, subject, meter))!;
        },

        async topUp(env, subject, meter, amount) {
            assertMeter(meter);
            assertAmount(amount);
            const driver = driverFor(env);
            if (!(await changed(driver, topUpBalance(subject, meter, amount, now())))) return null;
            return read(driver, subject, meter);
        },

        async reset(env, subject, meter, resetOptions = {}) {
            assertMeter(meter);
            const driver = driverFor(env);
            if (!(await changed(driver, resetBalance(subject, meter, resetOptions.periodEnd, now())))) return null;
            return read(driver, subject, meter);
        },

        async usage(env, subject, meter, limit = 50) {
            assertMeter(meter);
            const { sql, params } = selectUsage(subject, meter, limit);
            return ((await driverFor(env).executeRaw(sql, params)).results ?? []).map(
                (row): UsageEntry => ({
                    id: String(row.id),
                    meter: String(row.meter),
                    amount: toNumber(row.amount),
                    ref: (row.ref as string | null) ?? null,
                    at: toNumber(row.created_at),
                }),
            );
        },

        async pruneUsage(env, appId, olderThanDays) {
            if (!Number.isFinite(olderThanDays) || olderThanDays <= 0) {
                throw new Error('[meter] olderThanDays must be a positive number');
            }
            const { sql, params } = deleteUsageBefore(appId, now() - olderThanDays * 86_400_000);
            return (await driverFor(env).executeRaw(sql, params)).meta?.changes ?? 0;
        },

        async requireCredits(env, subject, meter, amount = 1) {
            assertMeter(meter);
            assertAmount(amount);
            const balance = await read(driverFor(env), subject, meter);
            const at = now();
            if (!balance)
                return api.deniedResponse(meter, { ok: false, reason: 'NO_BALANCE', remaining: null, balance: null });
            if (balance.periodEnd !== null && balance.periodEnd <= at) {
                return api.deniedResponse(meter, {
                    ok: false,
                    reason: 'PERIOD_ENDED',
                    remaining: balance.remaining,
                    balance,
                });
            }
            if (balance.remaining !== null && balance.remaining < amount) {
                return api.deniedResponse(meter, {
                    ok: false,
                    reason: 'INSUFFICIENT',
                    remaining: balance.remaining,
                    balance,
                });
            }
            return null;
        },

        deniedResponse(meter, result) {
            const messages = {
                NO_BALANCE: 'No credits are allocated for this feature',
                INSUFFICIENT: 'You have used all the credits in your plan',
                PERIOD_ENDED: 'Your credit period has ended',
            } as const;
            return errorResponse(messages[result.reason], 402, {
                code: 'CREDITS_EXHAUSTED',
                hint: options.upgradeHref ? `Add credits or upgrade: ${options.upgradeHref}` : undefined,
                headers: result.remaining !== null ? { 'X-Remaining-Credits': String(result.remaining) } : undefined,
                metadata: {
                    meter,
                    reason: result.reason,
                    remaining: result.remaining,
                    ...(result.balance?.periodEnd ? { periodEnd: result.balance.periodEnd } : {}),
                    ...(options.upgradeHref ? { upgradeHref: options.upgradeHref } : {}),
                },
            });
        },
    };
    return api;
}

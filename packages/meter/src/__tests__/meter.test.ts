import { describe, expect, it } from 'vitest';
import { createMeter, meterSql, type Subject } from '../index';
import { fakeD1 } from './fake-d1';

type Env = { d1: ReturnType<typeof fakeD1> };
const org: Subject = { appId: 'app', organizationId: 'org-1', userId: null };
const me: Subject = { appId: 'app', organizationId: null, userId: 'u-1' };

function setup(now = 1_700_000_000_000) {
    const d1 = fakeD1();
    let clock = now;
    let seq = 0;
    const meter = createMeter<Env>({
        driver: (env) => env.d1,
        now: () => clock,
        id: () => `id-${++seq}`,
        upgradeHref: '/billing',
    });
    return { d1, meter, env: { d1 }, tick: (ms: number) => (clock += ms) };
}

describe('statements', () => {
    it('personal and org-wide scopes become empty strings, never NULL, so the unique index holds', () => {
        expect(meterSql.scopeColumns(org)).toEqual({ organizationId: 'org-1', userId: '' });
        expect(meterSql.scopeColumns(me)).toEqual({ organizationId: '', userId: 'u-1' });
    });

    it('consume moves the counter only while it fits and the period is open', () => {
        const { sql, params } = meterSql.consumeBalance(org, 'ai.tokens', 5, 123);
        expect(sql).toContain('(credits IS NULL OR used + ? <= credits)');
        expect(sql).toContain('(period_end IS NULL OR period_end > ?)');
        expect(params).toEqual([5, 123, 'app', 'org-1', '', 'ai.tokens', 5, 123]);
    });

    it('reset keeps the period end unless one is given', () => {
        expect(meterSql.resetBalance(org, 'm', undefined, 9).sql).toContain('period_end = period_end');
        expect(meterSql.resetBalance(org, 'm', null, 9).params).toEqual([9, null, 9, 'app', 'org-1', '', 'm']);
    });
});

describe('createMeter', () => {
    it('grants, consumes atomically, refuses past the ceiling, and records the ledger', async () => {
        const { meter, env, d1, tick } = setup();
        const granted = await meter.grant(env, org, 'ai.calls', { credits: 3 });
        expect(granted).toMatchObject({ credits: 3, used: 0, remaining: 3, periodEnd: null, resetCredits: 3 });

        expect(await meter.consume(env, org, 'ai.calls', 2, { ref: 'req-1' })).toMatchObject({
            ok: true,
            remaining: 1,
        });
        tick(1);
        const refused = await meter.consume(env, org, 'ai.calls', 2);
        expect(refused).toMatchObject({ ok: false, reason: 'INSUFFICIENT', remaining: 1 });
        expect(await meter.consume(env, org, 'ai.calls', 1)).toMatchObject({ ok: true, remaining: 0 });

        expect(d1.usage.map((row) => row.amount)).toEqual([2, 1]);
        expect(d1.usage[0].ref).toBe('req-1');
        expect((await meter.usage(env, org, 'ai.calls')).map((entry) => entry.amount)).toEqual([1, 2]);
    });

    it('a missing balance is NO_BALANCE, an unlimited one never refuses', async () => {
        const { meter, env } = setup();
        expect(await meter.consume(env, org, 'ai.calls', 1)).toMatchObject({
            ok: false,
            reason: 'NO_BALANCE',
            remaining: null,
        });
        await meter.grant(env, org, 'ai.calls', { credits: null });
        expect(await meter.consume(env, org, 'ai.calls', 1_000_000)).toMatchObject({ ok: true, remaining: null });
        expect(await meter.topUp(env, org, 'ai.calls', 5)).toBeNull();
    });

    it('a closed period refuses with PERIOD_ENDED; reset opens a new one at the reset credits', async () => {
        const { meter, env, tick } = setup();
        await meter.grant(env, org, 'ai.calls', {
            credits: 10,
            periodEnd: 1_700_000_000_000 + 1_000,
            resetCredits: 20,
        });
        await meter.consume(env, org, 'ai.calls', 4);
        tick(5_000);
        expect(await meter.consume(env, org, 'ai.calls', 1)).toMatchObject({
            ok: false,
            reason: 'PERIOD_ENDED',
            remaining: 6,
        });

        const reset = await meter.reset(env, org, 'ai.calls', { periodEnd: 1_700_000_000_000 + 100_000 });
        expect(reset).toMatchObject({ credits: 20, used: 0, remaining: 20, periodEnd: 1_700_000_000_000 + 100_000 });
        expect(await meter.consume(env, org, 'ai.calls', 1)).toMatchObject({ ok: true, remaining: 19 });
    });

    it('refund never goes below zero and shows as a negative ledger entry; top-up raises the ceiling', async () => {
        const { meter, env, tick } = setup();
        await meter.grant(env, me, 'exports', { credits: 2 });
        await meter.consume(env, me, 'exports', 1);
        tick(1);
        expect(await meter.refund(env, me, 'exports', 5, { ref: 'oops' })).toMatchObject({ used: 0, remaining: 2 });
        expect((await meter.usage(env, me, 'exports')).map((entry) => entry.amount)).toEqual([-5, 1]);
        expect(await meter.topUp(env, me, 'exports', 3)).toMatchObject({ credits: 5, remaining: 5 });
    });

    it('a grant is an upsert that resets usage; personal and org balances are separate rows', async () => {
        const { meter, env, d1 } = setup();
        await meter.grant(env, org, 'ai.calls', { credits: 5 });
        await meter.consume(env, org, 'ai.calls', 5);
        await meter.grant(env, org, 'ai.calls', { credits: 7 });
        expect(await meter.balance(env, org, 'ai.calls')).toMatchObject({ credits: 7, used: 0 });
        await meter.grant(env, me, 'ai.calls', { credits: 1 });
        expect(d1.balances).toHaveLength(2);
        expect((await meter.balances(env, org)).map((balance) => balance.meter)).toEqual(['ai.calls']);
    });

    it('requireCredits is a 402 with the remaining count in the body and a header; pruneUsage trims the ledger', async () => {
        const { meter, env, tick } = setup();
        expect((await meter.requireCredits(env, org, 'ai.calls'))?.status).toBe(402);
        await meter.grant(env, org, 'ai.calls', { credits: 1 });
        expect(await meter.requireCredits(env, org, 'ai.calls')).toBeNull();
        await meter.consume(env, org, 'ai.calls', 1);
        const denied = (await meter.requireCredits(env, org, 'ai.calls'))!;
        expect(denied.status).toBe(402);
        expect(denied.headers.get('X-Remaining-Credits')).toBe('0');
        const body = (await denied.json()) as { code: string; metadata: Record<string, unknown> };
        expect(body.code).toBe('CREDITS_EXHAUSTED');
        expect(body.metadata).toMatchObject({
            meter: 'ai.calls',
            reason: 'INSUFFICIENT',
            remaining: 0,
            upgradeHref: '/billing',
        });

        tick(100 * 86_400_000);
        expect(await meter.pruneUsage(env, 'app', 90)).toBe(1);
        expect(await meter.usage(env, org, 'ai.calls')).toEqual([]);
    });

    it('rejects nonsense amounts and meter names before touching the database', async () => {
        const { meter, env, d1 } = setup();
        await expect(meter.consume(env, org, 'ai.calls', 0)).rejects.toThrow(/positive integer/);
        await expect(meter.consume(env, org, 'ai.calls', 1.5)).rejects.toThrow(/positive integer/);
        await expect(meter.consume(env, org, 'bad name!', 1)).rejects.toThrow(/invalid meter name/);
        expect(d1.log).toEqual([]);
    });
});

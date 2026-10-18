import { describe, expect, it } from 'vitest';
import { allQuotas, createCreditMetering, fanOutEvents } from '../resolver/credits';
import type { CallCompletedEvent } from '../resolver/events';

const completed = (over: Partial<CallCompletedEvent>): CallCompletedEvent => ({
    appId: 'app',
    organizationId: null,
    userId: 'u1',
    correlationId: 'c1',
    credentialId: null,
    source: 'platform',
    provider: 'openai',
    model: 'gpt-4o-mini',
    taskKey: 'assist',
    operation: 'chat',
    inputTokens: 100,
    outputTokens: 50,
    cachedTokens: null,
    latencyMs: 10,
    outcome: 'success',
    ...over,
});

function harness(room = true) {
    const consumed: Array<{ userId: string | null; amount: number; ref: string }> = [];
    const checks: number[] = [];
    const deferred: Promise<unknown>[] = [];
    const metering = createCreditMetering({
        ledger: {
            hasCredits: (_subject, estimate) => (checks.push(estimate), room),
            consume: async (subject, amount, ref) => void consumed.push({ userId: subject.userId, amount, ref }),
        },
        estimate: 3,
        defer: (p) => void deferred.push(p),
    });
    return { metering, consumed, checks, deferred };
}

describe('credit metering — BYOK is free, platform debits actuals', () => {
    it('never consults the ledger for a BYOK call', async () => {
        const { metering, checks } = harness(false);
        expect(await metering.quota({ source: 'byok', taskKey: 't', organizationId: null, userId: 'u1' })).toBe(true);
        expect(checks).toEqual([]);
    });

    it('refuses a platform call when the ledger has no room, using the estimate', async () => {
        const { metering, checks } = harness(false);
        expect(await metering.quota({ source: 'platform', taskKey: 't', organizationId: null, userId: 'u1' })).toBe(
            false,
        );
        expect(checks).toEqual([3]);
    });

    it('debits input + output tokens on a successful platform call, through defer', async () => {
        const { metering, consumed, deferred } = harness();
        metering.eventSink('call.completed', completed({}));
        await Promise.all(deferred);
        expect(consumed).toEqual([{ userId: 'u1', amount: 150, ref: 'c1' }]);
    });

    it('falls back to the estimate when the provider reports no tokens', async () => {
        const { metering, consumed, deferred } = harness();
        metering.eventSink('call.completed', completed({ inputTokens: null, outputTokens: null }));
        await Promise.all(deferred);
        expect(consumed[0]?.amount).toBe(3);
    });

    it('debits nothing for BYOK, failed calls, or other events', async () => {
        const { metering, consumed, deferred } = harness();
        metering.eventSink('call.completed', completed({ source: 'byok' }));
        metering.eventSink('call.completed', completed({ outcome: 'error', errorCode: 'UPSTREAM' }));
        metering.eventSink('quota.exceeded', { taskKey: 't', source: 'platform' } as never);
        await Promise.all(deferred);
        expect(consumed).toEqual([]);
    });
});

describe('combinators', () => {
    it('allQuotas stops at the first refusal', async () => {
        const seen: string[] = [];
        const q = allQuotas(
            () => (seen.push('a'), true),
            () => (seen.push('b'), false),
            () => (seen.push('c'), true),
        );
        expect(await q({ source: 'platform', taskKey: 't', organizationId: null, userId: null })).toBe(false);
        expect(seen).toEqual(['a', 'b']);
    });

    it('fanOutEvents delivers to every sink', () => {
        const got: string[] = [];
        fanOutEvents(
            (e) => void got.push(`1:${e}`),
            (e) => void got.push(`2:${e}`),
        )('call.degraded', {} as never);
        expect(got).toEqual(['1:call.degraded', '2:call.degraded']);
    });
});

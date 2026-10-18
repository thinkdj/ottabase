// ============================================================
// @ottabase/ottaai/resolver — credit metering for PLATFORM-paid calls
// ============================================================
// Resolution already answers "whose money is this?" (`source`). This turns that answer
// into the commercial rule every BYOK product wants: a tenant's own key is never
// metered; the operator's platform key debits the tenant's credit balance.
//
// Structural `CreditLedger`, not an import of @ottabase/meter: this package is
// dependency-free by contract, and `meter.consume`/`meter.requireCredits` fit the shape
// with a two-line adapter in the host (see otta-web `worker/lib/ai.ts`).
//
// Pre-call: `hasCredits(subject, estimate)` gates the call. Post-call: `call.completed`
// debits the ACTUAL tokens. No two-phase reservation — see `QuotaCheck` for why the
// package tolerates an overrun of roughly the in-flight concurrency.
// ============================================================

type Awaitable<T> = T | Promise<T>;
import type { EventSink } from './events';
import type { QuotaCheck } from './instrumented-client';

/** Whose balance. Mirrors @ottabase/meter's `Subject`. */
export interface CreditSubject {
    appId: string | null;
    organizationId: string | null;
    userId: string | null;
}

export interface CreditLedger {
    /** Is there room for roughly `estimate` credits? Called before every platform call. */
    hasCredits(subject: CreditSubject, estimate: number): Awaitable<boolean>;
    /** Take `amount` credits for a finished call. `ref` is the call's correlation id. */
    consume(subject: CreditSubject, amount: number, ref: string): Promise<unknown>;
}

export interface CreditMeteringOptions {
    ledger: CreditLedger;
    /** Credits per call when the provider reports no token counts, and the pre-call estimate. Default 1. */
    estimate?: number;
    /** Credits per token. Default 1 (one credit = one token). */
    creditsPerToken?: number;
    /** `ctx.waitUntil`, or the debit is cancelled at response. */
    defer: (promise: Promise<unknown>) => void;
}

export interface CreditMetering {
    quota: QuotaCheck;
    eventSink: EventSink;
}

/**
 * Build the `quota` hook and the `eventSink` that together meter platform-paid inference.
 * Compose with other hooks via `allQuotas` / `fanOutEvents`.
 */
export function createCreditMetering(options: CreditMeteringOptions): CreditMetering {
    const { ledger, estimate = 1, creditsPerToken = 1, defer } = options;
    return {
        // A ledger that cannot answer refuses the platform call: fail closed, it is the operator's money.
        quota: async ({ source, organizationId, userId }) => {
            if (source !== 'platform') return true;
            try {
                return await ledger.hasCredits({ appId: null, organizationId, userId }, estimate);
            } catch {
                return false;
            }
        },
        eventSink: (event, payload) => {
            if (event !== 'call.completed') return;
            const call = payload as import('./events').CallCompletedEvent;
            // BYOK is the tenant's own bill. A failed platform call billed nothing upstream.
            if (call.source !== 'platform' || call.outcome !== 'success') return;
            const tokens = (call.inputTokens ?? 0) + (call.outputTokens ?? 0);
            const amount = tokens > 0 ? Math.ceil(tokens * creditsPerToken) : estimate;
            const subject = { appId: call.appId, organizationId: call.organizationId, userId: call.userId };
            defer(ledger.consume(subject, amount, call.correlationId).catch(() => {}));
        },
    };
}

/** Every check must pass. Checks run in order and stop at the first refusal. */
export function allQuotas(...checks: QuotaCheck[]): QuotaCheck {
    return async (input) => {
        for (const check of checks) if (!(await check(input))) return false;
        return true;
    };
}

/** Deliver every event to every sink. One sink that throws never costs the others their event. */
export function fanOutEvents(...sinks: EventSink[]): EventSink {
    return (event, payload) => {
        for (const sink of sinks) {
            try {
                sink(event, payload);
            } catch (error) {
                console.error(
                    '[ottaai] event sink failed',
                    event,
                    error instanceof Error ? error.message : String(error),
                );
            }
        }
    };
}

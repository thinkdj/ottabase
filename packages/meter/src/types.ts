// ============================================================
// @ottabase/meter — usage credits
// ============================================================
// A balance per (tenant, meter): how many credits, how many used, until when. One
// conditional UPDATE consumes; it either moves the counter or it does not, and D1 says
// which. No read-then-write, so two requests racing for the last credit cannot both win.
// ============================================================

export type Awaitable<T> = T | Promise<T>;

/** Whose balance. `organizationId: null` is a personal balance; `userId: null` an org-wide one. */
export interface Subject {
    appId: string;
    organizationId: string | null;
    userId: string | null;
}

/** The slice of a database driver the meter needs: D1's `prepare().bind().all()` result shape. */
export interface RawDriver {
    executeRaw(sql: string, params?: unknown[]): Promise<RawResult>;
}

export interface RawResult {
    results?: Array<Record<string, unknown>>;
    meta?: { changes?: number };
}

export interface Balance {
    id: string;
    meter: string;
    /** null = unlimited. */
    credits: number | null;
    used: number;
    /** null when unlimited. */
    remaining: number | null;
    periodStart: number;
    /** Epoch ms; null = no period. */
    periodEnd: number | null;
    /** What `reset()` restores `credits` to; null keeps the current allowance. */
    resetCredits: number | null;
}

export type ConsumeFailure = 'NO_BALANCE' | 'INSUFFICIENT' | 'PERIOD_ENDED';

export type ConsumeResult =
    | { ok: true; remaining: number | null; balance: Balance }
    | { ok: false; reason: ConsumeFailure; remaining: number | null; balance: Balance | null };

export interface GrantInput {
    /** null = unlimited. */
    credits: number | null;
    /** Epoch ms; omit for no period. */
    periodEnd?: number | null;
    /** What a reset restores `credits` to. Defaults to `credits`. */
    resetCredits?: number | null;
}

export interface UsageEntry {
    id: string;
    meter: string;
    /** Negative for a refund. */
    amount: number;
    ref: string | null;
    at: number;
}

export interface MeterOptions<Env = unknown> {
    /** Where to run statements. Defaults to OttaORM's `default` connection. */
    driver?: (env: Env) => RawDriver;
    /** Where the 402 sends people. */
    upgradeHref?: string;
    now?: () => number;
    id?: () => string;
}

export interface Meter<Env = unknown> {
    /** Take `amount` credits, atomically. The usage ledger records it when it succeeds. */
    consume(
        env: Env,
        subject: Subject,
        meter: string,
        amount: number,
        options?: { ref?: string },
    ): Promise<ConsumeResult>;
    /** Give `amount` back (a failed call, a cancelled job). Never below zero used. */
    refund(
        env: Env,
        subject: Subject,
        meter: string,
        amount: number,
        options?: { ref?: string },
    ): Promise<Balance | null>;
    balance(env: Env, subject: Subject, meter: string): Promise<Balance | null>;
    /** Every balance the subject holds. */
    balances(env: Env, subject: Subject): Promise<Balance[]>;
    /** Set the allowance (a plan grant, a comp). Resets `used` to zero. Upserts. */
    grant(env: Env, subject: Subject, meter: string, input: GrantInput): Promise<Balance>;
    /** Add credits to a limited balance. Returns null when there is no balance or it is unlimited. */
    topUp(env: Env, subject: Subject, meter: string, amount: number): Promise<Balance | null>;
    /** Start a new period: `used` to zero, `credits` to `resetCredits` (or kept), the period moved. */
    reset(env: Env, subject: Subject, meter: string, options?: { periodEnd?: number | null }): Promise<Balance | null>;
    /** The subject's recent ledger, newest first. */
    usage(env: Env, subject: Subject, meter: string, limit?: number): Promise<UsageEntry[]>;
    /** Delete ledger rows older than the window. Returns how many went. */
    pruneUsage(env: Env, appId: string, olderThanDays: number): Promise<number>;
    /** Resolves null when there is room, or the 402 to return. Does NOT consume; call `consume` after the work. */
    requireCredits(env: Env, subject: Subject, meter: string, amount?: number): Promise<Response | null>;
    /** A closed gate as a response, for callers that consumed first and were refused. */
    deniedResponse(meter: string, result: Extract<ConsumeResult, { ok: false }>): Response;
}

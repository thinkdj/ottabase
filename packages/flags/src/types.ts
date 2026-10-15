// ============================================================
// @ottabase/flags — entitlements
// ============================================================
// "What may this caller do, and how much of it?" answered from two inputs: the PLAN the
// caller is on (resolved by the host: a payport license, a column on the organization,
// a static default) and OVERRIDES an operator recorded in D1 (a comp, a kill, a raised
// ceiling for one customer). One resolver, one answer shape, one 402.
// ============================================================

export type Awaitable<T> = T | Promise<T>;

/** Whose entitlements. `organizationId: null` is a personal scope; `userId: null` an org-wide check. */
export interface Subject {
    appId: string;
    organizationId: string | null;
    userId: string | null;
}

/** A plan: what it unlocks and how much. */
export interface PlanDefinition {
    label?: string;
    /** Feature ids this plan includes. */
    features?: readonly string[];
    /** Numeric ceilings. `UNLIMITED` (-1) lifts one; an undeclared key is unlimited too. */
    limits?: Record<string, number>;
    /**
     * Where this plan sits. A subject that resolves to several plans (a user plan AND an org plan)
     * gets the highest-ranked one. Defaults to declaration order, first = lowest.
     */
    rank?: number;
}

export const UNLIMITED = -1;

export type OverrideScope = 'app' | 'organization' | 'user';

/** An operator override, as stored. `key` is `plan`, `feature:<id>` or `limit:<id>`. */
export interface Override {
    id: string;
    scope: OverrideScope;
    key: string;
    /** JSON: a plan key (string), a feature switch (boolean) or a limit (number). */
    value: string | boolean | number;
    reason?: string | null;
    /** Epoch ms; null means no expiry. */
    expiresAt?: number | null;
}

/** Where overrides live. The default reads the `flag_overrides` table through its model. */
export interface OverrideStore<Env = unknown> {
    /** Every unexpired override that applies to the subject: app-wide, its organization's, its own. */
    list(env: Env, subject: Subject): Promise<Override[]>;
}

export interface Entitlements {
    plan: string;
    label: string;
    features: string[];
    limits: Record<string, number>;
    /** Which overrides changed the answer, for the admin page and for debugging a support ticket. */
    applied: Array<Pick<Override, 'id' | 'scope' | 'key'>>;
}

export type GateReason = 'OK' | 'FEATURE_NOT_IN_PLAN' | 'LIMIT_REACHED' | 'NO_SUBJECT';

export interface GateAnswer {
    allowed: boolean;
    /** True when an upgrade prompt is the right UI response. */
    upsell: boolean;
    reason: GateReason;
    plan: string | null;
    /** Present for a limit check: the ceiling that applied. */
    limit?: number;
    upgradeHref?: string;
}

export interface FlagsOptions<Env = unknown> {
    plans: Record<string, PlanDefinition>;
    /** The plan a subject is on when `resolvePlan` returns nothing. Must be a key of `plans`. */
    defaultPlan: string;
    /**
     * Which plan(s) the subject holds. The host knows: a payport license, a column, a header from an
     * upstream gateway. Several keys are allowed (a user plan and an org plan); the highest rank wins.
     * An unknown key is ignored, with the default as the floor.
     */
    resolvePlan?: (env: Env, subject: Subject) => Awaitable<string | string[] | null | undefined>;
    /** Override source. Omit to read the `flag_overrides` table (the package's model). */
    overrides?: OverrideStore<Env>;
    /** Where the 402 sends people. */
    upgradeHref?: string;
    /** In-isolate cache for resolved entitlements, per subject. Default 30s; 0 disables. */
    cacheTtlMs?: number;
    now?: () => number;
}

export interface Flags<Env = unknown> {
    resolve(env: Env, subject: Subject): Promise<Entitlements>;
    feature(env: Env, subject: Subject, feature: string): Promise<GateAnswer>;
    limit(env: Env, subject: Subject, limitKey: string, current: number): Promise<GateAnswer>;
    /** Resolves null when allowed, or the 402 to return. */
    requireFeature(env: Env, subject: Subject, feature: string): Promise<Response | null>;
    /** `current` is the caller's own count, measured server-side. */
    requireLimit(env: Env, subject: Subject, limitKey: string, current: number): Promise<Response | null>;
    /** Forget cached entitlements, for one subject or all. Call after writing an override. */
    invalidate(subject?: Subject): void;
    readonly plans: Record<string, PlanDefinition>;
}

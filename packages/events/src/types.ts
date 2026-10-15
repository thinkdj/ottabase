// ============================================================
// @ottabase/events — the event contract
// ============================================================
// A package announces that something happened ("payport.license.activated",
// "ottablog.post.published"); other packages subscribe without the emitter
// knowing who listens. One bus per app, created in the app's wiring; packages
// contribute subscriptions through their manifest (`@ottabase/kernel`).
// ============================================================

export type Awaitable<T> = T | Promise<T>;

/**
 * Event name → payload type. Declare one per package (a type alias or an interface both work)
 * and intersect them in the app. This is only the default for an untyped bus.
 */
export type EventMap = Record<string, unknown>;

/** Who caused the event. Copied from the verified session, never from request headers. */
export interface EventActor {
    userId?: string | null;
    organizationId?: string | null;
    appId?: string | null;
}

/** The envelope every subscriber receives. Serialisable: it is what travels through the queue. */
export interface OttaEvent<T = unknown> {
    /** Unique per emission. The same id reaches every subscriber, inline or queued. */
    id: string;
    name: string;
    payload: T;
    /** Epoch milliseconds at emission. */
    at: number;
    actor?: EventActor;
}

/** How a subscriber is reached. */
export type Delivery =
    /** Runs inside the emitting request, before `emit()` resolves. The default. */
    | 'inline'
    /**
     * Runs in the queue consumer, from one job per event. For slow or failure-prone work
     * (sending mail, calling a third party). Needs `EventBusOptions.queue`; without a queue
     * the subscriber runs inline instead, so a missing binding never loses an event.
     */
    | 'queue';

export interface EventContext<Env = unknown> {
    env: Env;
    /**
     * Hand slow work to the runtime. When `emit()` was given the request's `waitUntil`, the
     * promise outlives the response; otherwise it is awaited before `emit()` resolves, so
     * nothing is dropped either way.
     */
    defer: (work: Promise<unknown>) => void;
    /** Where this delivery runs. A handler may branch on it (e.g. no retries when inline). */
    via: Delivery;
}

export type EventHandler<Env = unknown, T = unknown> = (event: OttaEvent<T>, ctx: EventContext<Env>) => Awaitable<void>;

/** One subscription, as a package manifest declares it. */
export interface Subscription<Env = unknown, T = unknown> {
    /** Exact event name, or `'*'` for every event. */
    event: string;
    handler: EventHandler<Env, T>;
    /** Default `'inline'`. */
    via?: Delivery;
    /** Shown in error logs and `subscribers()`. Defaults to the handler's function name. */
    name?: string;
}

export interface SubscriberInfo {
    event: string;
    name: string;
    via: Delivery;
}

export interface EmitOptions {
    actor?: EventActor;
    /** The request's `ctx.waitUntil`, when there is one. */
    defer?: (work: Promise<unknown>) => void;
    /** Supply the envelope id (tests, replays). Defaults to `crypto.randomUUID()`. */
    id?: string;
}

export interface EmitResult {
    id: string;
    /** Subscribers that ran in this call (inline ones, plus queued ones that fell back to inline). */
    delivered: number;
    /** True when a queue job was dispatched for the `'queue'` subscribers. */
    queued: boolean;
    /** Subscribers that threw in this call. Each was reported to `onError`; none stopped the others. */
    failed: number;
}

export interface DeliveryResult {
    delivered: number;
    failed: number;
}

export interface SubscriberFailure {
    event: string;
    subscriber: string;
    via: Delivery;
}

export interface EventBusOptions<Env = unknown> {
    /**
     * Where `'queue'` subscribers are dispatched. Returning `null` or `undefined` (no binding in
     * this environment) makes them run inline.
     */
    queue?: (env: Env) => QueueLike | null | undefined;
    /**
     * Called once per subscriber that threw. Default: one structured, redacted line on
     * `console.error`. Subscriber errors never propagate out of `emit()`.
     */
    onError?: (error: unknown, failure: SubscriberFailure) => void;
    /** Clock, for tests. */
    now?: () => number;
}

/** The slice of a Cloudflare `Queue` the bus needs. `@ottabase/queue` builds the job body. */
export interface QueueLike {
    send(body: unknown, options?: unknown): Promise<unknown>;
}

import { dispatch, type JobHandler, type QueueConfig } from '@ottabase/queue';
import { redactErrorForLog } from '@ottabase/utils/http-errors';
import type {
    Delivery,
    DeliveryResult,
    EmitOptions,
    EmitResult,
    EventBusOptions,
    EventHandler,
    EventMap,
    OttaEvent,
    SubscriberFailure,
    SubscriberInfo,
    Subscription,
} from './types';

/** Job type the bus dispatches for `'queue'` subscribers. Register `bus.jobHandler()` under it. */
export const EVENT_JOB_TYPE = 'events:deliver';

const EVENT_NAME_RE = /^[a-z][a-z0-9]*(?:[.:_-][a-z0-9]+)*$/i;

function defaultOnError(error: unknown, failure: SubscriberFailure): void {
    console.error(
        JSON.stringify({
            event: 'event_subscriber_failed',
            name: failure.event,
            subscriber: failure.subscriber,
            via: failure.via,
            error: redactErrorForLog(error),
        }),
    );
}

interface Registered<Env> extends Required<Omit<Subscription<Env>, 'handler'>> {
    handler: EventHandler<Env, unknown>;
}

/**
 * One bus per app. Subscriptions are registered at boot (from package manifests and app
 * code); `emit()` runs inline subscribers now and dispatches one queue job for the rest.
 */
export class EventBus<Env = unknown, M extends object = EventMap> {
    private readonly subs: Array<Registered<Env>> = [];
    private readonly onError: (error: unknown, failure: SubscriberFailure) => void;
    private readonly now: () => number;

    constructor(private readonly options: EventBusOptions<Env> = {}) {
        this.onError = options.onError ?? defaultOnError;
        this.now = options.now ?? Date.now;
    }

    /** Subscribe to one event (or `'*'`). Returns the unsubscribe function. */
    on<K extends keyof M & string>(
        event: K | '*',
        handler: EventHandler<Env, M[K]>,
        opts: { via?: Delivery; name?: string } = {},
    ): () => void {
        if (event !== '*' && !EVENT_NAME_RE.test(event)) {
            throw new Error(
                `[events] Invalid event name "${event}". Use dotted lowercase segments, e.g. "payport.license.activated".`,
            );
        }
        const registered: Registered<Env> = {
            event,
            handler: handler as EventHandler<Env, unknown>,
            via: opts.via ?? 'inline',
            name: opts.name ?? (handler.name || 'anonymous'),
        };
        this.subs.push(registered);
        return () => {
            const index = this.subs.indexOf(registered);
            if (index >= 0) this.subs.splice(index, 1);
        };
    }

    /** Register many at once, as a package manifest hands them over. */
    subscribe(subscriptions: Iterable<Subscription<Env, unknown>>): this {
        for (const sub of subscriptions) {
            this.on(sub.event as keyof M & string, sub.handler as EventHandler<Env, M[keyof M & string]>, {
                via: sub.via,
                name: sub.name,
            });
        }
        return this;
    }

    /** What is listening, for the admin page and for tests. */
    subscribers(event?: string): SubscriberInfo[] {
        const list = event === undefined ? this.subs : this.matching(event);
        return list.map(({ event: name, name: subscriber, via }) => ({ event: name, name: subscriber, via }));
    }

    /**
     * Announce an event. Inline subscribers have run (or failed, individually) when the
     * promise resolves; queue subscribers have been handed to the queue, or run inline when
     * there is none. Never throws for a subscriber's sake.
     */
    async emit<K extends keyof M & string>(
        env: Env,
        name: K,
        payload: M[K],
        opts: EmitOptions = {},
    ): Promise<EmitResult> {
        const event: OttaEvent<M[K]> = {
            id: opts.id ?? crypto.randomUUID(),
            name,
            payload,
            at: this.now(),
            ...(opts.actor ? { actor: opts.actor } : {}),
        };
        const matching = this.matching(name);
        const inline = matching.filter((sub) => sub.via === 'inline');
        const queued = matching.filter((sub) => sub.via === 'queue');

        const ran = await this.run(env, event, inline, 'inline', opts.defer);
        let wasQueued = false;
        if (queued.length > 0) {
            const queue = this.options.queue?.(env);
            if (queue) {
                const sent = await dispatch(queue as unknown as QueueConfig['queue'], EVENT_JOB_TYPE, event);
                if (sent.success) {
                    wasQueued = true;
                } else {
                    this.onError(sent.error, { event: name, subscriber: '(queue dispatch)', via: 'queue' });
                }
            }
            if (!wasQueued) {
                // No queue, or the send failed: run them here rather than lose the event.
                const fallback = await this.run(env, event, queued, 'inline', opts.defer);
                ran.delivered += fallback.delivered;
                ran.failed += fallback.failed;
            }
        }
        return { id: event.id, delivered: ran.delivered, queued: wasQueued, failed: ran.failed };
    }

    /** The consumer half: run the `'queue'` subscribers for an envelope the queue delivered. */
    async deliver(env: Env, event: OttaEvent): Promise<DeliveryResult> {
        const queued = this.matching(event.name).filter((sub) => sub.via === 'queue');
        return this.run(env, event, queued, 'queue');
    }

    /**
     * A `@ottabase/queue` handler for `EVENT_JOB_TYPE`. Throws when any subscriber failed so
     * the queue retries the job; queued subscribers must therefore be idempotent, which is
     * the ordinary contract for queue work.
     */
    jobHandler(): JobHandler<OttaEvent, Env> {
        return async (job, ctx) => {
            const result = await this.deliver(ctx.env, job.payload);
            if (result.failed > 0) {
                throw new Error(
                    `[events] ${result.failed} of ${result.delivered} subscriber(s) failed for "${job.payload.name}"`,
                );
            }
        };
    }

    private matching(name: string): Array<Registered<Env>> {
        return this.subs.filter((sub) => sub.event === name || sub.event === '*');
    }

    private async run(
        env: Env,
        event: OttaEvent,
        subs: Array<Registered<Env>>,
        via: Delivery,
        defer?: (work: Promise<unknown>) => void,
    ): Promise<DeliveryResult> {
        if (subs.length === 0) return { delivered: 0, failed: 0 };
        const heldBack: Promise<unknown>[] = [];
        const context = {
            env,
            via,
            defer: defer ?? ((work: Promise<unknown>) => void heldBack.push(work)),
        };
        const outcomes = await Promise.allSettled(
            subs.map((sub) => Promise.resolve().then(() => sub.handler(event, context))),
        );
        let failed = 0;
        outcomes.forEach((outcome, index) => {
            if (outcome.status === 'rejected') {
                failed += 1;
                this.onError(outcome.reason, { event: event.name, subscriber: subs[index].name, via });
            }
        });
        if (heldBack.length > 0) {
            // No waitUntil was offered: deferred work is still part of this call.
            const settled = await Promise.allSettled(heldBack);
            for (const outcome of settled) {
                if (outcome.status === 'rejected') {
                    failed += 1;
                    this.onError(outcome.reason, { event: event.name, subscriber: '(deferred work)', via });
                }
            }
        }
        return { delivered: subs.length, failed };
    }
}

export function createEventBus<Env = unknown, M extends object = EventMap>(
    options?: EventBusOptions<Env>,
): EventBus<Env, M> {
    return new EventBus<Env, M>(options);
}

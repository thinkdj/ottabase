import { describe, expect, it, vi } from 'vitest';
import { createEventBus, EVENT_JOB_TYPE, type OttaEvent } from '../index';

interface Events {
    'user.created': { userId: string };
    'post.published': { postId: string };
}

type Env = { tag: string };
const env: Env = { tag: 'test' };

describe('emit and subscribe', () => {
    it('delivers the payload in an envelope with id, name, time and actor', async () => {
        const bus = createEventBus<Env, Events>({ now: () => 1_700_000_000_000 });
        const seen: OttaEvent[] = [];
        bus.on('user.created', (event) => void seen.push(event));

        const result = await bus.emit(env, 'user.created', { userId: 'u1' }, { id: 'evt-1', actor: { userId: 'u1' } });

        expect(result).toEqual({ id: 'evt-1', delivered: 1, queued: false, failed: 0 });
        expect(seen).toEqual([
            {
                id: 'evt-1',
                name: 'user.created',
                payload: { userId: 'u1' },
                at: 1_700_000_000_000,
                actor: { userId: 'u1' },
            },
        ]);
    });

    it('routes by name, lets "*" hear everything, and honours unsubscribe', async () => {
        const bus = createEventBus<Env, Events>();
        const users = vi.fn();
        const all = vi.fn();
        const off = bus.on('user.created', users);
        bus.on('*', all);

        await bus.emit(env, 'post.published', { postId: 'p1' });
        expect(users).not.toHaveBeenCalled();
        expect(all).toHaveBeenCalledTimes(1);

        await bus.emit(env, 'user.created', { userId: 'u1' });
        expect(users).toHaveBeenCalledTimes(1);

        off();
        await bus.emit(env, 'user.created', { userId: 'u2' });
        expect(users).toHaveBeenCalledTimes(1);
        expect(all).toHaveBeenCalledTimes(3);
    });

    it('rejects malformed event names at subscription time', () => {
        const bus = createEventBus();
        expect(() => bus.on('Has Spaces', () => {})).toThrow(/Invalid event name/);
        expect(() => bus.on('fine.name-with_parts:v2', () => {})).not.toThrow();
    });

    it('registers a manifest-style list and reports what is listening', () => {
        const bus = createEventBus<Env>();
        function sendWelcome() {}
        bus.subscribe([
            { event: 'user.created', handler: sendWelcome },
            { event: 'user.created', handler: () => {}, via: 'queue', name: 'syncCrm' },
        ]);
        expect(bus.subscribers('user.created')).toEqual([
            { event: 'user.created', name: 'sendWelcome', via: 'inline' },
            { event: 'user.created', name: 'syncCrm', via: 'queue' },
        ]);
        expect(bus.subscribers()).toHaveLength(2);
    });
});

describe('failure isolation', () => {
    it('one throwing subscriber neither stops the others nor rejects emit', async () => {
        const onError = vi.fn();
        const bus = createEventBus<Env, Events>({ onError });
        const ok = vi.fn();
        bus.on(
            'user.created',
            () => {
                throw new Error('boom');
            },
            { name: 'broken' },
        );
        bus.on('user.created', ok);

        const result = await bus.emit(env, 'user.created', { userId: 'u1' });

        expect(ok).toHaveBeenCalledTimes(1);
        expect(result.failed).toBe(1);
        expect(result.delivered).toBe(2);
        expect(onError).toHaveBeenCalledWith(expect.any(Error), {
            event: 'user.created',
            subscriber: 'broken',
            via: 'inline',
        });
    });

    it('logs one redacted structured line by default', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const bus = createEventBus<Env, Events>();
        bus.on('user.created', () => Promise.reject(new Error('secret detail')), { name: 'leaky' });
        await bus.emit(env, 'user.created', { userId: 'u1' });
        expect(spy).toHaveBeenCalledTimes(1);
        const line = JSON.parse(spy.mock.calls[0][0] as string);
        expect(line.event).toBe('event_subscriber_failed');
        expect(line.subscriber).toBe('leaky');
        spy.mockRestore();
    });
});

describe('deferred work', () => {
    it('is awaited before emit resolves when no waitUntil was offered', async () => {
        const bus = createEventBus<Env, Events>();
        let done = false;
        bus.on('user.created', (_event, ctx) => {
            ctx.defer(new Promise<void>((resolve) => setTimeout(() => ((done = true), resolve()), 5)));
        });
        await bus.emit(env, 'user.created', { userId: 'u1' });
        expect(done).toBe(true);
    });

    it('is handed to the supplied waitUntil otherwise, and counted if it rejects without one', async () => {
        const bus = createEventBus<Env, Events>({ onError: () => {} });
        const waitUntil = vi.fn();
        const work = Promise.resolve('later');
        bus.on('user.created', (_event, ctx) => ctx.defer(work));
        await bus.emit(env, 'user.created', { userId: 'u1' }, { defer: waitUntil });
        expect(waitUntil).toHaveBeenCalledWith(work);

        const failing = createEventBus<Env, Events>({ onError: () => {} });
        failing.on('user.created', (_event, ctx) => ctx.defer(Promise.reject(new Error('late'))));
        const result = await failing.emit(env, 'user.created', { userId: 'u1' });
        expect(result.failed).toBe(1);
    });
});

describe('queue fan-out', () => {
    function fakeQueue() {
        const sent: unknown[] = [];
        return { sent, send: async (body: unknown) => void sent.push(body) };
    }

    it('dispatches one job for the queued subscribers and runs them on deliver()', async () => {
        const queue = fakeQueue();
        const bus = createEventBus<Env, Events>({ queue: () => queue });
        const inline = vi.fn();
        const slow = vi.fn();
        bus.on('user.created', inline);
        bus.on('user.created', slow, { via: 'queue' });

        const result = await bus.emit(env, 'user.created', { userId: 'u1' }, { id: 'evt-q' });

        expect(result).toEqual({ id: 'evt-q', delivered: 1, queued: true, failed: 0 });
        expect(inline).toHaveBeenCalledTimes(1);
        expect(slow).not.toHaveBeenCalled();
        expect(queue.sent).toHaveLength(1);
        const job = queue.sent[0] as { type: string; payload: OttaEvent };
        expect(job.type).toBe(EVENT_JOB_TYPE);
        expect(job.payload.id).toBe('evt-q');

        const delivered = await bus.deliver(env, job.payload);
        expect(delivered).toEqual({ delivered: 1, failed: 0 });
        expect(slow).toHaveBeenCalledTimes(1);
        expect(slow.mock.calls[0][1].via).toBe('queue');
        expect(inline).toHaveBeenCalledTimes(1);
    });

    it('runs queued subscribers inline when there is no queue, or when the send fails', async () => {
        const slow = vi.fn();
        const noQueue = createEventBus<Env, Events>({ queue: () => null });
        noQueue.on('user.created', slow, { via: 'queue' });
        expect(await noQueue.emit(env, 'user.created', { userId: 'u1' })).toMatchObject({
            delivered: 1,
            queued: false,
        });
        expect(slow).toHaveBeenCalledTimes(1);

        const onError = vi.fn();
        const broken = createEventBus<Env, Events>({
            onError,
            queue: () => ({ send: () => Promise.reject(new Error('queue down')) }),
        });
        broken.on('user.created', slow, { via: 'queue' });
        expect(await broken.emit(env, 'user.created', { userId: 'u2' })).toMatchObject({
            delivered: 1,
            queued: false,
            failed: 0,
        });
        expect(slow).toHaveBeenCalledTimes(2);
        expect(onError).toHaveBeenCalledWith(
            expect.any(Error),
            expect.objectContaining({ subscriber: '(queue dispatch)' }),
        );
    });

    it('jobHandler throws when a queued subscriber fails, so the queue retries', async () => {
        const bus = createEventBus<Env, Events>({ onError: () => {} });
        bus.on(
            'user.created',
            () => {
                throw new Error('nope');
            },
            { via: 'queue' },
        );
        const handler = bus.jobHandler();
        const event: OttaEvent = { id: 'e', name: 'user.created', payload: { userId: 'u1' }, at: 0 };
        const ctx = { env, message: {} as never, attempt: 1, ack: () => {}, retry: () => {} };
        await expect(handler({ type: EVENT_JOB_TYPE, payload: event }, ctx)).rejects.toThrow(/1 of 1 subscriber/);
    });
});

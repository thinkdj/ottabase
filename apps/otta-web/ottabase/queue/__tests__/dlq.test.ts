import type { QueuedJob } from '@ottabase/queue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteDLQJob, getDLQJob, getDLQJobs, retryAllDLQJobs, retryDLQJob, storeDLQJob } from '..';

// The DLQ module pulls in the app's job handlers (mailer, config); they are irrelevant here.
vi.mock('../handlers', () => ({
    sendEmailHandler: vi.fn(),
    processOrderHandler: vi.fn(),
    generateReportHandler: vi.fn(),
    syncDataHandler: vi.fn(),
    batchTaskHandler: vi.fn(),
}));

/** In-memory KVNamespace: enough of the binding surface for the @ottabase/cf KV client. */
function memoryKV() {
    const store = new Map<string, string>();
    return {
        store,
        get: vi.fn(async (key: string, options?: { type?: string }) => {
            const value = store.get(key);
            if (value === undefined) return null;
            return options?.type === 'json' ? JSON.parse(value) : value;
        }),
        put: vi.fn(async (key: string, value: string) => {
            store.set(key, value);
        }),
        delete: vi.fn(async (key: string) => {
            store.delete(key);
        }),
        // Like real KV, the cursor resumes AFTER the last key returned (not at an offset), so
        // deleting already-listed keys mid-iteration never skips the rest.
        list: vi.fn(
            async ({ prefix = '', limit = 1000, cursor }: { prefix?: string; limit?: number; cursor?: string }) => {
                const keys = [...store.keys()]
                    .filter((key) => key.startsWith(prefix) && (!cursor || key > cursor))
                    .sort();
                const page = keys.slice(0, limit);
                const more = keys.length > limit;
                return {
                    keys: page.map((name) => ({ name })),
                    list_complete: !more,
                    cursor: more ? page[page.length - 1] : undefined,
                };
            },
        ),
    };
}

function job(id: string, attempts = 3): QueuedJob {
    return {
        type: 'send-email',
        payload: { to: `${id}@example.com` },
        meta: { id, attempts },
    } as unknown as QueuedJob;
}

describe('queue DLQ (KV keyed by job id)', () => {
    let kv: ReturnType<typeof memoryKV>;
    let env: CloudflareEnv;

    beforeEach(() => {
        kv = memoryKV();
        env = { OBCF_KV: kv, OBCF_QUEUE: { send: vi.fn(async () => undefined) } } as unknown as CloudflareEnv;
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const stats = () => JSON.parse(kv.store.get('queue:stats') ?? '{}') as { totalDLQ?: number };

    it('stores an entry under queue:dlq:<jobId> and counts it', async () => {
        await storeDLQJob(env, job('job-1'), 'boom');

        expect(kv.store.has('queue:dlq:job-1')).toBe(true);
        expect(JSON.parse(kv.store.get('queue:dlq:job-1')!)).toMatchObject({
            id: 'job-1',
            type: 'send-email',
            error: 'boom',
            attempts: 3,
        });
        expect(stats().totalDLQ).toBe(1);
    });

    it('looks a job up with one read and no key listing', async () => {
        await storeDLQJob(env, job('job-1'), 'boom');
        kv.list.mockClear();

        await expect(getDLQJob(env, 'job-1')).resolves.toMatchObject({ id: 'job-1' });
        await expect(getDLQJob(env, 'missing')).resolves.toBeNull();
        expect(kv.list).not.toHaveBeenCalled();
    });

    it('deletes by key, moving the counter only for an entry that existed', async () => {
        await storeDLQJob(env, job('job-1'), 'boom');
        kv.list.mockClear();

        await expect(deleteDLQJob(env, 'job-1')).resolves.toBe(true);
        expect(kv.store.has('queue:dlq:job-1')).toBe(false);
        expect(stats().totalDLQ).toBe(0);

        await expect(deleteDLQJob(env, 'job-1')).resolves.toBe(false);
        expect(stats().totalDLQ).toBe(0);
        expect(kv.list).not.toHaveBeenCalled();
    });

    it('retries by re-dispatching the stored payload and removing the entry', async () => {
        await storeDLQJob(env, job('job-1'), 'boom');

        await expect(retryDLQJob(env, 'job-1')).resolves.toEqual({ success: true });
        expect((env.OBCF_QUEUE as unknown as { send: ReturnType<typeof vi.fn> }).send).toHaveBeenCalledWith(
            expect.objectContaining({ type: 'send-email', payload: { to: 'job-1@example.com' } }),
            expect.anything(),
        );
        expect(kv.store.has('queue:dlq:job-1')).toBe(false);

        await expect(retryDLQJob(env, 'job-1')).resolves.toEqual({ success: false, error: 'Job not found in DLQ' });
    });

    it('lists most recent first even though ids are not chronological', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-11T10:00:00Z'));
        await storeDLQJob(env, job('zzz-old'), 'first');
        vi.setSystemTime(new Date('2026-10-11T11:00:00Z'));
        await storeDLQJob(env, job('aaa-new'), 'second');

        const page = await getDLQJobs(env, 50);

        expect(page.jobs.map((entry) => entry.id)).toEqual(['aaa-new', 'zzz-old']);
        expect(page.hasMore).toBe(false);
    });

    it('retries every entry and leaves the DLQ empty', async () => {
        for (const id of ['a', 'b', 'c']) await storeDLQJob(env, job(id), 'boom');

        const result = await retryAllDLQJobs(env);

        expect(result).toEqual({ success: 3, failed: 0, errors: [] });
        expect([...kv.store.keys()].filter((key) => key.startsWith('queue:dlq:'))).toEqual([]);
        expect(stats().totalDLQ).toBe(0);
    });

    it('retries across listing pages while deleting as it goes', async () => {
        // retryAllDLQJobs pages 100 at a time and deletes each retried key before the next page.
        const ids = Array.from({ length: 150 }, (_, i) => `job-${String(i).padStart(3, '0')}`);
        for (const id of ids) await storeDLQJob(env, job(id), 'boom');

        const result = await retryAllDLQJobs(env);

        expect(result.success).toBe(150);
        expect([...kv.store.keys()].filter((key) => key.startsWith('queue:dlq:'))).toEqual([]);
    });
});

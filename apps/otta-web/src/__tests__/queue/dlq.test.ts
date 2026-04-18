import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock types for testing
interface MockKVNamespace {
    get: ReturnType<typeof vi.fn>;
    put: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    list: ReturnType<typeof vi.fn>;
}

interface MockQueue {
    send: ReturnType<typeof vi.fn>;
}

// Simplified DLQ functions for testing (mirrors the actual implementation)
const DLQ_PREFIX = 'queue:dlq:';
const DLQ_TTL = 604800;

interface DLQJob {
    id: string;
    type: string;
    payload: unknown;
    error: string;
    failedAt: number;
    attempts: number;
}

async function storeDLQJob(
    kv: MockKVNamespace,
    job: { type: string; payload: unknown; meta?: { id?: string; attempts?: number } },
    error: Error,
): Promise<void> {
    const jobId = job.meta?.id || `dlq-${Date.now()}`;
    const key = `${DLQ_PREFIX}${Date.now()}:${jobId}`;

    const dlqJob: DLQJob = {
        id: jobId,
        type: job.type,
        payload: job.payload,
        error: error.message,
        failedAt: Date.now(),
        attempts: job.meta?.attempts || 1,
    };

    await kv.put(key, JSON.stringify(dlqJob), { expirationTtl: DLQ_TTL });
}

async function getDLQJobs(kv: MockKVNamespace, limit = 50): Promise<{ jobs: DLQJob[]; hasMore: boolean }> {
    const listResult = await kv.list({ prefix: DLQ_PREFIX, limit });
    if (!listResult.keys) return { jobs: [], hasMore: false };

    const jobs: DLQJob[] = [];
    for (const key of listResult.keys) {
        const data = await kv.get(key.name);
        if (data) {
            jobs.push(JSON.parse(data));
        }
    }

    return { jobs, hasMore: !listResult.list_complete };
}

async function deleteDLQJob(kv: MockKVNamespace, jobId: string): Promise<boolean> {
    const listResult = await kv.list({ prefix: DLQ_PREFIX, limit: 1000 });
    if (!listResult.keys) return false;

    for (const key of listResult.keys) {
        if (key.name.includes(jobId)) {
            await kv.delete(key.name);
            return true;
        }
    }
    return false;
}

async function retryDLQJob(
    queue: MockQueue,
    kv: MockKVNamespace,
    jobId: string,
): Promise<{ success: boolean; error?: string }> {
    const listResult = await kv.list({ prefix: DLQ_PREFIX, limit: 1000 });
    if (!listResult.keys) return { success: false, error: 'KV not available' };

    for (const key of listResult.keys) {
        if (key.name.includes(jobId)) {
            const data = await kv.get(key.name);
            if (!data) return { success: false, error: 'Job data not found' };

            const job = JSON.parse(data) as DLQJob;
            await queue.send({ type: job.type, payload: job.payload });
            await kv.delete(key.name);
            return { success: true };
        }
    }
    return { success: false, error: 'Job not found in DLQ' };
}

describe('Dead Letter Queue (DLQ)', () => {
    let mockKV: MockKVNamespace;
    let mockQueue: MockQueue;

    beforeEach(() => {
        mockKV = {
            get: vi.fn(),
            put: vi.fn().mockResolvedValue(undefined),
            delete: vi.fn().mockResolvedValue(undefined),
            list: vi.fn(),
        };
        mockQueue = {
            send: vi.fn().mockResolvedValue({ success: true }),
        };
    });

    describe('storeDLQJob', () => {
        it('should store failed job with full payload', async () => {
            const job = {
                type: 'send-email',
                payload: { to: 'user@example.com', subject: 'Welcome' },
                meta: { id: 'job-123', attempts: 3 },
            };
            const error = new Error('SMTP connection failed');

            await storeDLQJob(mockKV, job, error);

            expect(mockKV.put).toHaveBeenCalledTimes(1);
            const [key, value, options] = mockKV.put.mock.calls[0];

            expect(key).toMatch(/^queue:dlq:\d+:job-123$/);
            expect(options.expirationTtl).toBe(604800); // 7 days

            const stored = JSON.parse(value);
            expect(stored.id).toBe('job-123');
            expect(stored.type).toBe('send-email');
            expect(stored.payload).toEqual({ to: 'user@example.com', subject: 'Welcome' });
            expect(stored.error).toBe('SMTP connection failed');
            expect(stored.attempts).toBe(3);
            expect(stored.failedAt).toBeDefined();
        });

        it('should generate ID if not provided', async () => {
            const job = { type: 'task', payload: {} };
            const error = new Error('Failed');

            await storeDLQJob(mockKV, job, error);

            const [key] = mockKV.put.mock.calls[0];
            expect(key).toMatch(/^queue:dlq:\d+:dlq-\d+$/);
        });
    });

    describe('getDLQJobs', () => {
        it('should return empty array when no jobs exist', async () => {
            mockKV.list.mockResolvedValue({ keys: [], list_complete: true });

            const result = await getDLQJobs(mockKV);

            expect(result.jobs).toEqual([]);
            expect(result.hasMore).toBe(false);
        });

        it('should return DLQ jobs with pagination info', async () => {
            const dlqJob: DLQJob = {
                id: 'job-1',
                type: 'send-email',
                payload: { to: 'test@example.com' },
                error: 'Connection timeout',
                failedAt: '2024-01-01T00:00:00Z',
                attempts: 3,
            };

            mockKV.list.mockResolvedValue({
                keys: [{ name: 'queue:dlq:123:job-1' }],
                list_complete: true,
            });
            mockKV.get.mockResolvedValue(JSON.stringify(dlqJob));

            const result = await getDLQJobs(mockKV);

            expect(result.jobs).toHaveLength(1);
            expect(result.jobs[0].id).toBe('job-1');
            expect(result.jobs[0].type).toBe('send-email');
            expect(result.hasMore).toBe(false);
        });

        it('should indicate when more jobs exist', async () => {
            mockKV.list.mockResolvedValue({
                keys: [{ name: 'queue:dlq:123:job-1' }],
                list_complete: false,
                cursor: 'next-cursor',
            });
            mockKV.get.mockResolvedValue(
                JSON.stringify({
                    id: 'job-1',
                    type: 'task',
                    payload: {},
                    error: 'err',
                    failedAt: '',
                    attempts: 1,
                }),
            );

            const result = await getDLQJobs(mockKV, 1);

            expect(result.hasMore).toBe(true);
        });
    });

    describe('deleteDLQJob', () => {
        it('should delete job from DLQ', async () => {
            mockKV.list.mockResolvedValue({
                keys: [{ name: 'queue:dlq:123:job-456' }],
                list_complete: true,
            });

            const result = await deleteDLQJob(mockKV, 'job-456');

            expect(result).toBe(true);
            expect(mockKV.delete).toHaveBeenCalledWith('queue:dlq:123:job-456');
        });

        it('should return false when job not found', async () => {
            mockKV.list.mockResolvedValue({ keys: [], list_complete: true });

            const result = await deleteDLQJob(mockKV, 'nonexistent');

            expect(result).toBe(false);
            expect(mockKV.delete).not.toHaveBeenCalled();
        });
    });

    describe('retryDLQJob', () => {
        it('should re-dispatch job and remove from DLQ', async () => {
            const dlqJob: DLQJob = {
                id: 'job-789',
                type: 'process-order',
                payload: { orderId: 123 },
                error: 'Database timeout',
                failedAt: '2024-01-01T00:00:00Z',
                attempts: 2,
            };

            mockKV.list.mockResolvedValue({
                keys: [{ name: 'queue:dlq:123:job-789' }],
                list_complete: true,
            });
            mockKV.get.mockResolvedValue(JSON.stringify(dlqJob));

            const result = await retryDLQJob(mockQueue, mockKV, 'job-789');

            expect(result.success).toBe(true);
            expect(mockQueue.send).toHaveBeenCalledWith({
                type: 'process-order',
                payload: { orderId: 123 },
            });
            expect(mockKV.delete).toHaveBeenCalledWith('queue:dlq:123:job-789');
        });

        it('should return error when job not found', async () => {
            mockKV.list.mockResolvedValue({ keys: [], list_complete: true });

            const result = await retryDLQJob(mockQueue, mockKV, 'nonexistent');

            expect(result.success).toBe(false);
            expect(result.error).toBe('Job not found in DLQ');
            expect(mockQueue.send).not.toHaveBeenCalled();
        });
    });

    describe('DLQ Integration Flow', () => {
        it('should handle full DLQ lifecycle: store -> list -> retry', async () => {
            // 1. Store a failed job
            const job = {
                type: 'send-notification',
                payload: { userId: 42, message: 'Hello' },
                meta: { id: 'notif-001', attempts: 3 },
            };
            await storeDLQJob(mockKV, job, new Error('Push service unavailable'));

            // Verify storage call
            expect(mockKV.put).toHaveBeenCalledTimes(1);
            const storedData = JSON.parse(mockKV.put.mock.calls[0][1]);

            // 2. Simulate listing (mock returns what was stored)
            mockKV.list.mockResolvedValue({
                keys: [{ name: `queue:dlq:${Date.now()}:notif-001` }],
                list_complete: true,
            });
            mockKV.get.mockResolvedValue(JSON.stringify(storedData));

            const listResult = await getDLQJobs(mockKV);
            expect(listResult.jobs).toHaveLength(1);
            expect(listResult.jobs[0].payload).toEqual({ userId: 42, message: 'Hello' });

            // 3. Retry the job
            const retryResult = await retryDLQJob(mockQueue, mockKV, 'notif-001');

            expect(retryResult.success).toBe(true);
            expect(mockQueue.send).toHaveBeenCalledWith({
                type: 'send-notification',
                payload: { userId: 42, message: 'Hello' },
            });
        });
    });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    Scheduler,
    createScheduler,
    createTaskRepository,
    TaskRepository,
    ScheduledTaskRecord,
    type CronJobPayload,
} from '../scheduler';

// Mock task data
const createMockTask = (overrides: Partial<ScheduledTaskRecord> = {}): ScheduledTaskRecord => ({
    id: 'task-1',
    name: 'test-task',
    description: 'Test task',
    schedule: '* * * * *',
    taskType: 'handler',
    task: 'test:handler',
    payload: null,
    isActive: true,
    lastRunAt: null,
    nextRunAt: new Date(Date.now() - 1000), // Due
    lastStatus: null,
    lastError: null,
    runCount: 0,
    failCount: 0,
    ...overrides,
});

/**
 * A repository that keeps the model's lock semantics (ScheduledTask.acquireExecutionLock): a
 * scheduled run needs the row active and due, a manual one needs no run since it was requested,
 * and neither may take a row another run holds. Completion and failure move `nextRunAt` on.
 */
const createStatefulRepository = (tasks: ScheduledTaskRecord[]): TaskRepository => {
    const rows = new Map(tasks.map((task) => [task.id, { ...task }]));
    const finish = (id: string, startedAt: Date, nextRunAt: Date | null, status: string) => {
        const row = rows.get(id);
        if (!row || row.lastStatus !== 'running' || row.lastRunAt?.getTime() !== startedAt.getTime()) return false;
        Object.assign(row, { lastStatus: status, lastRunAt: new Date(startedAt.getTime() + 1), nextRunAt });
        return true;
    };
    return {
        getDueTasks: vi.fn(async () =>
            [...rows.values()].filter((row) => row.isActive && row.nextRunAt && row.nextRunAt.getTime() <= Date.now()),
        ),
        getTask: vi.fn(async (id: string) => rows.get(id) ?? null),
        acquireLock: vi.fn(async (id: string, startedAt: Date, requestedAt: Date | null) => {
            const row = rows.get(id);
            if (!row || row.lastStatus === 'running') return false;
            const eligible = requestedAt
                ? !row.lastRunAt || row.lastRunAt < requestedAt
                : row.isActive && !!row.nextRunAt && row.nextRunAt <= startedAt;
            if (!eligible) return false;
            Object.assign(row, { lastStatus: 'running', lastRunAt: startedAt });
            return true;
        }),
        markCompleted: vi.fn(async (id: string, startedAt: Date, nextRunAt: Date) =>
            finish(id, startedAt, nextRunAt, 'success'),
        ),
        markFailed: vi.fn(async (id: string, startedAt: Date, _error: string, nextRunAt: Date | null) =>
            finish(id, startedAt, nextRunAt, 'failed'),
        ),
    };
};

// Mock repository
const createMockRepository = (tasks: ScheduledTaskRecord[] = []): TaskRepository => ({
    getDueTasks: vi.fn().mockResolvedValue(tasks),
    getTask: vi.fn().mockImplementation(async (id: string) => tasks.find((task) => task.id === id) ?? null),
    acquireLock: vi.fn().mockResolvedValue(true), // Default: lock acquired
    markCompleted: vi.fn().mockResolvedValue(true),
    markFailed: vi.fn().mockResolvedValue(true),
});

interface TestEnv {
    DB: { query: () => Promise<void> };
}

describe('Scheduler', () => {
    let mockEnv: TestEnv;

    beforeEach(() => {
        mockEnv = {
            DB: { query: vi.fn().mockResolvedValue(undefined) },
        };
    });

    describe('createScheduler', () => {
        it('should create a Scheduler instance', () => {
            const scheduler = createScheduler<TestEnv>();
            expect(scheduler).toBeInstanceOf(Scheduler);
        });
    });

    describe('handler registration', () => {
        it('should register a handler', () => {
            const scheduler = createScheduler<TestEnv>().handler('test:handler', async () => {});

            expect(scheduler.hasHandler('test:handler')).toBe(true);
            expect(scheduler.hasHandler('unknown')).toBe(false);
        });

        it('should support chainable API', () => {
            const scheduler = createScheduler<TestEnv>()
                .handler('handler1', async () => {})
                .handler('handler2', async () => {})
                .handler('handler3', async () => {});

            expect(scheduler.getHandlers()).toHaveLength(3);
        });

        it('should register handler with description', () => {
            const scheduler = createScheduler<TestEnv>().handler('cleanup', async () => {}, 'Cleans up old data');

            const handlers = scheduler.getHandlers();
            expect(handlers[0].description).toBe('Cleans up old data');
        });
    });

    describe('tick', () => {
        it('should execute due task', async () => {
            const handlerFn = vi.fn();
            const task = createMockTask();
            const repository = createMockRepository([task]);

            const scheduler = createScheduler<TestEnv>().handler('test:handler', handlerFn);

            const result = await scheduler.tick(mockEnv, repository);

            expect(repository.getDueTasks).toHaveBeenCalled();
            expect(repository.acquireLock).toHaveBeenCalledWith(task.id, expect.any(Date), null);
            expect(handlerFn).toHaveBeenCalled();
            expect(repository.markCompleted).toHaveBeenCalled();
            expect(result).toEqual({ executed: 1, failed: 0, skipped: 0, queued: 0 });
        });

        it('should pass context to handler', async () => {
            const handlerFn = vi.fn();
            const task = createMockTask({
                payload: JSON.stringify({ userId: '123' }),
            });
            const repository = createMockRepository([task]);

            const scheduler = createScheduler<TestEnv>().handler('test:handler', handlerFn);

            await scheduler.tick(mockEnv, repository);

            const context = handlerFn.mock.calls[0][0];
            expect(context.env).toBe(mockEnv);
            expect(context.taskId).toBe(task.id);
            expect(context.taskName).toBe(task.name);
            expect(context.schedule).toBe(task.schedule);
            expect(context.payload).toEqual({ userId: '123' });
        });

        it('should skip task with no registered handler', async () => {
            const task = createMockTask({ task: 'unknown:handler' });
            const repository = createMockRepository([task]);

            const scheduler = createScheduler<TestEnv>();
            const result = await scheduler.tick(mockEnv, repository);

            expect(result.failed).toBe(1);
            expect(result.executed).toBe(0);
            expect(repository.markFailed).toHaveBeenCalledWith(
                task.id,
                expect.any(Date),
                expect.stringContaining('No handler registered'),
                expect.any(Date),
            );
        });

        it('should skip non-handler task types', async () => {
            const task = createMockTask({ taskType: 'command' });
            const repository = createMockRepository([task]);

            const scheduler = createScheduler<TestEnv>().handler('test:handler', async () => {});

            const result = await scheduler.tick(mockEnv, repository);

            expect(result.failed).toBe(1);
        });

        it('should handle multiple due tasks', async () => {
            const handler1 = vi.fn();
            const handler2 = vi.fn();

            const tasks = [
                createMockTask({ id: '1', task: 'handler1' }),
                createMockTask({ id: '2', task: 'handler2' }),
            ];
            const repository = createMockRepository(tasks);

            const scheduler = createScheduler<TestEnv>().handler('handler1', handler1).handler('handler2', handler2);

            const result = await scheduler.tick(mockEnv, repository);

            expect(handler1).toHaveBeenCalled();
            expect(handler2).toHaveBeenCalled();
            expect(result.executed).toBe(2);
        });

        it('returns final counts per outcome and keeps going after a bookkeeping throw', async () => {
            const tasks = [
                createMockTask({ id: 'ok', task: 'ok' }),
                createMockTask({ id: 'boom', task: 'boom' }),
                createMockTask({ id: 'locked', task: 'ok' }),
                createMockTask({ id: 'db-down', task: 'ok' }),
                createMockTask({ id: 'ok-2', task: 'ok' }),
            ];
            const repository = createMockRepository(tasks);
            vi.mocked(repository.acquireLock).mockImplementation(async (id: string) => {
                if (id === 'locked') return false;
                if (id === 'db-down') throw new Error('D1 unavailable');
                return true;
            });
            const ok = vi.fn();

            const scheduler = createScheduler<TestEnv>({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } })
                .handler('ok', ok)
                .handler('boom', () => {
                    throw new Error('handler failed');
                });

            const result = await scheduler.tick(mockEnv, repository);

            expect(result).toEqual({ executed: 2, failed: 2, skipped: 1, queued: 0 });
            // The task after the bookkeeping throw still ran.
            expect(ok).toHaveBeenCalledTimes(2);
        });

        it('should return empty result when no tasks due', async () => {
            const repository = createMockRepository([]);

            const scheduler = createScheduler<TestEnv>();
            const result = await scheduler.tick(mockEnv, repository);

            expect(result.executed).toBe(0);
            expect(result.failed).toBe(0);
            expect(result.skipped).toBe(0);
        });
    });

    describe('error handling', () => {
        it('should mark task as failed on error', async () => {
            const error = new Error('Task failed');
            const handlerFn = vi.fn().mockRejectedValue(error);
            const task = createMockTask();
            const repository = createMockRepository([task]);

            const scheduler = createScheduler<TestEnv>().handler('test:handler', handlerFn);

            const result = await scheduler.tick(mockEnv, repository);

            expect(repository.markFailed).toHaveBeenCalledWith(
                task.id,
                expect.any(Date),
                'Task failed',
                expect.any(Date),
            );
            expect(result).toEqual({ executed: 0, failed: 1, skipped: 0, queued: 0 });
        });

        it('should call onError hook when provided', async () => {
            const error = new Error('Task failed');
            const handlerFn = vi.fn().mockRejectedValue(error);
            const onError = vi.fn();
            const task = createMockTask();
            const repository = createMockRepository([task]);

            const scheduler = createScheduler<TestEnv>({ onError }).handler('test:handler', handlerFn);

            await scheduler.tick(mockEnv, repository);

            expect(onError).toHaveBeenCalledWith(error, expect.any(Object));
        });
    });

    describe('hooks', () => {
        it('should call onBeforeTask hook', async () => {
            const order: string[] = [];
            const onBeforeTask = vi.fn(() => {
                order.push('before');
            });
            const handlerFn = vi.fn(() => {
                order.push('handler');
            });

            const task = createMockTask();
            const repository = createMockRepository([task]);

            const scheduler = createScheduler<TestEnv>({ onBeforeTask }).handler('test:handler', handlerFn);

            await scheduler.tick(mockEnv, repository);

            expect(order).toEqual(['before', 'handler']);
        });

        it('should call onAfterTask hook', async () => {
            const order: string[] = [];
            const onAfterTask = vi.fn(() => {
                order.push('after');
            });
            const handlerFn = vi.fn(() => {
                order.push('handler');
            });

            const task = createMockTask();
            const repository = createMockRepository([task]);

            const scheduler = createScheduler<TestEnv>({ onAfterTask }).handler('test:handler', handlerFn);

            await scheduler.tick(mockEnv, repository);

            expect(order).toEqual(['handler', 'after']);
        });
    });

    describe('runTask', () => {
        it('should manually run a task', async () => {
            const handlerFn = vi.fn();
            const task = createMockTask();
            const repository = createMockRepository([task]);
            const scheduler = createScheduler<TestEnv>().handler('test:handler', handlerFn);

            const result = await scheduler.runTask(task.id, mockEnv, repository);

            expect(handlerFn).toHaveBeenCalled();
            const context = handlerFn.mock.calls[0][0];
            expect(context.taskId).toBe(task.id);
            expect(result.status).toBe('completed');
            // A manual run is fenced by its request time, not by the schedule.
            expect(repository.acquireLock).toHaveBeenCalledWith(task.id, expect.any(Date), expect.any(Date));
        });

        it('should report a missing stored task', async () => {
            const repository = createMockRepository();
            const scheduler = createScheduler<TestEnv>();

            await expect(scheduler.runTask('unknown', mockEnv, repository)).resolves.toEqual({
                taskId: 'unknown',
                status: 'not_found',
            });
        });
    });

    describe('atomic locking', () => {
        it('should skip task if lock not acquired', async () => {
            const handlerFn = vi.fn();
            const task = createMockTask();
            const repository = createMockRepository([task]);

            // Simulate another worker already acquired the lock
            (repository.acquireLock as ReturnType<typeof vi.fn>).mockResolvedValue(false);

            const scheduler = createScheduler<TestEnv>().handler('test:handler', handlerFn);

            const result = await scheduler.tick(mockEnv, repository);

            expect(repository.acquireLock).toHaveBeenCalledWith(task.id, expect.any(Date), null);
            expect(handlerFn).not.toHaveBeenCalled();
            expect(repository.markCompleted).not.toHaveBeenCalled();
            expect(result.skipped).toBe(1);
        });

        it('should not mark task as failed if lock was not acquired', async () => {
            const handlerFn = vi.fn();
            const task = createMockTask();
            const repository = createMockRepository([task]);

            // Simulate another worker already acquired the lock
            (repository.acquireLock as ReturnType<typeof vi.fn>).mockResolvedValue(false);

            const scheduler = createScheduler<TestEnv>().handler('test:handler', handlerFn);

            await scheduler.tick(mockEnv, repository);

            expect(repository.markFailed).not.toHaveBeenCalled();
        });
    });

    it('marks malformed stored JSON from a manual run as failed after acquiring the lock', async () => {
        const handlerFn = vi.fn();
        const task = createMockTask({ payload: '{broken' });
        const repository = createMockRepository([task]);
        const scheduler = createScheduler<TestEnv>().handler('test:handler', handlerFn);

        const result = await scheduler.runTask(task.id, mockEnv, repository);

        expect(handlerFn).not.toHaveBeenCalled();
        expect(repository.markFailed).toHaveBeenCalledWith(
            task.id,
            expect.any(Date),
            expect.any(String),
            expect.any(Date),
        );
        expect(result.status).toBe('failed');
    });

    it('uses an atomic, reclaimable database lock for concurrent workers', async () => {
        const executeRaw = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
        const model = {
            due: vi.fn().mockResolvedValue([]),
            find: vi.fn().mockResolvedValue(null),
            acquireExecutionLock: vi.fn().mockResolvedValue(true),
            completeExecution: vi.fn().mockResolvedValue(true),
            failExecution: vi.fn().mockResolvedValue(true),
        };
        const repository = createTaskRepository(model, { executeRaw }, { lockTimeoutMs: 60_000 });
        const startedAt = new Date('2026-08-27T10:00:00Z');

        await expect(repository.acquireLock('task-1', startedAt, null)).resolves.toBe(true);

        expect(model.acquireExecutionLock).toHaveBeenCalledWith(
            'task-1',
            startedAt,
            new Date(startedAt.getTime() - 60_000),
            null,
            { executeRaw },
        );
    });

    it('does not let a reclaimed execution publish a stale completion', async () => {
        const task = createMockTask();
        const repository = createMockRepository([task]);
        (repository.markCompleted as ReturnType<typeof vi.fn>).mockResolvedValue(false);
        const scheduler = createScheduler<TestEnv>().handler('test:handler', async () => {});

        const result = await scheduler.tick(mockEnv, repository);

        expect(result).toEqual({ executed: 0, failed: 0, skipped: 1, queued: 0 });
        expect(repository.markFailed).not.toHaveBeenCalled();
    });

    describe('queued runs (one invocation per task)', () => {
        const quietLogger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

        it('enqueues one message per due task and runs nothing in the tick', async () => {
            const handlerFn = vi.fn();
            const repository = createMockRepository([createMockTask({ id: 'a' }), createMockTask({ id: 'b' })]);
            const enqueue = vi.fn().mockResolvedValue(true);
            const scheduler = createScheduler<TestEnv>({ enqueue, logger: quietLogger }).handler(
                'test:handler',
                handlerFn,
            );

            const result = await scheduler.tick(mockEnv, repository);

            expect(enqueue).toHaveBeenCalledOnce();
            expect(enqueue).toHaveBeenCalledWith(mockEnv, [{ taskId: 'a' }, { taskId: 'b' }]);
            expect(result).toEqual({ executed: 0, failed: 0, skipped: 0, queued: 2 });
            expect(repository.acquireLock).not.toHaveBeenCalled();
            expect(handlerFn).not.toHaveBeenCalled();
        });

        it('runs inline when no queue is bound', async () => {
            const handlerFn = vi.fn();
            const repository = createMockRepository([createMockTask()]);
            const enqueue = vi.fn().mockResolvedValue(false);
            const scheduler = createScheduler<TestEnv>({ enqueue, logger: quietLogger }).handler(
                'test:handler',
                handlerFn,
            );

            const result = await scheduler.tick(mockEnv, repository);

            expect(result).toEqual({ executed: 1, failed: 0, skipped: 0, queued: 0 });
            expect(handlerFn).toHaveBeenCalledOnce();
        });

        it('does not enqueue an empty tick', async () => {
            const enqueue = vi.fn().mockResolvedValue(true);
            const scheduler = createScheduler<TestEnv>({ enqueue, logger: quietLogger });

            await scheduler.tick(mockEnv, createMockRepository([]));

            expect(enqueue).not.toHaveBeenCalled();
        });

        it('rejects the tick when the queue refuses the batch, leaving the tasks due', async () => {
            const handlerFn = vi.fn();
            const repository = createMockRepository([createMockTask()]);
            const enqueue = vi.fn().mockRejectedValue(new Error('queue unavailable'));
            const scheduler = createScheduler<TestEnv>({ enqueue, logger: quietLogger }).handler(
                'test:handler',
                handlerFn,
            );

            await expect(scheduler.tick(mockEnv, repository)).rejects.toThrow('queue unavailable');
            expect(handlerFn).not.toHaveBeenCalled();
            expect(repository.acquireLock).not.toHaveBeenCalled();
        });

        it('runs a queued scheduled run once, however often the message is delivered', async () => {
            const handlerFn = vi.fn();
            const repository = createStatefulRepository([createMockTask()]);
            const scheduler = createScheduler<TestEnv>({ logger: quietLogger }).handler('test:handler', handlerFn);
            const run: CronJobPayload = { taskId: 'task-1' };

            const first = await scheduler.runQueued(run, mockEnv, repository);
            const duplicate = await scheduler.runQueued(run, mockEnv, repository);

            expect(first.status).toBe('completed');
            expect(duplicate.status).toBe('locked');
            expect(handlerFn).toHaveBeenCalledOnce();
            expect(repository.acquireLock).toHaveBeenNthCalledWith(1, 'task-1', expect.any(Date), null);
        });

        it('does not run a queued scheduled run while another run holds the task', async () => {
            const handlerFn = vi.fn();
            const repository = createStatefulRepository([
                createMockTask({ lastStatus: 'running', lastRunAt: new Date(Date.now() - 1000) }),
            ]);
            const scheduler = createScheduler<TestEnv>({ logger: quietLogger }).handler('test:handler', handlerFn);

            const result = await scheduler.runQueued({ taskId: 'task-1' }, mockEnv, repository);

            expect(result.status).toBe('locked');
            expect(handlerFn).not.toHaveBeenCalled();
        });

        it('queues a manual run with its request time and runs it once on delivery', async () => {
            const handlerFn = vi.fn();
            // Paused and not due: a manual run ignores the schedule.
            const repository = createStatefulRepository([
                createMockTask({ isActive: false, nextRunAt: null, lastRunAt: new Date(Date.now() - 60_000) }),
            ]);
            const runs: CronJobPayload[] = [];
            const enqueue = vi.fn(async (_env: TestEnv, batch: CronJobPayload[]) => {
                runs.push(...batch);
                return true;
            });
            const scheduler = createScheduler<TestEnv>({ enqueue, logger: quietLogger }).handler(
                'test:handler',
                handlerFn,
            );

            const requested = await scheduler.runTask('task-1', mockEnv, repository);

            expect(requested).toEqual({ taskId: 'task-1', status: 'queued' });
            expect(handlerFn).not.toHaveBeenCalled();
            expect(runs).toEqual([{ taskId: 'task-1', requestedAt: expect.any(Number) }]);

            const first = await scheduler.runQueued(runs[0], mockEnv, repository);
            const duplicate = await scheduler.runQueued(runs[0], mockEnv, repository);

            expect(first.status).toBe('completed');
            expect(duplicate.status).toBe('locked');
            expect(handlerFn).toHaveBeenCalledOnce();
        });

        it('records a failure on its own task and resolves, so the queue does not retry it', async () => {
            const onError = vi.fn();
            const repository = createStatefulRepository([
                createMockTask({ id: 'ok', task: 'ok' }),
                createMockTask({ id: 'boom', task: 'boom' }),
            ]);
            const ok = vi.fn();
            const scheduler = createScheduler<TestEnv>({ onError, logger: quietLogger })
                .handler('ok', ok)
                .handler('boom', () => {
                    throw new Error('handler failed');
                });

            const failed = await scheduler.runQueued({ taskId: 'boom' }, mockEnv, repository);
            const completed = await scheduler.runQueued({ taskId: 'ok' }, mockEnv, repository);

            expect(failed).toEqual({ taskId: 'boom', status: 'failed', error: 'handler failed' });
            expect(completed.status).toBe('completed');
            expect(repository.markFailed).toHaveBeenCalledOnce();
            expect(repository.markFailed).toHaveBeenCalledWith(
                'boom',
                expect.any(Date),
                'handler failed',
                expect.any(Date),
            );
            expect(onError).toHaveBeenCalledOnce();
            expect(ok).toHaveBeenCalledOnce();
        });

        it('rejects a queued run whose bookkeeping throws, so the queue retries the message', async () => {
            const repository = createMockRepository([createMockTask()]);
            vi.mocked(repository.acquireLock).mockRejectedValue(new Error('D1 unavailable'));
            const scheduler = createScheduler<TestEnv>({ logger: quietLogger }).handler('test:handler', vi.fn());

            await expect(scheduler.runQueued({ taskId: 'task-1' }, mockEnv, repository)).rejects.toThrow(
                'D1 unavailable',
            );
        });
    });
});

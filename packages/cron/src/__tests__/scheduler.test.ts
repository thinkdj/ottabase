import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Scheduler, createScheduler, createTaskRepository, TaskRepository, ScheduledTaskRecord } from '../scheduler';

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
            expect(repository.acquireLock).toHaveBeenCalledWith(task.id, expect.any(Date), true);
            expect(handlerFn).toHaveBeenCalled();
            expect(repository.markCompleted).toHaveBeenCalled();
            expect(result).toEqual({ executed: 1, failed: 0, skipped: 0 });
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
            expect(result).toEqual({ executed: 0, failed: 1, skipped: 0 });
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

            expect(repository.acquireLock).toHaveBeenCalledWith(task.id, expect.any(Date), true);
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

        await expect(repository.acquireLock('task-1', startedAt, true)).resolves.toBe(true);

        expect(model.acquireExecutionLock).toHaveBeenCalledWith(
            'task-1',
            startedAt,
            new Date(startedAt.getTime() - 60_000),
            true,
            { executeRaw },
        );
    });

    it('does not let a reclaimed execution publish a stale completion', async () => {
        const task = createMockTask();
        const repository = createMockRepository([task]);
        (repository.markCompleted as ReturnType<typeof vi.fn>).mockResolvedValue(false);
        const scheduler = createScheduler<TestEnv>().handler('test:handler', async () => {});

        const result = await scheduler.tick(mockEnv, repository);

        expect(result).toEqual({ executed: 0, failed: 0, skipped: 1 });
        expect(repository.markFailed).not.toHaveBeenCalled();
    });
});

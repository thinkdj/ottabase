import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createScheduler, type TaskRepository } from '@ottabase/cron';
import { ValidationError } from '../../validation';
import { ScheduledTask } from '../ScheduledTask';

function createInsertDriver() {
    let inserted: Record<string, unknown> | null = null;
    const db = {
        insert: vi.fn(() => ({
            values: vi.fn((data: Record<string, unknown>) => {
                inserted = data;
                return {
                    returning: vi.fn(async () => [
                        {
                            runCount: 0,
                            failCount: 0,
                            isActive: true,
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                            ...data,
                        },
                    ]),
                };
            }),
        })),
    };
    return {
        driver: { getDb: () => db } as never,
        getInserted: () => inserted,
    };
}

describe('ScheduledTask write invariants', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-08-27T10:00:30Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('initializes the next UTC occurrence when a registered task is created', async () => {
        const fake = createInsertDriver();

        await ScheduledTask.createRegistered(
            {
                name: '  every minute  ',
                schedule: '* * * * *',
                taskType: 'handler',
                task: 'queue:batch-task',
                payload: '{"action":"ping"}',
                isActive: true,
                appId: 'test-app',
            },
            ['queue:batch-task'],
            fake.driver,
        );

        expect(fake.getInserted()).toMatchObject({
            name: 'every minute',
            taskType: 'handler',
            timezone: 'UTC',
            nextRunAt: Date.parse('2026-08-27T10:01:00Z'),
        });
    });

    it.each([
        [{ schedule: '60 * * * *' }, 'schedule'],
        [{ payload: '{broken' }, 'payload'],
        [{ taskType: 'url' }, 'taskType'],
        [{ timezone: 'Asia/Kolkata' }, 'timezone'],
        [{ task: 'not:registered' }, 'task'],
    ])('rejects invalid scheduled task input %#', async (override, field) => {
        const fake = createInsertDriver();
        const creation = ScheduledTask.createRegistered(
            {
                name: 'task',
                schedule: '* * * * *',
                taskType: 'handler',
                task: 'queue:batch-task',
                payload: '{}',
                ...override,
            },
            ['queue:batch-task'],
            fake.driver,
        );

        await expect(creation).rejects.toMatchObject<Partial<ValidationError>>({
            name: 'ValidationError',
            fieldErrors: expect.objectContaining({ [field]: expect.any(String) }),
        });
    });

    it('queries due rows in the database with a bounded deterministic window', async () => {
        const where = vi.spyOn(ScheduledTask, 'where').mockResolvedValue([]);
        const now = Date.parse('2026-08-27T10:01:00Z');

        await ScheduledTask.due('test-app', 500, now);

        expect(where).toHaveBeenCalledWith(
            { appId: 'test-app', isActive: true, nextRunAt: { $lte: now } },
            { orderBy: 'nextRunAt', orderDirection: 'asc', limit: 100 },
        );
    });

    it('recomputes nextRunAt when a paused task is enabled', async () => {
        const task = new ScheduledTask({
            entity: 'scheduled_tasks',
            data: {
                id: 'task-1',
                name: 'task',
                schedule: '*/5 * * * *',
                taskType: 'handler',
                task: 'queue:batch-task',
                isActive: false,
                nextRunAt: null,
                runCount: 0,
                failCount: 0,
            },
        });
        vi.spyOn(task, 'save').mockResolvedValue(task);

        await task.toggle();

        expect(task.get('isActive')).toBe(true);
        expect((task.get('nextRunAt') as Date).toISOString()).toBe('2026-08-27T10:05:00.000Z');
    });

    it('atomically rechecks due state while acquiring an execution fence', async () => {
        const executeRaw = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
        const startedAt = new Date('2026-08-27T10:01:00Z');
        const staleBefore = new Date('2026-08-27T09:56:00Z');

        await expect(
            ScheduledTask.acquireExecutionLock('task-1', 'test-app', startedAt, staleBefore, null, { executeRaw }),
        ).resolves.toBe(true);

        expect(executeRaw).toHaveBeenCalledWith(expect.stringContaining('next_run_at <= ?'), [
            startedAt.getTime(),
            startedAt.getTime(),
            'task-1',
            'test-app',
            staleBefore.getTime(),
            null,
            startedAt.getTime(),
            null,
        ]);
        expect(executeRaw.mock.calls[0][0]).toContain('last_run_at < ?');
    });

    it('claims on real SQLite: due for a scheduled run, nothing since the request for a manual one', async () => {
        // The lock statement against a real SQLite table, so the CASE and the fences are what D1 runs.
        const db = new DatabaseSync(':memory:');
        db.exec(`CREATE TABLE scheduled_tasks (id TEXT PRIMARY KEY, app_id TEXT, is_active INTEGER,
            next_run_at INTEGER, last_status TEXT, last_run_at INTEGER, updated_at INTEGER)`);
        const driver = {
            executeRaw: async (sql: string, params: unknown[] = []) => ({
                meta: { changes: Number(db.prepare(sql).run(...(params as Array<string | number | null>)).changes) },
            }),
        };
        const at = (iso: string) => new Date(iso);
        const staleBefore = at('2026-08-27T09:55:00Z');
        const row = (values: { active: number; next: string | null; status?: string; last?: string }) => {
            db.exec('DELETE FROM scheduled_tasks');
            db.prepare(
                'INSERT INTO scheduled_tasks (id, app_id, is_active, next_run_at, last_status, last_run_at) VALUES (?, ?, ?, ?, ?, ?)',
            ).run(
                't',
                'app',
                values.active,
                values.next ? Date.parse(values.next) : null,
                values.status ?? null,
                values.last ? Date.parse(values.last) : null,
            );
        };
        const claim = (startedAt: string, requestedAt: string | null) =>
            ScheduledTask.acquireExecutionLock(
                't',
                'app',
                at(startedAt),
                staleBefore,
                requestedAt ? at(requestedAt) : null,
                driver,
            );

        // Scheduled: only while active and due, never while another run holds the row.
        row({ active: 1, next: '2026-08-27T10:01:00Z' });
        await expect(claim('2026-08-27T10:00:00Z', null)).resolves.toBe(false);
        await expect(claim('2026-08-27T10:01:00Z', null)).resolves.toBe(true);
        await expect(claim('2026-08-27T10:01:30Z', null)).resolves.toBe(false);
        row({ active: 0, next: '2026-08-27T09:00:00Z' });
        await expect(claim('2026-08-27T10:00:00Z', null)).resolves.toBe(false);

        // Manual: a paused, not-due row runs once per request; a redelivery after that run is a no-op.
        row({ active: 0, next: null, last: '2026-08-27T09:00:00Z' });
        await expect(claim('2026-08-27T10:00:01Z', '2026-08-27T10:00:00Z')).resolves.toBe(true);
        db.exec(
            `UPDATE scheduled_tasks SET last_status = 'success', last_run_at = ${Date.parse('2026-08-27T10:00:02Z')}`,
        );
        await expect(claim('2026-08-27T10:00:05Z', '2026-08-27T10:00:00Z')).resolves.toBe(false);
        await expect(claim('2026-08-27T10:00:06Z', '2026-08-27T10:00:04Z')).resolves.toBe(true);

        // A crashed run's lock lapses: a stale `running` row is reclaimed, a fresh one is not.
        row({ active: 1, next: '2026-08-27T09:00:00Z', status: 'running', last: '2026-08-27T09:58:00Z' });
        await expect(claim('2026-08-27T10:00:00Z', null)).resolves.toBe(false);
        row({ active: 1, next: '2026-08-27T09:00:00Z', status: 'running', last: '2026-08-27T09:50:00Z' });
        await expect(claim('2026-08-27T10:00:00Z', null)).resolves.toBe(true);
    });

    it('uses the start timestamp as a fence for completion and failure', async () => {
        const executeRaw = vi
            .fn()
            .mockResolvedValueOnce({ meta: { changes: 1 } })
            .mockResolvedValueOnce({ meta: { changes: 0 } });
        const startedAt = new Date('2026-08-27T10:00:00Z');
        const nextRunAt = new Date('2026-08-27T10:01:00Z');

        await expect(
            ScheduledTask.completeExecution('task-1', 'test-app', startedAt, nextRunAt, { executeRaw }),
        ).resolves.toBe(true);
        await expect(
            ScheduledTask.failExecution('task-1', 'test-app', startedAt, 'stale worker', nextRunAt, { executeRaw }),
        ).resolves.toBe(false);

        expect(executeRaw.mock.calls[0][0]).toContain("last_status = 'running' AND last_run_at = ?");
        expect(executeRaw.mock.calls[0][1]).toEqual([
            Date.now(),
            nextRunAt.getTime(),
            Date.now(),
            'task-1',
            'test-app',
            startedAt.getTime(),
        ]);
        expect(executeRaw.mock.calls[1][1]).toEqual([
            Date.now(),
            nextRunAt.getTime(),
            'stale worker',
            nextRunAt.getTime(),
            Date.now(),
            'task-1',
            'test-app',
            startedAt.getTime(),
        ]);
    });

    it('flows from model initialization through due selection into a truthful scheduler tick', async () => {
        const normalized = ScheduledTask.normalizeDefinition(
            {
                name: 'batch',
                schedule: '* * * * *',
                taskType: 'handler',
                task: 'queue:batch-task',
                payload: '{}',
                appId: 'test-app',
                isActive: true,
            },
            { registeredHandlers: ['queue:batch-task'], initializeNextRun: true },
        );
        const model = new ScheduledTask({
            entity: 'scheduled_tasks',
            data: {
                id: 'task-1',
                runCount: 0,
                failCount: 0,
                ...normalized,
            },
        });
        vi.spyOn(ScheduledTask, 'where').mockResolvedValue([model]);
        const due = await ScheduledTask.due('test-app', 100, Date.parse('2026-08-27T10:01:00Z'));
        const handler = vi.fn();
        const dueRecords = due.map((scheduled) => ({
            id: scheduled.get('id') as string,
            name: scheduled.get('name') as string,
            schedule: scheduled.get('schedule') as string,
            taskType: scheduled.get('taskType') as string,
            task: scheduled.get('task') as string,
            payload: scheduled.get('payload') as string,
            isActive: scheduled.get('isActive') as boolean,
            runCount: scheduled.get('runCount') as number,
            failCount: scheduled.get('failCount') as number,
        }));
        const repository: TaskRepository = {
            getDueTasks: vi.fn().mockResolvedValue(dueRecords),
            getTask: vi.fn().mockResolvedValue(dueRecords[0]),
            acquireLock: vi.fn().mockResolvedValue(true),
            markCompleted: vi.fn().mockResolvedValue(true),
            markFailed: vi.fn().mockResolvedValue(true),
        };

        const result = await createScheduler().handler('queue:batch-task', handler).tick({}, repository);

        expect(handler).toHaveBeenCalledOnce();
        expect(repository.markCompleted).toHaveBeenCalledWith('task-1', expect.any(Date), expect.any(Date));
        expect(result).toEqual({ executed: 1, failed: 0, skipped: 0, queued: 0 });
    });
});

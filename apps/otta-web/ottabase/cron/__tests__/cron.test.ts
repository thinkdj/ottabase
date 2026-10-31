import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CRON_JOB_TYPE, type ScheduledTaskRecord, type TaskRepository } from '@ottabase/cron';
import { dispatch, dispatchBatch, type JobContext, type QueuedJob } from '@ottabase/queue';
import { AuditLog, ScheduledTask } from '@ottabase/ottaorm/models';
import { resolvePlatformState } from '../../../worker/bootstrap';
import { ensureDbConnection } from '../../../worker/lib/db-utils';
import { incrementDispatchStats } from '../../queue';
import { getOttabaseConfig } from '../../config.loader';
import { packages } from '../../packages';
import { APP_CRON_TICK, appCronScheduler, getRegisteredAppCronHandlers, handleAppScheduled, runAppCronTask } from '..';

vi.mock('@ottabase/queue', () => ({
    dispatch: vi.fn(),
    dispatchBatch: vi.fn(),
}));

vi.mock('@ottabase/db/drizzle-d1', () => ({
    createD1Driver: vi.fn(() => ({ executeRaw: vi.fn() })),
}));

vi.mock('@ottabase/ottaorm/models', () => ({
    ScheduledTask: {
        due: vi.fn(),
        findForApp: vi.fn(),
        acquireExecutionLock: vi.fn(),
        completeExecution: vi.fn(),
        failExecution: vi.fn(),
    },
    AuditLog: {
        pruneOlderThan: vi.fn(),
    },
}));

vi.mock('../../queue', () => ({
    incrementDispatchStats: vi.fn(),
}));

vi.mock('../../../worker/bootstrap', () => ({
    resolvePlatformState: vi.fn(),
}));

vi.mock('../../../worker/lib/db-utils', () => ({
    ensureDbConnection: vi.fn(),
}));

const task = (overrides: Partial<ScheduledTaskRecord> = {}): ScheduledTaskRecord => ({
    id: 'task-1',
    name: 'report',
    schedule: '* * * * *',
    taskType: 'handler',
    task: 'queue:generate-report',
    payload: JSON.stringify({ reportType: 'weekly' }),
    isActive: true,
    runCount: 0,
    failCount: 0,
    ...overrides,
});

function repository(records: ScheduledTaskRecord[]): TaskRepository {
    return {
        getDueTasks: vi.fn().mockResolvedValue(records),
        getTask: vi.fn().mockImplementation(async (id: string) => records.find((record) => record.id === id) ?? null),
        acquireLock: vi.fn().mockResolvedValue(true),
        markCompleted: vi.fn().mockResolvedValue(true),
        markFailed: vi.fn().mockResolvedValue(true),
    };
}

const env = {
    OBCF_QUEUE: { send: vi.fn() },
    OBCF_D1: {},
    ENVIRONMENT: 'test',
} as unknown as CloudflareEnv;

const noQueueEnv = { ...env, OBCF_QUEUE: undefined } as unknown as CloudflareEnv;

/** A manual run executed here, as the `cron:run` consumer does with a queued "run now". */
const runNow = (repo: TaskRepository, taskId = 'task-1') =>
    appCronScheduler.runQueued({ taskId, requestedAt: Date.now() }, env, repo);

/** A `scheduled_tasks` row as the model hands it to the repository. */
const row = (record: ScheduledTaskRecord) => ({ get: (key: string) => record[key as keyof ScheduledTaskRecord] });

describe('application Cron registry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(dispatch).mockResolvedValue({ success: true, data: undefined });
        vi.mocked(dispatchBatch).mockResolvedValue({ success: true, data: { count: 1 } });
        vi.mocked(ScheduledTask.due).mockResolvedValue([]);
        vi.mocked(resolvePlatformState).mockResolvedValue({
            state: 'READY',
            source: 'env',
            panic: false,
            reason: 'test',
            bindings: { d1: true, kv: false, r2: false, r2Private: false, r2Vault: false, queue: true, assets: false },
        });
    });

    it('registers every package cron handler for admin discovery and execution', async () => {
        const names = getRegisteredAppCronHandlers().map((handler) => handler.name);
        // Every package contributes its own; the registry is the union. A new package adding a
        // handler must not break this test, so assert the known ones, not an exact list.
        expect(names).toEqual(
            expect.arrayContaining([
                'queue:send-email',
                'queue:process-order',
                'queue:generate-report',
                'queue:sync-data',
                'queue:batch-task',
                'landing:notify-leads', // otta:only ottalanding
                'audit:prune',
                'meter:prune-usage', // otta:only meter
            ]),
        );
        expect(new Set(names).size).toBe(names.length);

        const result = await runNow(repository([task()]));

        expect(result.status).toBe('completed');
        expect(dispatch).toHaveBeenCalledWith(env.OBCF_QUEUE, 'generate-report', {
            reportType: 'weekly',
            userId: undefined,
            params: undefined,
        });
    });

    it('prunes audit logs with the payload retention window, defaulting to 90 days', async () => {
        vi.mocked(AuditLog.pruneOlderThan).mockResolvedValue(3);
        const prune = (payload: string | null) => task({ task: 'audit:prune', payload });

        const appId = getOttabaseConfig(env).appId;

        const result = await runNow(repository([prune('{"olderThanDays":30}')]));
        expect(result.status).toBe('completed');
        expect(AuditLog.pruneOlderThan).toHaveBeenCalledWith(30, appId);

        await runNow(repository([prune(null)]));
        expect(AuditLog.pruneOlderThan).toHaveBeenLastCalledWith(90, appId);
    });

    it('rejects a non-positive audit retention window instead of deleting everything', async () => {
        const repo = repository([task({ task: 'audit:prune', payload: '{"olderThanDays":0}' })]);

        const result = await runNow(repo);

        expect(result.status).toBe('failed');
        expect(AuditLog.pruneOlderThan).not.toHaveBeenCalled();
        expect(repo.markFailed).toHaveBeenCalledWith(
            'task-1',
            expect.any(Date),
            expect.stringContaining('olderThanDays'),
            expect.any(Date),
        );
    });

    it('persists handler payload validation failures through the executor', async () => {
        const repo = repository([task({ payload: '{}' })]);

        const result = await runNow(repo);

        expect(result.status).toBe('failed');
        expect(repo.markFailed).toHaveBeenCalledWith(
            'task-1',
            expect.any(Date),
            expect.stringContaining('payload.reportType'),
            expect.any(Date),
        );
        expect(dispatch).not.toHaveBeenCalled();
    });

    it('does not retry an accepted queue job when stats persistence fails', async () => {
        vi.mocked(incrementDispatchStats).mockRejectedValueOnce(new Error('KV unavailable'));
        const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const result = await runNow(repository([task()]));

        expect(result.status).toBe('completed');
        expect(dispatch).toHaveBeenCalledOnce();
        expect(warning).toHaveBeenCalledWith(expect.stringContaining('cron_dispatch_stats_failed'));
    });

    it('exposes a real Cloudflare scheduled entrypoint for the minute trigger', async () => {
        const controller = {
            cron: APP_CRON_TICK,
            scheduledTime: Date.now(),
            noRetry: vi.fn(),
        };

        await handleAppScheduled(controller, env, {} as ExecutionContext);

        expect(resolvePlatformState).toHaveBeenCalledWith(env);
        expect(ensureDbConnection).toHaveBeenCalledWith(env);
        expect(ScheduledTask.due).toHaveBeenCalled();
        expect(controller.noRetry).not.toHaveBeenCalled();
    });

    it('hands each due task to the queue as its own cron:run job', async () => {
        vi.mocked(ScheduledTask.due).mockResolvedValue([
            row(task({ id: 'a' })),
            row(task({ id: 'b', task: 'audit:prune' })),
        ] as never);
        const log = vi.spyOn(console, 'log').mockImplementation(() => {});

        await handleAppScheduled(
            { cron: APP_CRON_TICK, scheduledTime: Date.now(), noRetry: vi.fn() },
            env,
            {} as ExecutionContext,
        );

        expect(dispatchBatch).toHaveBeenCalledWith(env.OBCF_QUEUE, [
            { type: CRON_JOB_TYPE, payload: { taskId: 'a' } },
            { type: CRON_JOB_TYPE, payload: { taskId: 'b' } },
        ]);
        // The tick ran nothing itself: no lock taken, no handler work.
        expect(ScheduledTask.acquireExecutionLock).not.toHaveBeenCalled();
        expect(dispatch).not.toHaveBeenCalled();
        expect(log).toHaveBeenCalledWith(expect.stringContaining('"queued":2'));
    });

    it('runs the due tasks inline when no queue is bound', async () => {
        vi.mocked(ScheduledTask.due).mockResolvedValue([row(task())] as never);
        vi.mocked(ScheduledTask.findForApp).mockResolvedValue(row(task()) as never);
        vi.mocked(ScheduledTask.acquireExecutionLock).mockResolvedValue(true);
        vi.mocked(ScheduledTask.completeExecution).mockResolvedValue(true);
        vi.spyOn(console, 'log').mockImplementation(() => {});

        await handleAppScheduled(
            { cron: APP_CRON_TICK, scheduledTime: Date.now(), noRetry: vi.fn() },
            noQueueEnv,
            {} as ExecutionContext,
        );

        expect(dispatchBatch).not.toHaveBeenCalled();
        expect(ScheduledTask.acquireExecutionLock).toHaveBeenCalledWith(
            'task-1',
            getOttabaseConfig(env).appId,
            expect.any(Date),
            expect.any(Date),
            null,
            expect.anything(),
        );
        expect(ScheduledTask.completeExecution).toHaveBeenCalledOnce();
    });

    it('queues an admin "run now" with its request time when a queue is bound', async () => {
        vi.mocked(ScheduledTask.findForApp).mockResolvedValue(row(task()) as never);

        const result = await runAppCronTask(env, 'task-1');

        expect(result).toEqual({ taskId: 'task-1', status: 'queued' });
        expect(dispatchBatch).toHaveBeenCalledWith(env.OBCF_QUEUE, [
            { type: CRON_JOB_TYPE, payload: { taskId: 'task-1', requestedAt: expect.any(Number) } },
        ]);
        expect(ScheduledTask.acquireExecutionLock).not.toHaveBeenCalled();
    });

    it('the core cron:run consumer runs the task once; a duplicate delivery is a no-op', async () => {
        vi.mocked(ScheduledTask.findForApp).mockResolvedValue(row(task()) as never);
        // The atomic lock: the first delivery claims the row, the redelivery finds it no longer due.
        vi.mocked(ScheduledTask.acquireExecutionLock).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
        vi.mocked(ScheduledTask.completeExecution).mockResolvedValue(true);
        vi.spyOn(console, 'log').mockImplementation(() => {});
        const consume = packages.queue()[CRON_JOB_TYPE];
        const job = { type: CRON_JOB_TYPE, payload: { taskId: 'task-1' } } as QueuedJob<never>;
        const ctx = { env } as JobContext<CloudflareEnv>;

        await consume(job, ctx);
        await consume(job, ctx);

        expect(ensureDbConnection).toHaveBeenCalledWith(env);
        expect(ScheduledTask.acquireExecutionLock).toHaveBeenCalledTimes(2);
        expect(ScheduledTask.acquireExecutionLock).toHaveBeenCalledWith(
            'task-1',
            getOttabaseConfig(env).appId,
            expect.any(Date),
            expect.any(Date),
            null,
            expect.anything(),
        );
        expect(dispatch).toHaveBeenCalledOnce(); // the generate-report handler ran once
        expect(ScheduledTask.completeExecution).toHaveBeenCalledOnce();
    });

    it('fails closed before DB work when the platform is not ready', async () => {
        vi.mocked(resolvePlatformState).mockResolvedValue({
            state: 'BOOTSTRAPPING',
            source: 'env',
            panic: false,
            reason: 'test',
            bindings: { d1: true, kv: false, r2: false, r2Private: false, r2Vault: false, queue: true, assets: false },
        });
        const controller = {
            cron: APP_CRON_TICK,
            scheduledTime: Date.now(),
            noRetry: vi.fn(),
        };

        await handleAppScheduled(controller, env, {} as ExecutionContext);

        expect(controller.noRetry).toHaveBeenCalled();
        expect(ensureDbConnection).not.toHaveBeenCalled();
    });
});

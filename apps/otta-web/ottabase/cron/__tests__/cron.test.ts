import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScheduledTaskRecord, TaskRepository } from '@ottabase/cron';
import { dispatch } from '@ottabase/queue';
import { ScheduledTask } from '@ottabase/ottaorm/models';
import { resolvePlatformState } from '../../../worker/bootstrap';
import { ensureDbConnection } from '../../../worker/lib/db-utils';
import { incrementDispatchStats } from '../../queue';
import { APP_CRON_TICK, appCronScheduler, getRegisteredAppCronHandlers, handleAppScheduled } from '..';

vi.mock('@ottabase/queue', () => ({
    dispatch: vi.fn(),
}));

vi.mock('@ottabase/db/drizzle-d1', () => ({
    createD1Driver: vi.fn(() => ({ executeRaw: vi.fn() })),
}));

vi.mock('@ottabase/ottaorm/models', () => ({
    ScheduledTask: {
        due: vi.fn(),
        find: vi.fn(),
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

describe('application Cron registry', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(dispatch).mockResolvedValue({ success: true, data: undefined });
        vi.mocked(ScheduledTask.due).mockResolvedValue([]);
        vi.mocked(resolvePlatformState).mockResolvedValue({
            state: 'READY',
            source: 'env',
            panic: false,
            reason: 'test',
            bindings: { d1: true, kv: false, r2: false, queue: true, assets: false },
        });
    });

    it('uses one explicit registry for admin discovery and execution', async () => {
        const names = getRegisteredAppCronHandlers().map((handler) => handler.name);
        expect(names).toEqual([
            'queue:send-email',
            'queue:process-order',
            'queue:generate-report',
            'queue:sync-data',
            'queue:batch-task',
        ]);

        const result = await appCronScheduler.runTask('task-1', env, repository([task()]));

        expect(result.status).toBe('completed');
        expect(dispatch).toHaveBeenCalledWith(env.OBCF_QUEUE, 'generate-report', {
            reportType: 'weekly',
            userId: undefined,
            params: undefined,
        });
    });

    it('persists handler payload validation failures through the executor', async () => {
        const repo = repository([task({ payload: '{}' })]);

        const result = await appCronScheduler.runTask('task-1', env, repo);

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

        const result = await appCronScheduler.runTask('task-1', env, repository([task()]));

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

    it('fails closed before DB work when the platform is not ready', async () => {
        vi.mocked(resolvePlatformState).mockResolvedValue({
            state: 'BOOTSTRAPPING',
            source: 'env',
            panic: false,
            reason: 'test',
            bindings: { d1: true, kv: false, r2: false, queue: true, assets: false },
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

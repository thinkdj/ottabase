import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/admin-guard', () => ({
    requireAdminAccess: vi.fn().mockResolvedValue({ user: { id: 'admin' } }),
}));
vi.mock('../../lib/db-utils', () => ({ initAdminCron: vi.fn(() => null) }));
vi.mock('../../lib/utils', () => ({ readJson: vi.fn() }));
vi.mock('@ottabase/ottaorm/models', () => ({
    ScheduledTask: {
        createRegistered: vi.fn(),
        find: vi.fn(),
        delete: vi.fn(),
    },
}));
vi.mock('../../../ottabase/cron', () => ({
    getRegisteredAppCronHandlers: vi.fn(() => [{ name: 'queue:batch-task', description: 'Batch task' }]),
    runAppCronTask: vi.fn(),
}));

import { ValidationError } from '@ottabase/ottaorm';
import { ScheduledTask } from '@ottabase/ottaorm/models';
import { getRegisteredAppCronHandlers, runAppCronTask } from '../../../ottabase/cron';
import { readJson } from '../../lib/utils';
import { handleAdminCronCreate, handleCronTask } from '../admin-cron';

function context(method = 'POST') {
    const request = new Request('http://localhost/api/admin/cron', { method });
    return {
        request,
        env: { OBCF_D1: {} },
        url: new URL(request.url),
    } as never;
}

async function requiredResponse(promise: Promise<Response | null>): Promise<Response> {
    const response = await promise;
    if (!response) throw new Error('Expected the Cron route to handle this request');
    return response;
}

describe('admin Cron routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getRegisteredAppCronHandlers).mockReturnValue([
            { name: 'queue:batch-task', description: 'Batch task' },
        ]);
    });

    it('maps model-owned schedule validation to a field-level 422', async () => {
        vi.mocked(readJson).mockResolvedValue({
            name: 'bad',
            schedule: '60 * * * *',
            task: 'queue:batch-task',
        });
        vi.mocked(ScheduledTask.createRegistered).mockRejectedValue(
            new ValidationError({ schedule: 'Schedule must be valid' }),
        );

        const response = await handleAdminCronCreate(context());
        const body = await response.json();

        expect(response.status).toBe(422);
        expect(body).toMatchObject({
            code: 'VALIDATION_ERROR',
            fieldErrors: { schedule: ['Schedule must be valid'] },
        });
    });

    it('creates only through the shared registered-handler model method', async () => {
        vi.mocked(readJson).mockResolvedValue({
            name: 'batch',
            schedule: '* * * * *',
            task: 'queue:batch-task',
            payload: '{}',
        });
        vi.mocked(ScheduledTask.createRegistered).mockResolvedValue({
            toJson: () => ({ id: 'task-1' }),
        } as never);

        const response = await handleAdminCronCreate(context());

        expect(response.status).toBe(201);
        expect(ScheduledTask.createRegistered).toHaveBeenCalledWith(
            expect.objectContaining({ task: 'queue:batch-task' }),
            ['queue:batch-task'],
        );
    });

    it('manual run returns the task persisted by the real executor', async () => {
        vi.mocked(runAppCronTask).mockResolvedValue({ taskId: 'task-1', status: 'completed' });
        vi.mocked(ScheduledTask.find).mockResolvedValue({
            toJson: () => ({ id: 'task-1', lastStatus: 'success' }),
        } as never);

        const response = await requiredResponse(handleCronTask(context(), 'task-1/run', 'run'));
        const body = (await response.json()) as { task: { lastStatus: string } };

        expect(response.status).toBe(200);
        expect(runAppCronTask).toHaveBeenCalledWith(expect.anything(), 'task-1');
        expect(body.task.lastStatus).toBe('success');
    });

    it('manual run reports lock contention without mutating status in the route', async () => {
        vi.mocked(runAppCronTask).mockResolvedValue({ taskId: 'task-1', status: 'locked' });

        const response = await requiredResponse(handleCronTask(context(), 'task-1/run', 'run'));
        const body = (await response.json()) as { code: string };

        expect(response.status).toBe(409);
        expect(body.code).toBe('CRON_TASK_RUNNING');
        expect(ScheduledTask.find).not.toHaveBeenCalled();
    });

    it('keeps a handler failure opaque to the client', async () => {
        vi.mocked(runAppCronTask).mockResolvedValue({
            taskId: 'task-1',
            status: 'failed',
            error: 'provider token=[REDACTED]',
        });

        const response = await requiredResponse(handleCronTask(context(), 'task-1/run', 'run'));
        const body = await response.json();

        expect(response.status).toBe(500);
        expect(body).toMatchObject({ code: 'CRON_TASK_FAILED', error: 'Internal server error' });
        expect(JSON.stringify(body)).not.toContain('provider');
    });
});

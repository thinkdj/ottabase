import { OttaQueryProvider } from '@ottabase/ottaorm/client';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiClient, toastSuccess, toastError } = vi.hoisted(() => ({
    apiClient: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
}));
vi.mock('@ottabase/ui-shadcn', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@ottabase/ui-shadcn')>()),
    toast: { success: toastSuccess, error: toastError },
}));

import { ScheduledTasks } from '../ScheduledTasks';

const now = Date.now();
const tasks = [
    {
        id: 't1',
        name: 'daily-cleanup',
        description: 'Removes stale sessions',
        schedule: '0 9 * * 1-5',
        taskType: 'handler',
        task: 'cleanup',
        payload: '{"days":30}',
        isActive: true,
        timezone: null,
        lastRunAt: now - 3_600_000,
        nextRunAt: now + 7_200_000,
        lastStatus: 'failed',
        lastError: 'boom',
        runCount: 12,
        failCount: 1,
        createdAt: now,
        updatedAt: now,
    },
    {
        id: 't2',
        name: 'weekly-digest',
        description: null,
        schedule: '0 0 * * 0',
        taskType: 'handler',
        task: 'digest',
        payload: null,
        isActive: false,
        timezone: null,
        lastRunAt: null,
        nextRunAt: null,
        lastStatus: null,
        lastError: null,
        runCount: 0,
        failCount: 0,
        createdAt: now,
        updatedAt: now,
    },
];
const overview = {
    tasks,
    pagination: { page: 1, perPage: 25, total: 2, totalPages: 1 },
    registeredHandlers: [
        { name: 'cleanup', description: 'Removes stale sessions' },
        { name: 'digest', description: 'Sends the weekly digest' },
    ],
    stats: { total: 2, active: 1, totalRuns: 12, totalFails: 1 },
};
const scope = { appId: 'app', organizationId: null, principalId: 'u1' };

function renderTasks() {
    return render(
        <OttaQueryProvider apiClient={apiClient} visibilityScope={scope}>
            <ScheduledTasks />
        </OttaQueryProvider>,
    );
}

describe('ScheduledTasks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiClient.mockImplementation(async (url: string, options?: { method?: string }) => {
            if (url.startsWith('/api/admin/cron?')) return overview;
            if (options?.method === 'POST' || options?.method === 'DELETE') return { success: true };
            throw new Error(`unexpected ${url}`);
        });
    });

    it('shows each task in words with its next and last run, and runs one on demand', async () => {
        renderTasks();
        expect(await screen.findByText('daily-cleanup')).toBeInTheDocument();
        expect(apiClient).toHaveBeenCalledWith('/api/admin/cron?page=1&perPage=25', expect.anything());
        expect(screen.getByText('Weekdays at 09:00')).toBeInTheDocument();
        expect(screen.getByText('in 1h')).toBeInTheDocument();
        expect(screen.getByText('1h ago')).toBeInTheDocument();
        expect(screen.getByText('Failed')).toBeInTheDocument();
        expect(screen.getByText('Every Sunday at 00:00')).toBeInTheDocument();
        expect(screen.getAllByText('Paused')).toHaveLength(2);

        fireEvent.click(screen.getAllByRole('button', { name: 'Run now' })[0]);
        await waitFor(() =>
            expect(apiClient).toHaveBeenCalledWith(
                '/api/admin/cron/t1/run',
                expect.objectContaining({ method: 'POST' }),
            ),
        );
        await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('daily-cleanup ran'));

        fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
        await waitFor(() =>
            expect(apiClient).toHaveBeenCalledWith(
                '/api/admin/cron/t2/toggle',
                expect.objectContaining({ method: 'POST' }),
            ),
        );
    });

    it('opens a task to see its next runs and error, and deletes it from there', async () => {
        renderTasks();
        fireEvent.click(await screen.findByText('Removes stale sessions'));
        const dialog = await screen.findByRole('dialog');
        expect(dialog).toHaveTextContent('boom');
        expect(dialog).toHaveTextContent('12 runs, 1 failed');
        expect(dialog.querySelectorAll('ol li')).toHaveLength(3);
        expect(dialog).toHaveTextContent('"days": 30');

        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
        await waitFor(() =>
            expect(apiClient).toHaveBeenCalledWith('/api/admin/cron/t1', expect.objectContaining({ method: 'DELETE' })),
        );
    });

    it('adds a task with a preset schedule it explains first', async () => {
        renderTasks();
        await screen.findByText('daily-cleanup');
        fireEvent.click(screen.getByRole('button', { name: 'New task' }));
        const dialog = await screen.findByRole('dialog');
        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'nightly-report' } });
        fireEvent.change(screen.getByLabelText('Handler'), { target: { value: 'digest' } });
        expect(dialog).toHaveTextContent('Sends the weekly digest');
        fireEvent.change(screen.getByLabelText('Cron expression'), { target: { value: '30 2 * * *' } });
        expect(dialog).toHaveTextContent('Every day at 02:30. First run');
        fireEvent.change(screen.getByLabelText('Cron expression'), { target: { value: 'nope' } });
        expect(dialog).toHaveTextContent('Not a valid schedule');
        fireEvent.change(screen.getByLabelText('Cron expression'), { target: { value: '30 2 * * *' } });

        fireEvent.click(screen.getByRole('button', { name: 'Save task' }));
        await waitFor(() =>
            expect(apiClient).toHaveBeenCalledWith(
                '/api/admin/cron',
                expect.objectContaining({
                    method: 'POST',
                    body: expect.objectContaining({ name: 'nightly-report', task: 'digest', schedule: '30 2 * * *' }),
                }),
            ),
        );
        await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('nightly-report scheduled'));
    });
});

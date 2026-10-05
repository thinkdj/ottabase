import { OttaQueryProvider } from '@ottabase/ottaorm/client';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiClient, toastSuccess } = vi.hoisted(() => ({ apiClient: vi.fn(), toastSuccess: vi.fn() }));
vi.mock('@ottabase/ui-shadcn', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@ottabase/ui-shadcn')>()),
    toast: { success: toastSuccess, error: vi.fn() },
}));

import { QueueJobs } from '../QueueJobs';

const now = Date.now();
const scope = { appId: 'app', organizationId: null, principalId: 'u1' };

describe('QueueJobs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiClient.mockImplementation(async (url: string, options?: { method?: string }) => {
            if (options?.method === 'POST' || options?.method === 'DELETE') return { success: true };
            if (url === '/api/admin/queues') {
                return {
                    stats: {
                        totalDispatched: 40,
                        totalProcessed: 36,
                        totalFailed: 4,
                        totalDLQ: 1,
                        byJobType: { 'send-email': { dispatched: 40, processed: 36, failed: 4 } },
                        lastUpdated: now,
                    },
                    pendingCount: 2,
                    registeredHandlers: [],
                    queueBinding: 'configured',
                };
            }
            if (url.startsWith('/api/admin/queues/dlq')) {
                return {
                    jobs: [
                        {
                            id: 'j1',
                            type: 'send-email',
                            payload: { to: 'ada@example.com' },
                            error: 'SMTP refused',
                            failedAt: now - 60_000,
                            attempts: 3,
                        },
                    ],
                    hasMore: false,
                };
            }
            if (url === '/api/admin/queues/failed') return { jobs: [] };
            if (url === '/api/admin/queues/processed') {
                return {
                    jobs: [
                        {
                            id: 'j9',
                            type: 'sync-data',
                            status: 'completed',
                            processedAt: now,
                            attempts: 1,
                            duration: 120,
                        },
                    ],
                };
            }
            throw new Error(`unexpected ${url}`);
        });
        render(
            <OttaQueryProvider apiClient={apiClient} visibilityScope={scope}>
                <QueueJobs />
            </OttaQueryProvider>,
        );
    });

    it('leads with the dead-letter queue and retries a job', async () => {
        expect(await screen.findByText('SMTP refused')).toBeInTheDocument();
        expect(screen.getByText('Queue connected. 2 messages waiting.')).toBeInTheDocument();
        expect(screen.getByText('90%')).toBeInTheDocument();
        expect(screen.getByText('120 ms')).toBeInTheDocument();
        expect(screen.getByText('No failures lately.')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        await waitFor(() =>
            expect(apiClient).toHaveBeenCalledWith(
                '/api/admin/queues/dlq/j1/retry',
                expect.objectContaining({ method: 'POST' }),
            ),
        );
        await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('send-email queued again'));
    });

    it('opens a job to read its payload and removes it after confirming', async () => {
        fireEvent.click(await screen.findByText('SMTP refused'));
        const dialog = await screen.findByRole('dialog');
        expect(dialog).toHaveTextContent('"to": "ada@example.com"');
        fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
        expect(await screen.findByText('Remove this job?')).toBeInTheDocument();
        fireEvent.click(screen.getAllByRole('button', { name: 'Remove' }).at(-1)!);
        await waitFor(() =>
            expect(apiClient).toHaveBeenCalledWith(
                '/api/admin/queues/dlq/j1',
                expect.objectContaining({ method: 'DELETE' }),
            ),
        );
    });
});

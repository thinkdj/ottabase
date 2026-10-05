import { OttaQueryProvider } from '@ottabase/ottaorm/client';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCommentThread } from '../commentHooks';

const { apiClient, toastSuccess, toastError } = vi.hoisted(() => ({
    apiClient: vi.fn(),
    toastSuccess: vi.fn(),
    toastError: vi.fn(),
}));
vi.mock('@ottabase/ui-shadcn', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@ottabase/ui-shadcn')>()),
    toast: { success: toastSuccess, error: toastError },
}));

let thread: ReturnType<typeof useCommentThread>;
function Probe() {
    thread = useCommentThread({ targetType: 'post', targetId: 'p1' });
    return <p>{thread.comments.map((c) => c.body).join(',') || 'empty'}</p>;
}

describe('useCommentThread', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        apiClient.mockImplementation(async (url: string, options?: { method?: string; body?: unknown }) => {
            if (!options?.method || options.method === 'GET') {
                return {
                    data: [{ id: 'c1', body: 'Hello', status: 'active', createdAt: 1 }],
                    total: 1,
                    page: 1,
                    perPage: 50,
                };
            }
            if (
                url.includes('/comments/c1') &&
                (options.body as { status?: string }).status === 'flagged' &&
                options.method === 'PATCH'
            ) {
                return { id: 'c1', status: 'flagged' };
            }
            return { id: 'c1' };
        });
        render(
            <OttaQueryProvider
                apiClient={apiClient}
                visibilityScope={{ appId: 'app', organizationId: null, principalId: 'me' }}
            >
                <Probe />
            </OttaQueryProvider>,
        );
    });

    it('loads every comment on the target', async () => {
        expect(await screen.findByText('Hello')).toBeInTheDocument();
        expect(apiClient).toHaveBeenCalledWith(expect.stringContaining('/comments'), expect.anything());
    });

    it('posts, reacts, reports and moderates through the comments API', async () => {
        await screen.findByText('Hello');
        await act(() => thread.post('Nice', 'c1'));
        expect(apiClient).toHaveBeenCalledWith(
            expect.stringContaining('/comments'),
            expect.objectContaining({
                method: 'POST',
                body: expect.objectContaining({ body: 'Nice', parentId: 'c1', targetType: 'post', targetId: 'p1' }),
            }),
        );

        act(() => thread.react('c1', '👍'));
        await waitFor(() =>
            expect(apiClient).toHaveBeenCalledWith(
                expect.stringContaining('/comments/c1'),
                expect.objectContaining({ method: 'PATCH', body: { _reaction: '👍' } }),
            ),
        );

        act(() => thread.report('c1'));
        await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith('Thanks, a moderator will take a look'));

        act(() => thread.moderate('c1', 'hide'));
        await waitFor(() =>
            expect(apiClient).toHaveBeenCalledWith(
                expect.stringContaining('/comments/c1'),
                expect.objectContaining({ method: 'PATCH', body: { status: 'hidden' } }),
            ),
        );
    });

    it('tells the user when a request fails and keeps the rejection for the composer', async () => {
        await screen.findByText('Hello');
        apiClient.mockRejectedValueOnce(new Error('boom'));
        await expect(thread.edit('c1', 'x')).rejects.toThrow('boom');
        await waitFor(() => expect(toastError).toHaveBeenCalledWith('Could not save the comment'));
    });
});

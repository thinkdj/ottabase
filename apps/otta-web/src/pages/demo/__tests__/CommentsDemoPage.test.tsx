/**
 * The comments demo in Database mode: a signed-out visitor comments as a guest (a name and the
 * bot check), and is told the comment waits for a moderator; a signed-in one posts as themselves.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { api, session } = vi.hoisted(() => ({
    api: vi.fn(),
    session: { user: null as { id: string } | null },
}));

vi.mock('@/lib/api', () => ({ api }));
vi.mock('@/lib/auth', () => ({ useSession: () => session }));
vi.mock('@/hooks/commentHooks', () => ({
    useComments: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
    useUpdateComment: () => ({ mutate: vi.fn() }),
}));
vi.mock('@ottabase/ui/turnstile', () => ({
    useTurnstile: () => ({
        enabled: true,
        widget: null,
        error: null,
        headers: async () => ({ 'X-Turnstile-Token': 'tok' }),
    }),
}));
vi.mock('../DemoPageHeader', () => ({ DemoPageHeader: ({ title }: { title: string }) => <h1>{title}</h1> }));

import { CommentsDemoPage } from '../comments/CommentsDemoPage';

function openDatabaseMode() {
    render(<CommentsDemoPage />);
    fireEvent.click(screen.getByRole('button', { name: /Database/ }));
    fireEvent.change(screen.getByPlaceholderText('Write a comment…'), { target: { value: 'Hello' } });
}

beforeEach(() => {
    api.mockReset();
    session.user = null;
});

describe('CommentsDemoPage, Database mode', () => {
    it("posts a signed-out visitor's comment with a name and the Turnstile header, then says it awaits approval", async () => {
        api.mockResolvedValue({ id: 'c1', status: 'pending' });
        openDatabaseMode();
        const post = screen.getByRole('button', { name: 'Post comment' });
        expect(post).toBeDisabled();

        fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ada' } });
        fireEvent.click(post);

        await waitFor(() =>
            expect(api).toHaveBeenCalledWith('/api/ottaorm/comments', {
                method: 'POST',
                body: { body: 'Hello', targetType: 'demo', targetId: 'comments-demo-page', authorName: 'Ada' },
                headers: { 'X-Turnstile-Token': 'tok' },
            }),
        );
        expect(await screen.findByText(/once a moderator approves it/)).toBeInTheDocument();
    });

    it('posts as the account when signed in, with no name field and no bot check', async () => {
        session.user = { id: 'user-1' };
        api.mockResolvedValue({ id: 'c1', status: 'active' });
        openDatabaseMode();

        expect(screen.queryByLabelText('Name')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Post comment' }));

        await waitFor(() =>
            expect(api).toHaveBeenCalledWith('/api/ottaorm/comments', {
                method: 'POST',
                body: { body: 'Hello', targetType: 'demo', targetId: 'comments-demo-page' },
                headers: {},
            }),
        );
    });
});

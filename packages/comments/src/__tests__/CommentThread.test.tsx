import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommentThread } from '../react';
import type { ThreadComment } from '../thread';

const comment = (
    id: string,
    body: string,
    opts: {
        parentId?: string | null;
        userId?: string;
        status?: string;
        reactions?: Record<string, string[]>;
        createdAt?: number;
    } = {},
): ThreadComment => {
    const userId = opts.userId ?? 'u1';
    return {
        id,
        body,
        targetType: 'post',
        targetId: 'p1',
        parentId: opts.parentId ?? null,
        userId,
        status: opts.status ?? 'active',
        depth: opts.parentId ? 1 : 0,
        appId: null,
        organizationId: null,
        createdAt: opts.createdAt ?? 1,
        updatedAt: opts.createdAt ?? 1,
        _user: { id: userId, name: userId === 'u1' ? 'Ada' : 'Bob', image: null },
        reactions: opts.reactions ?? {},
    } as ThreadComment;
};

const handlers = () => ({
    onPost: vi.fn(async () => ({})),
    onEdit: vi.fn(async () => ({})),
    onReact: vi.fn(),
    onReport: vi.fn(),
    onModerate: vi.fn(),
});

const article = (id: string) => document.querySelector(`[data-comment-id="${id}"]`) as HTMLElement;

describe('CommentThread', () => {
    it('nests replies, keeps placeholders for removed comments and notes orphans', () => {
        render(
            <CommentThread
                comments={[
                    comment('a', 'First', { createdAt: 1 }),
                    comment('b', 'Reply to first', { parentId: 'a', userId: 'u2', createdAt: 2 }),
                    comment('d', 'gone', { status: 'deleted', createdAt: 3 }),
                    comment('e', 'Reply under the deleted one', { parentId: 'd', createdAt: 4 }),
                    comment('f', 'Lost reply', { parentId: 'zzz', createdAt: 5 }),
                ]}
                currentUserId={null}
                {...handlers()}
            />,
        );
        expect(screen.getByText('4 comments')).toBeInTheDocument();
        expect(within(article('a')).getByText('Reply to first')).toBeInTheDocument();
        expect(screen.getByText('This comment was deleted.')).toBeInTheDocument();
        expect(within(article('d')).getByText('Reply under the deleted one')).toBeInTheDocument();
        expect(within(article('f')).getByText('in reply to a comment that is no longer here')).toBeInTheDocument();
    });

    it('readers get the sign in prompt instead of a composer', () => {
        render(
            <CommentThread
                comments={[]}
                currentUserId={null}
                signInPrompt={<p>Sign in to comment</p>}
                {...handlers()}
            />,
        );
        expect(screen.getByText('Sign in to comment')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Post comment' })).not.toBeInTheDocument();
        expect(screen.getByText('No comments yet. Start the conversation.')).toBeInTheDocument();
    });

    it('posts a reply under its parent and clears the draft', async () => {
        const h = handlers();
        render(<CommentThread comments={[comment('a', 'First')]} currentUserId="u1" {...h} />);
        fireEvent.click(within(article('a')).getByRole('button', { name: 'Reply' }));
        const box = within(article('a')).getByLabelText('Reply to Ada');
        fireEvent.change(box, { target: { value: 'Thanks!' } });
        fireEvent.click(within(article('a')).getByRole('button', { name: 'Post reply' }));
        expect(h.onPost).toHaveBeenCalledWith('Thanks!', 'a');
        expect(await within(article('a')).findByRole('button', { name: 'Reply' })).toBeInTheDocument();
    });

    it('toggles reactions and offers the rest from the picker', () => {
        const h = handlers();
        render(
            <CommentThread
                comments={[comment('a', 'First', { reactions: { '👍': ['u2'] } })]}
                currentUserId="u1"
                {...h}
            />,
        );
        fireEvent.click(screen.getByRole('button', { name: '👍 1' }));
        expect(h.onReact).toHaveBeenCalledWith('a', '👍');
        fireEvent.click(screen.getByRole('button', { name: 'Add reaction' }));
        fireEvent.click(screen.getByRole('button', { name: 'React with ❤️' }));
        expect(h.onReact).toHaveBeenCalledWith('a', '❤️');
    });

    it('lets authors edit, others report, and moderators hide', async () => {
        const h = handlers();
        const { rerender } = render(
            <CommentThread
                comments={[comment('a', 'Mine'), comment('b', 'Theirs', { userId: 'u2' })]}
                currentUserId="u1"
                {...h}
            />,
        );
        expect(within(article('a')).queryByRole('button', { name: 'Report' })).not.toBeInTheDocument();
        fireEvent.click(within(article('a')).getByRole('button', { name: 'Edit' }));
        fireEvent.change(within(article('a')).getByLabelText('Save'), { target: { value: 'Mine, edited' } });
        fireEvent.click(within(article('a')).getByRole('button', { name: 'Save' }));
        expect(h.onEdit).toHaveBeenCalledWith('a', 'Mine, edited');

        fireEvent.click(within(article('b')).getByRole('button', { name: 'Report' }));
        expect(h.onReport).toHaveBeenCalledWith('b');
        expect(within(article('b')).queryByRole('button', { name: 'Hide' })).not.toBeInTheDocument();

        rerender(
            <CommentThread
                comments={[
                    comment('a', 'Mine'),
                    comment('b', 'Theirs', { userId: 'u2' }),
                    comment('c', 'Secret', { userId: 'u2', status: 'hidden' }),
                ]}
                currentUserId="u1"
                canModerate
                {...h}
            />,
        );
        fireEvent.click(within(article('b')).getByRole('button', { name: 'Hide' }));
        expect(h.onModerate).toHaveBeenCalledWith('b', 'hide');
        expect(within(article('c')).getByText('Secret')).toBeInTheDocument();
        expect(within(article('c')).getByText('Hidden')).toBeInTheDocument();
    });

    it('asks before deleting', () => {
        const h = handlers();
        render(<CommentThread comments={[comment('a', 'Mine')]} currentUserId="u1" {...h} />);
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
        expect(h.onModerate).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
        expect(h.onModerate).toHaveBeenCalledWith('a', 'delete');
    });
});

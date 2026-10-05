import { isApiError } from '@ottabase/api';
import type { CommentModeration } from '@ottabase/comments/react';
import { type ThreadComment } from '@ottabase/comments';
import { createModelHooks } from '@ottabase/ottaorm/client';
import { toast } from '@ottabase/ui-shadcn';
import { useMemo } from 'react';

export type CommentType = ThreadComment;

export const {
    useList: useComments,
    useDetail: useComment,
    useCreate: useCreateComment,
    useUpdate: useUpdateComment,
    useDelete: useDeleteComment,
    useInfiniteList: useCommentsInfinite,
} = createModelHooks<CommentType>({ entityName: 'comments' });

const STATUS_FOR: Record<CommentModeration, string> = { hide: 'hidden', restore: 'active', delete: 'deleted' };

/**
 * Everything a `CommentThread` needs for one target: the comments (every status, so replies
 * keep their place under removed parents) and the callbacks, each wired to the OttaORM
 * comments API with its own error toast.
 */
export function useCommentThread({
    targetType,
    targetId,
    enabled = true,
}: {
    targetType: string;
    targetId: string | null;
    enabled?: boolean;
}) {
    const query = useComments(
        targetId ? { where: { targetType, targetId }, orderBy: 'createdAt', orderDirection: 'asc' } : undefined,
        { enabled: enabled && !!targetId },
    );
    const create = useCreateComment();
    const update = useUpdateComment();

    const comments = useMemo<CommentType[]>(() => {
        if (Array.isArray(query.data)) return query.data;
        return (query.data as { data?: CommentType[] } | undefined)?.data ?? [];
    }, [query.data]);

    const report = (err: unknown, fallback: string) => {
        toast.error(isApiError(err) ? err.message : fallback);
        throw err;
    };
    const patch = (id: string, data: Record<string, unknown>, fallback: string) =>
        update.mutateAsync({ id, data }).catch((err) => report(err, fallback));

    return {
        comments,
        isLoading: query.isLoading,
        error: query.error?.message ?? null,
        busy: create.isPending || update.isPending,
        refetch: query.refetch,
        post: (body: string, parentId: string | null) =>
            create
                .mutateAsync({ body, targetType, targetId: targetId as string, parentId })
                .catch((err) => report(err, 'Could not post the comment')),
        edit: (id: string, body: string) => patch(id, { body }, 'Could not save the comment'),
        react: (id: string, emoji: string) =>
            void patch(id, { _reaction: emoji }, 'Could not add the reaction').catch(() => {}),
        report: (id: string) =>
            void patch(id, { status: 'flagged' }, 'Could not report the comment')
                .then(() => toast.success('Thanks, a moderator will take a look'))
                .catch(() => {}),
        moderate: (id: string, action: CommentModeration) =>
            void patch(id, { status: STATUS_FOR[action] }, 'Could not update the comment').catch(() => {}),
    };
}

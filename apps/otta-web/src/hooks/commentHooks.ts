import { type CommentRecord, type ReactionsMap } from '@ottabase/comments';
import { createModelHooks } from '@ottabase/ottaorm/client';

/** Lightweight author info attached by the server when fetching comments */
export interface CommentUser {
    id: string;
    name: string | null;
    image: string | null;
    createdAt: number;
}

/**
 * Comment record enriched by GET responses with author and aggregated reaction data. `authorName`
 * is set on an anonymous (guest) comment only; `authorEmail` is hidden by the model, never returned.
 */
export type CommentType = Omit<CommentRecord, 'authorName' | 'authorEmail'> & {
    authorName?: string | null;
    _user?: CommentUser | null;
    reactions?: ReactionsMap;
};

export const {
    useList: useComments,
    useDetail: useComment,
    useCreate: useCreateComment,
    useUpdate: useUpdateComment,
    useDelete: useDeleteComment,
    useInfiniteList: useCommentsInfinite,
} = createModelHooks<CommentType>({ entityName: 'comments' });

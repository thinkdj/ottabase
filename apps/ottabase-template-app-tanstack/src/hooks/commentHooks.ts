import { type CommentRecord } from '@ottabase/comments';
import { createModelHooks } from '@ottabase/ottaorm/client';

/** Lightweight author info attached by the server when fetching comments */
export interface CommentUser {
    id: string;
    name: string | null;
    image: string | null;
    createdAt: number;
}

/** Comment record enriched with `_user` author data from the server */
export type CommentType = CommentRecord & { _user?: CommentUser | null };

export const {
    useList: useComments,
    useDetail: useComment,
    useCreate: useCreateComment,
    useUpdate: useUpdateComment,
    useDelete: useDeleteComment,
    useInfiniteList: useCommentsInfinite,
} = createModelHooks<CommentType>({ entityName: 'comments' });

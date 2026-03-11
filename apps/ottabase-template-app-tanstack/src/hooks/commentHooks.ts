import { type CommentRecord } from '@ottabase/comments';
import { createModelHooks } from '@ottabase/ottaorm/client';

/** Type for comment records returned from the API */
export type CommentType = CommentRecord;

export const {
    useList: useComments,
    useDetail: useComment,
    useCreate: useCreateComment,
    useUpdate: useUpdateComment,
    useDelete: useDeleteComment,
    useInfiniteList: useCommentsInfinite,
} = createModelHooks<CommentType>({ entityName: 'comments' });

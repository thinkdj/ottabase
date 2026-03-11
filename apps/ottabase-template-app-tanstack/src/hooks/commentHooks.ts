import { createModelHooks } from '@ottabase/ottaorm/client';

/** Type for comment records returned from the API */
export interface CommentType {
    id: string;
    body: string;
    targetType: string;
    targetId: string;
    parentId: string | null;
    userId: string | null;
    status: string;
    reactions: Record<string, string[]> | null;
    depth: number;
    appId: string | null;
    organizationId: string | null;
    createdAt: number;
    updatedAt: number;
}

export const {
    useList: useComments,
    useDetail: useComment,
    useCreate: useCreateComment,
    useUpdate: useUpdateComment,
    useDelete: useDeleteComment,
    useInfiniteList: useCommentsInfinite,
} = createModelHooks<CommentType>({ entityName: 'comments' });

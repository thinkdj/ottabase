/** Status values for comments */
export type CommentStatus = 'active' | 'deleted' | 'flagged' | 'hidden';

/** Available emoji reactions (extensible — any string key works) */
export const DEFAULT_REACTIONS = ['👍', '👎', '❤️', '😂', '😮', '😢'] as const;
export type DefaultReaction = (typeof DEFAULT_REACTIONS)[number];

/** Shape of the reactions JSON field */
export type ReactionsMap = Record<string, string[]>;

/** Parameters for creating a comment */
export interface CreateCommentParams {
    body: string;
    targetType: string;
    targetId: string;
    parentId?: string | null;
    userId?: string | null;
}

/** Parameters for listing comments on a target */
export interface ListCommentsParams {
    targetType: string;
    targetId: string;
    status?: CommentStatus;
    parentId?: string | null;
    page?: number;
    limit?: number;
}

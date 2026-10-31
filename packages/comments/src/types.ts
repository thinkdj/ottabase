/** Status values for comments. `pending` waits for a moderator before it is shown. */
export type CommentStatus = 'active' | 'pending' | 'deleted' | 'flagged' | 'hidden';

/** Statuses kept out of public reads: a comment list returns them to moderators only. */
export const UNPUBLISHED_COMMENT_STATUSES = ['pending', 'hidden'] as const satisfies readonly CommentStatus[];

/** The longest display name an anonymous commenter may give. */
export const COMMENT_AUTHOR_NAME_MAX_LENGTH = 80;

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
    /** Required when there is no `userId`. */
    authorName?: string | null;
    authorEmail?: string | null;
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

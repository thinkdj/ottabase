// Model + table
export { Comment, commentsTable } from './ottaorm-models/Comment';
export type { CommentRecord, NewCommentRecord, ReactionsMap } from './ottaorm-models/Comment';
export { CommentReaction, commentReactionsTable } from './ottaorm-models/CommentReaction';
export type { CommentReactionRecord, NewCommentReactionRecord } from './ottaorm-models/CommentReaction';

// Types
export { COMMENT_AUTHOR_NAME_MAX_LENGTH, DEFAULT_REACTIONS, UNPUBLISHED_COMMENT_STATUSES } from './types';
export type { CommentStatus, CreateCommentParams, DefaultReaction, ListCommentsParams } from './types';
export { COMMENTS_PACKAGE_KEY, commentsPolicies, createCommentsPackage, type CommentsPackageOptions } from './manifest';

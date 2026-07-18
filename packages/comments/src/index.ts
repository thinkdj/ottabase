// Model + table
export { Comment, commentsTable } from './ottaorm-models/Comment';
export type { CommentRecord, NewCommentRecord, ReactionsMap } from './ottaorm-models/Comment';
export { CommentReaction, commentReactionsTable } from './ottaorm-models/CommentReaction';
export type { CommentReactionRecord, NewCommentReactionRecord } from './ottaorm-models/CommentReaction';

// Types
export { DEFAULT_REACTIONS } from './types';
export type { CommentStatus, CreateCommentParams, DefaultReaction, ListCommentsParams } from './types';

// Model + table
export { Comment, commentsTable } from './ottaorm-models/Comment';
export type { CommentRecord, NewCommentRecord, ReactionsMap } from './ottaorm-models/Comment';
export { CommentReaction, commentReactionsTable } from './ottaorm-models/CommentReaction';
export type { CommentReactionRecord, NewCommentReactionRecord } from './ottaorm-models/CommentReaction';

// Thread shape for clients (pure)
export { buildCommentTree, countVisible, isRemoved } from './thread';
export type { CommentAuthor, CommentTree, ThreadComment } from './thread';

// Types
export { DEFAULT_REACTIONS } from './types';
export type { CommentStatus, CreateCommentParams, DefaultReaction, ListCommentsParams } from './types';

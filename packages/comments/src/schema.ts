// Schema re-export — source of truth is in the model schema modules.
export { commentsTable } from './ottaorm-models/Comment';
export type { CommentRecord, NewCommentRecord, ReactionsMap } from './ottaorm-models/Comment';
export { commentReactionsTable } from './ottaorm-models/CommentReaction.schema';
export type { CommentReactionRecord, NewCommentReactionRecord } from './ottaorm-models/CommentReaction.schema';

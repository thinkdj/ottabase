import { definePackage, type OttaPackage, type PackageExtras } from '@ottabase/kernel';
import { Comment, commentsTable } from './ottaorm-models/Comment';
import { CommentReaction, commentReactionsTable } from './ottaorm-models/CommentReaction';

export const COMMENTS_PACKAGE_KEY = 'comments';

export type CommentsPackageOptions<Env> = PackageExtras<Env>;

/** The comments package as the app registers it. Its API is the generic OttaORM CRUD route. */
export function createCommentsPackage<Env = unknown>(options: CommentsPackageOptions<Env> = {}): OttaPackage<Env> {
    return definePackage<Env>({
        key: COMMENTS_PACKAGE_KEY,
        name: 'Comments',
        version: '1.0.0',
        description: 'Threaded comments on any entity, with reactions and moderation.',
        tables: { commentsTable, commentReactionsTable },
        models: [Comment, CommentReaction],
        ...options,
    });
}

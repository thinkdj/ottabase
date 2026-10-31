import { definePackage, type OttaPackage, type PackageExtras } from '@ottabase/kernel';
import { RLSPolicies, type ModelRLSConfig } from '@ottabase/ottaorm';
import { Comment, commentsTable } from './ottaorm-models/Comment';
import { CommentReaction, commentReactionsTable } from './ottaorm-models/CommentReaction';

export const COMMENTS_PACKAGE_KEY = 'comments';

export type CommentsPackageOptions<Env> = PackageExtras<Env>;

/**
 * Comments live in their target's tenant. A platform blog post has no organization, so its
 * comments have none either: the policy allows a null tenant, and the host derives the context's
 * organization from the target row (never from the caller), so a null context reads only
 * platform-owned comments.
 */
export function commentsPolicies(): ModelRLSConfig[] {
    return [{ model: 'comments', policy: RLSPolicies.TenantScoped(true), auditEnabled: true }];
}

/** The comments package as the app registers it. Its API is the generic OttaORM CRUD route. */
export function createCommentsPackage<Env = unknown>(options: CommentsPackageOptions<Env> = {}): OttaPackage<Env> {
    return definePackage<Env>({
        key: COMMENTS_PACKAGE_KEY,
        name: 'Comments',
        version: '1.0.0',
        description: 'Threaded comments on any entity, with reactions and moderation.',
        tables: { commentsTable, commentReactionsTable },
        models: [Comment, CommentReaction],
        policies: commentsPolicies(),
        // The moderation queue; the host renders it (otta-web: src/pages/admin/content/comments).
        nav: [
            {
                title: 'Comments',
                description: 'Approve guest comments waiting for review, and restore hidden ones.',
                href: '/admin/content/comments',
                icon: 'MessageSquare',
                scope: 'org',
                group: 'content',
            },
        ],
        ...options,
    });
}

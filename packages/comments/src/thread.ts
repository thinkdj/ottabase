// Turning the flat list from the API into something a UI can walk. Pure, no React.

import type { CommentRecord, ReactionsMap } from './ottaorm-models/Comment';

/** Lightweight author info the server attaches to GET responses */
export interface CommentAuthor {
    id: string;
    name: string | null;
    image: string | null;
    createdAt?: number;
}

/** A comment as the client sees it: the row plus author and aggregated reactions */
export type ThreadComment = CommentRecord & {
    _user?: CommentAuthor | null;
    reactions?: ReactionsMap;
};

export interface CommentTree {
    /** Top level comments in posting order, plus replies whose parent is not in the list */
    roots: ThreadComment[];
    /** Replies by parent id, in posting order */
    childrenOf: Map<string, ThreadComment[]>;
    /** Ids of replies shown at the root because their parent is missing */
    orphans: Set<string>;
}

const toMs = (value: unknown): number =>
    typeof value === 'number' ? value : value ? new Date(value as string | Date).getTime() : 0;

/** Deleted and hidden comments stay in the thread as placeholders so replies keep their place. */
export const isRemoved = (comment: Pick<ThreadComment, 'status'>): boolean =>
    comment.status === 'deleted' || comment.status === 'hidden';

/**
 * Build the tree. A reply whose parent is not in the list is not dropped: it becomes a root
 * and is listed in `orphans`, so the UI can say it answers a comment that is no longer here.
 */
export function buildCommentTree(comments: ThreadComment[]): CommentTree {
    const ids = new Set(comments.map((c) => c.id));
    const sorted = [...comments].sort((a, b) => toMs(a.createdAt) - toMs(b.createdAt));
    const roots: ThreadComment[] = [];
    const childrenOf = new Map<string, ThreadComment[]>();
    const orphans = new Set<string>();
    for (const comment of sorted) {
        const parentId = comment.parentId ?? null;
        if (parentId && ids.has(parentId)) {
            const list = childrenOf.get(parentId) ?? [];
            list.push(comment);
            childrenOf.set(parentId, list);
        } else {
            roots.push(comment);
            if (parentId) orphans.add(comment.id);
        }
    }
    return { roots, childrenOf, orphans };
}

/** How many comments people can actually read */
export const countVisible = (comments: Pick<ThreadComment, 'status'>[]): number =>
    comments.filter((c) => !isRemoved(c)).length;

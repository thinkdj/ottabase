/**
 * Lock keys: how a post records the locked (invite-only) categories it is filed under, so readers
 * are filtered in SQL. Pure: no models, safe at the edge and in the browser.
 *
 * A post's `lockKey` is `|id|id|` (its effectively locked categories, sorted), or null when it is
 * in none. A reader may open it when none of those categories is forbidden to them.
 */

/** Who is reading a blog, as the host resolves them. */
export interface BlogViewer {
    /** The signed-in user, or null. */
    userId: string | null;
    /** The blog's staff: they read every locked post (otta-web: `posts:read_locked` in the blog's scope). */
    readsAllLocked: boolean;
}

export const ANONYMOUS_VIEWER: BlogViewer = { userId: null, readsAllLocked: false };

/** What one reader may open of a blog's locked categories. */
export interface LockAccess {
    /** Effectively locked categories of the blog (a lock covers child categories). */
    locked: Set<string>;
    /** The locked categories this reader may not open. Empty: they read everything. */
    forbidden: Set<string>;
}

export const NOTHING_LOCKED: LockAccess = { locked: new Set(), forbidden: new Set() };

/**
 * Most forbidden categories filtered one by one (one `NOT LIKE` binding each, within D1's
 * statement budget). Past it, every locked post is hidden from that reader: closed, never open.
 */
export const MAX_FORBIDDEN_FILTERS = 24;

/** The lock key for these locked category ids. */
export function formatLockKey(categoryIds: Iterable<string>): string | null {
    const ids = [...new Set(categoryIds)].sort();
    return ids.length > 0 ? `|${ids.join('|')}|` : null;
}

/** The category ids in a lock key. */
export function lockKeyIds(lockKey: string | null | undefined): string[] {
    return lockKey ? lockKey.split('|').filter(Boolean) : [];
}

/** May this reader open a post with this lock key? */
export function canReadLockKey(lockKey: string | null | undefined, forbidden: Set<string>): boolean {
    return forbidden.size === 0 || !lockKeyIds(lockKey).some((id) => forbidden.has(id));
}

/**
 * Where-clause for the posts a reader may open: not locked, or locked only by categories they may
 * open. Category ids are UUIDs, so they carry no LIKE wildcards.
 */
export function readableWhere(access: LockAccess): Record<string, unknown> {
    if (access.forbidden.size === 0) return {};
    if (access.forbidden.size === access.locked.size || access.forbidden.size > MAX_FORBIDDEN_FILTERS) {
        return { lockKey: null };
    }
    return {
        $or: [{ lockKey: null }, { $and: [...access.forbidden].map((id) => ({ lockKey: { $notLike: `%|${id}|%` } })) }],
    };
}

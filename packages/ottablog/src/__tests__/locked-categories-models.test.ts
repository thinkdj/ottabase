/**
 * Locked categories at the model layer: inherited locks, the teaser policy, the denormalized
 * `posts.lockKey` every link and category write keeps in sync, and audiences, which open locked
 * categories to their members.
 */
import { BaseModel } from '@ottabase/ottaorm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canReadLockKey, formatLockKey, lockKeyIds, MAX_FORBIDDEN_FILTERS, readableWhere } from '../lock-key';
import {
    OttablogAudience,
    OttablogAudienceMember,
    ottablogAudienceMembersTable,
    OttablogCategoryAudience,
    ottablogCategoryAudiencesTable,
    Post,
    PostCategory,
    PostCategoryLink,
} from '../ottaorm-models';
import { normalizeLockedTeaser } from '../types';

const row = (json: Record<string, unknown>) => ({ get: (field: string) => json[field] });

afterEach(() => vi.restoreAllMocks());

describe('PostCategory.effectiveLockedIds', () => {
    it('locks a category and every descendant, and nothing else', () => {
        const locked = PostCategory.effectiveLockedIds([
            { id: 'life', parentId: null, isLocked: true },
            { id: 'family', parentId: 'life', isLocked: false },
            { id: 'kids', parentId: 'family', isLocked: false },
            { id: 'travel', parentId: null, isLocked: false },
        ]);
        expect([...locked].sort()).toEqual(['family', 'kids', 'life']);
    });

    it('survives a parent cycle and a missing parent', () => {
        const locked = PostCategory.effectiveLockedIds([
            { id: 'a', parentId: 'b', isLocked: false },
            { id: 'b', parentId: 'a', isLocked: false },
            { id: 'orphan', parentId: 'deleted', isLocked: false },
        ]);
        expect(locked.size).toBe(0);
    });
});

describe('normalizeLockedTeaser', () => {
    it('keeps known fields in a stable order and requires the title', () => {
        expect(normalizeLockedTeaser(['heroImage', 'title', 'nope', 'excerpt'])).toEqual([
            'title',
            'excerpt',
            'heroImage',
        ]);
        expect(normalizeLockedTeaser(['excerpt', 'heroImage'])).toEqual([]);
        expect(normalizeLockedTeaser(null)).toEqual([]);
    });
});

describe('Post.lockKeysOf / syncLocked', () => {
    function fakeDb() {
        const writes: Array<{ lockKey: unknown }> = [];
        const db = {
            update: () => ({
                set: (values: { lockKey: unknown }) => ({
                    where: async () => {
                        writes.push(values);
                    },
                }),
            }),
        };
        vi.spyOn(Post as any, 'getDriver').mockReturnValue({ getDb: () => db });
        return writes;
    }

    it('keys each post by its locked categories, walking up to a locked parent', async () => {
        vi.spyOn(PostCategoryLink, 'where').mockResolvedValue([
            row({ postId: 'p1', categoryId: 'family' }),
            row({ postId: 'p1', categoryId: 'diary' }),
            row({ postId: 'p2', categoryId: 'travel' }),
        ] as any);
        const categoryWhere = vi
            .spyOn(PostCategory, 'where')
            .mockResolvedValueOnce([
                row({ id: 'family', parentId: 'life', isLocked: false }),
                row({ id: 'diary', parentId: null, isLocked: true }),
                row({ id: 'travel', parentId: null, isLocked: false }),
            ] as any)
            .mockResolvedValueOnce([row({ id: 'life', parentId: null, isLocked: true })] as any);

        // Sorted, so one set of categories always has one key.
        expect([...(await Post.lockKeysOf(['p1', 'p2']))]).toEqual([['p1', '|diary|family|']]);
        expect(categoryWhere).toHaveBeenCalledTimes(2);
    });

    it('writes one statement per key, both directions, and keeps updatedAt (the lock is not an edit)', async () => {
        vi.spyOn(Post, 'lockKeysOf').mockResolvedValue(new Map([['p1', '|life|']]));
        const writes = fakeDb();

        await Post.syncLocked(['p1', 'p2', 'p1']);

        expect(writes.map((write) => write.lockKey)).toEqual(['|life|', null]);
        for (const write of writes) expect(write).toHaveProperty('updatedAt');
    });
});

describe('PostCategory.lockAccessFor', () => {
    const blog = { appId: 'app', organizationId: null };
    const categories = [
        row({ id: 'life', parentId: null, isLocked: true }),
        row({ id: 'kids', parentId: 'life', isLocked: false }),
        row({ id: 'work', parentId: null, isLocked: true }),
        row({ id: 'travel', parentId: null, isLocked: false }),
    ];
    const reader = { userId: 'u1', readsAllLocked: false };

    it('costs one query and never resolves the reader when nothing is locked', async () => {
        vi.spyOn(PostCategory, 'where').mockResolvedValue([
            row({ id: 'travel', parentId: null, isLocked: false }),
        ] as any);
        const resolve = vi.fn();

        expect(await PostCategory.lockAccessFor(blog, resolve)).toEqual({ locked: new Set(), forbidden: new Set() });
        expect(resolve).not.toHaveBeenCalled();
    });

    it("closes every locked category to a signed-out reader and none to the blog's staff", async () => {
        vi.spyOn(PostCategory, 'where').mockResolvedValue(categories as any);

        const signedOut = await PostCategory.lockAccessFor(blog, { userId: null, readsAllLocked: false });
        expect([...signedOut.forbidden].sort()).toEqual(['kids', 'life', 'work']);
        const staff = await PostCategory.lockAccessFor(blog, { userId: 'u1', readsAllLocked: true });
        expect(staff.forbidden.size).toBe(0);
    });

    it("opens what the reader's audiences are given, and its subcategories", async () => {
        vi.spyOn(PostCategory, 'where').mockResolvedValue(categories as any);
        vi.spyOn(OttablogCategoryAudience, 'where').mockResolvedValue([
            row({ categoryId: 'life', audienceId: 'family' }),
            row({ categoryId: 'work', audienceId: 'colleagues' }),
        ] as any);
        const members = vi
            .spyOn(OttablogAudienceMember, 'where')
            .mockResolvedValue([row({ audienceId: 'family' })] as any);

        const access = await PostCategory.lockAccessFor(blog, reader);

        expect([...access.forbidden]).toEqual(['work']);
        expect(members).toHaveBeenCalledWith(
            { userId: 'u1', audienceId: ['family', 'colleagues'] },
            { select: ['audienceId'] },
        );
    });
});

describe('lock keys', () => {
    const access = { locked: new Set(['life', 'kids', 'work']), forbidden: new Set(['work']) };

    it('formats sorted, distinct keys, and none for no categories', () => {
        expect(formatLockKey(['work', 'life', 'work'])).toBe('|life|work|');
        expect(formatLockKey([])).toBeNull();
        expect(lockKeyIds('|life|work|')).toEqual(['life', 'work']);
    });

    it('opens a post only when none of its locked categories is forbidden', () => {
        expect(canReadLockKey('|life|kids|', access.forbidden)).toBe(true);
        expect(canReadLockKey('|life|work|', access.forbidden)).toBe(false);
        expect(canReadLockKey(null, access.forbidden)).toBe(true);
    });

    it('filters in SQL: unlocked posts, or no forbidden category in the key', () => {
        expect(readableWhere({ ...access, forbidden: new Set() })).toEqual({});
        expect(readableWhere(access)).toEqual({
            $or: [{ lockKey: null }, { $and: [{ lockKey: { $notLike: '%|work|%' } }] }],
        });
        // Everything forbidden, or more than the statement budget allows: only unlocked posts.
        expect(readableWhere({ ...access, forbidden: access.locked })).toEqual({ lockKey: null });
        const many = new Set(Array.from({ length: MAX_FORBIDDEN_FILTERS + 1 }, (_, i) => `c${i}`));
        expect(readableWhere({ locked: new Set([...many, 'open']), forbidden: many })).toEqual({ lockKey: null });
    });
});

describe('OttablogAudience', () => {
    it('names an audience in 1 to 60 characters', () => {
        expect(OttablogAudience.normalizeName('  Family ')).toBe('Family');
        expect(() => OttablogAudience.normalizeName('  ')).toThrow(/1 to 60/);
        expect(() => OttablogAudience.normalizeName('x'.repeat(61))).toThrow(/1 to 60/);
    });

    it('reports a taken name as a validation error, not a 500', async () => {
        vi.spyOn(BaseModel, 'create').mockRejectedValue(new Error('UNIQUE constraint failed'));

        await expect(
            OttablogAudience.createInBlog({ appId: 'app', organizationId: null }, 'Family'),
        ).rejects.toMatchObject({ code: 'AUDIENCE_EXISTS' });
    });

    it('takes its members and category grants with it', async () => {
        const deleted: unknown[] = [];
        const db = { delete: (table: unknown) => ({ where: async () => deleted.push(table) }) };
        vi.spyOn(OttablogAudience as any, 'getDriver').mockReturnValue({ getDb: () => db });
        vi.spyOn(BaseModel, 'delete').mockResolvedValue(true);

        expect(await OttablogAudience.delete('family')).toBe(true);
        expect(deleted).toEqual([ottablogAudienceMembersTable, ottablogCategoryAudiencesTable]);
    });

    it('gives a category exactly the wanted audiences', async () => {
        vi.spyOn(OttablogCategoryAudience, 'where').mockResolvedValue([
            row({ id: 'g1', audienceId: 'family' }),
            row({ id: 'g2', audienceId: 'friends' }),
        ] as any);
        const removed = vi.spyOn(OttablogCategoryAudience, 'delete').mockResolvedValue(true);
        const added = vi.spyOn(OttablogCategoryAudience, 'create').mockResolvedValue({} as any);

        await OttablogCategoryAudience.setForCategory('life', ['family', 'colleagues']);

        expect(removed).toHaveBeenCalledWith('g2');
        expect(added).toHaveBeenCalledWith({ categoryId: 'life', audienceId: 'colleagues' });
        expect(added).toHaveBeenCalledTimes(1);
    });
});

describe('sync hooks', () => {
    it('re-syncs a post filed under a locked category, and skips unlocked ones', async () => {
        const created = row({ postId: 'p1', categoryId: 'life' });
        vi.spyOn(BaseModel, 'create').mockResolvedValue(created as any);
        const sync = vi.spyOn(Post, 'syncLocked').mockResolvedValue();

        vi.spyOn(PostCategory, 'lockedAmong').mockResolvedValueOnce(new Set(['life']));
        await PostCategoryLink.create({ postId: 'p1', categoryId: 'life' });
        expect(sync).toHaveBeenCalledWith(['p1']);

        sync.mockClear();
        vi.spyOn(PostCategory, 'lockedAmong').mockResolvedValueOnce(new Set());
        await PostCategoryLink.create({ postId: 'p1', categoryId: 'travel' });
        expect(sync).not.toHaveBeenCalled();
    });

    it('re-syncs a post when one of its category links is removed', async () => {
        vi.spyOn(PostCategoryLink, 'find').mockResolvedValue(row({ postId: 'p1', categoryId: 'life' }) as any);
        vi.spyOn(BaseModel, 'delete').mockResolvedValue(true);
        const sync = vi.spyOn(Post, 'syncLocked').mockResolvedValue();

        await PostCategoryLink.delete('link-1');

        expect(sync).toHaveBeenCalledWith(['p1']);
    });

    it('re-syncs a category subtree only when its lock or parent actually changes', async () => {
        vi.spyOn(BaseModel, 'update').mockImplementation(async (_id, data) => row({ isLocked: false, ...data }) as any);
        const subtree = vi.spyOn(PostCategory, 'syncSubtreePosts').mockResolvedValue();
        const current = { id: 'life', isLocked: false, parentId: null };

        await PostCategory.update('life', { name: 'Life' }, undefined, current);
        await PostCategory.update('life', { isLocked: false, parentId: null }, undefined, current);
        expect(subtree).not.toHaveBeenCalled();

        await PostCategory.update('life', { isLocked: true }, undefined, current);
        expect(subtree).toHaveBeenCalledWith('life');
    });
});

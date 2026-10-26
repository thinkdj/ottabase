/**
 * Locked categories at the model layer: inherited locks, the teaser policy, and the denormalized
 * `posts.isLocked` flag that every link and category write keeps in sync.
 */
import { BaseModel } from '@ottabase/ottaorm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Post, PostCategory, PostCategoryLink } from '../ottaorm-models';
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

describe('Post.lockedAmong / syncLocked', () => {
    function fakeDb() {
        const writes: Array<{ isLocked: unknown }> = [];
        const db = {
            update: () => ({
                set: (values: { isLocked: unknown }) => ({
                    where: async () => {
                        writes.push(values);
                    },
                }),
            }),
        };
        vi.spyOn(Post as any, 'getDriver').mockReturnValue({ getDb: () => db });
        return writes;
    }

    it('derives the lock from category links, walking up to a locked parent', async () => {
        vi.spyOn(PostCategoryLink, 'where').mockResolvedValue([
            row({ postId: 'p1', categoryId: 'family' }),
            row({ postId: 'p2', categoryId: 'travel' }),
        ] as any);
        const categoryWhere = vi
            .spyOn(PostCategory, 'where')
            .mockResolvedValueOnce([
                row({ id: 'family', parentId: 'life', isLocked: false }),
                row({ id: 'travel', parentId: null, isLocked: false }),
            ] as any)
            .mockResolvedValueOnce([row({ id: 'life', parentId: null, isLocked: true })] as any);

        expect([...(await Post.lockedAmong(['p1', 'p2']))]).toEqual(['p1']);
        expect(categoryWhere).toHaveBeenCalledTimes(2);
    });

    it('writes both directions and keeps updatedAt (the lock is not an edit)', async () => {
        vi.spyOn(Post, 'lockedAmong').mockResolvedValue(new Set(['p1']));
        const writes = fakeDb();

        await Post.syncLocked(['p1', 'p2', 'p1']);

        expect(writes.map((write) => write.isLocked)).toEqual([true, false]);
        for (const write of writes) expect(write).toHaveProperty('updatedAt');
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

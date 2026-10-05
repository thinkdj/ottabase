import { describe, expect, it } from 'vitest';
import { buildCommentTree, countVisible, isRemoved, type ThreadComment } from '../thread';

const comment = (id: string, createdAt: number, parentId: string | null = null, status = 'active'): ThreadComment =>
    ({
        id,
        body: id,
        targetType: 'post',
        targetId: 'p1',
        parentId,
        userId: 'u1',
        status,
        depth: parentId ? 1 : 0,
        appId: null,
        organizationId: null,
        createdAt,
        updatedAt: createdAt,
    }) as ThreadComment;

describe('buildCommentTree', () => {
    it('nests replies under their parent in posting order', () => {
        const tree = buildCommentTree([comment('b', 2), comment('a', 1), comment('a2', 4, 'a'), comment('a1', 3, 'a')]);
        expect(tree.roots.map((c) => c.id)).toEqual(['a', 'b']);
        expect(tree.childrenOf.get('a')?.map((c) => c.id)).toEqual(['a1', 'a2']);
        expect(tree.orphans.size).toBe(0);
    });

    it('keeps a reply whose parent is gone, at the root, and says so', () => {
        const tree = buildCommentTree([comment('x', 1), comment('lost', 2, 'missing')]);
        expect(tree.roots.map((c) => c.id)).toEqual(['x', 'lost']);
        expect(tree.orphans.has('lost')).toBe(true);
    });

    it('reads ISO timestamps too', () => {
        const late = { ...comment('late', 0), createdAt: '2026-05-02T00:00:00Z' as unknown as number };
        const early = { ...comment('early', 0), createdAt: '2026-05-01T00:00:00Z' as unknown as number };
        expect(buildCommentTree([late, early]).roots.map((c) => c.id)).toEqual(['early', 'late']);
    });

    it('counts only what people can read', () => {
        const list = [
            comment('a', 1),
            comment('b', 2, null, 'deleted'),
            comment('c', 3, null, 'hidden'),
            comment('d', 4, null, 'flagged'),
        ];
        expect(countVisible(list)).toBe(2);
        expect(isRemoved(list[1])).toBe(true);
        expect(isRemoved(list[3])).toBe(false);
    });
});

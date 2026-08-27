import { describe, expect, it, vi } from 'vitest';
import type { CommentRecord, CommentStatus, NewCommentRecord, ReactionsMap } from '../index';
import { Comment, CommentReaction, commentReactionsTable, commentsTable, DEFAULT_REACTIONS } from '../index';
import { commentReactionsTable as schemaCommentReactionsTable, commentsTable as schemaCommentsTable } from '../schema';

describe('@ottabase/comments', () => {
    describe('Comment model static properties', () => {
        it('should have correct entity name', () => {
            expect(Comment.entity).toBe('comments');
        });

        it('should have correct table reference', () => {
            expect(Comment.table).toBe(commentsTable);
        });

        it('should have correct primary key', () => {
            expect(Comment.primaryKey).toBe('id');
        });

        it('should have correct package name', () => {
            expect(Comment.packageName).toBe('@ottabase/comments');
        });

        it('should have correct package type', () => {
            expect(Comment.packageType).toBe('package');
        });

        it('should have display name', () => {
            expect(Comment.displayName).toBe('Comment');
            expect(Comment.displayNamePlural).toBe('Comments');
        });

        it('should have default sort configuration', () => {
            expect(Comment.defaultSort).toBe('createdAt');
            expect(Comment.defaultSortDirection).toBe('desc');
        });

        it('should define casts for date and json fields (reactions is no longer a column)', () => {
            expect(Comment.casts).toEqual({
                depth: 'number',
                createdAt: 'date',
                updatedAt: 'date',
            });
        });

        it('should define writable fields for create and update', () => {
            expect(Comment.writable.create).toContain('body');
            expect(Comment.writable.create).toContain('targetType');
            expect(Comment.writable.create).toContain('targetId');
            expect(Comment.writable.create).toContain('parentId');
            expect(Comment.writable.create).toContain('depth');
            // userId and organizationId are in writable.create so the server-side
            // injection passes through the sanitizer; the route handler always
            // overwrites them (and depth) from session/server-computed context to
            // prevent impersonation and forged nesting depth.
            expect(Comment.writable.create).toContain('userId');
            expect(Comment.writable.create).toContain('organizationId');
            // status must NOT be writable on create (defaults to 'active')
            expect(Comment.writable.create).not.toContain('status');
            expect(Comment.writable.update).toContain('body');
            // status is writable to support moderation via CRUD
            expect(Comment.writable.update).toContain('status');
            // targetType and targetId should NOT be updatable
            expect(Comment.writable.update).not.toContain('targetType');
            expect(Comment.writable.update).not.toContain('targetId');
        });
    });

    describe('commentsTable schema', () => {
        it('should export the table', () => {
            expect(commentsTable).toBeDefined();
        });

        // Check that the table has expected column names by inspecting the Drizzle table object
        it('should have expected columns (reactions moved to a dedicated table)', () => {
            const columnNames = Object.keys(commentsTable);
            expect(columnNames).toContain('id');
            expect(columnNames).toContain('body');
            expect(columnNames).toContain('targetType');
            expect(columnNames).toContain('targetId');
            expect(columnNames).toContain('parentId');
            expect(columnNames).toContain('userId');
            expect(columnNames).toContain('status');
            expect(columnNames).toContain('depth');
            expect(columnNames).toContain('createdAt');
            expect(columnNames).toContain('updatedAt');
            expect(columnNames).not.toContain('reactions');
        });
    });

    describe('commentReactionsTable schema', () => {
        it('should export the table with the expected columns', () => {
            expect(commentReactionsTable).toBeDefined();
            const columnNames = Object.keys(commentReactionsTable);
            expect(columnNames).toContain('id');
            expect(columnNames).toContain('commentId');
            expect(columnNames).toContain('emoji');
            expect(columnNames).toContain('userId');
            expect(columnNames).toContain('createdAt');
        });

        it('should expose both tables from the schema subpath', () => {
            expect(schemaCommentsTable).toBe(commentsTable);
            expect(schemaCommentReactionsTable).toBe(commentReactionsTable);
        });
    });

    describe('CommentReaction model static properties', () => {
        it('should have correct entity name', () => {
            expect(CommentReaction.entity).toBe('comment_reactions');
        });

        it('should not be writable via generic CRUD', () => {
            expect(CommentReaction.writable.create).toEqual([]);
            expect(CommentReaction.writable.update).toEqual([]);
        });

        it('should have toggle, deleteForComment, and reactionsFor static methods', () => {
            expect(typeof CommentReaction.toggle).toBe('function');
            expect(typeof CommentReaction.deleteForComment).toBe('function');
            expect(typeof CommentReaction.reactionsFor).toBe('function');
        });
    });

    describe('types', () => {
        it('should export DEFAULT_REACTIONS', () => {
            expect(DEFAULT_REACTIONS).toBeDefined();
            expect(DEFAULT_REACTIONS).toContain('👍');
            expect(DEFAULT_REACTIONS).toContain('❤️');
            expect(DEFAULT_REACTIONS).toContain('😂');
            expect(DEFAULT_REACTIONS).toContain('😮');
        });

        it('should allow CommentStatus type values', () => {
            // Type-level test: ensure the types compile
            const statuses: CommentStatus[] = ['active', 'deleted', 'flagged', 'hidden'];
            expect(statuses).toHaveLength(4);
        });

        it('should allow ReactionsMap type', () => {
            const reactions: ReactionsMap = {
                '👍': ['user-1', 'user-2'],
                '❤️': ['user-3'],
            };
            expect(Object.keys(reactions)).toHaveLength(2);
        });
    });

    describe('Comment instance methods exist', () => {
        // We can't call DB-dependent methods without a driver,
        // but we can verify they exist on the prototype
        it('should have softDelete method', () => {
            expect(typeof Comment.prototype.softDelete).toBe('function');
        });

        it('should have flag method', () => {
            expect(typeof Comment.prototype.flag).toBe('function');
        });

        it('should have hide method', () => {
            expect(typeof Comment.prototype.hide).toBe('function');
        });

        it('should have restore method', () => {
            expect(typeof Comment.prototype.restore).toBe('function');
        });

        it('should have toggleReaction method', () => {
            expect(typeof Comment.prototype.toggleReaction).toBe('function');
        });

        it('should have isTopLevel method', () => {
            expect(typeof Comment.prototype.isTopLevel).toBe('function');
        });

        it('should have isActive method', () => {
            expect(typeof Comment.prototype.isActive).toBe('function');
        });

        it('should have author relationship method', () => {
            expect(typeof Comment.prototype.author).toBe('function');
        });

        it('should have parent relationship method', () => {
            expect(typeof Comment.prototype.parent).toBe('function');
        });

        it('should have replies relationship method', () => {
            expect(typeof Comment.prototype.replies).toBe('function');
        });
    });

    describe('Comment instance method behaviour', () => {
        /**
         * Creates a lightweight stub of a Comment instance without a DB driver.
         * We replace get/set/save so we can test method logic in isolation.
         */
        function makeStub(initial: Record<string, unknown> = {}) {
            const data: Record<string, unknown> = { ...initial };
            const saveCalls: Record<string, unknown>[] = [];

            const instance = Object.create(Comment.prototype) as Comment & {
                _data: typeof data;
                _saveCalls: typeof saveCalls;
            };

            instance._data = data;
            instance._saveCalls = saveCalls;

            (instance as any).get = (key: string) => data[key];
            (instance as any).set = (key: string, value: unknown) => {
                data[key] = value;
            };
            (instance as any).save = () => {
                saveCalls.push({ ...data });
                return Promise.resolve(instance);
            };

            return instance;
        }

        describe('softDelete', () => {
            it('sets status to deleted and body to [deleted]', async () => {
                const comment = makeStub({ id: 'c1', status: 'active', body: 'Hello world' });
                vi.spyOn(CommentReaction, 'deleteForComment').mockResolvedValue(undefined);
                await comment.softDelete();
                expect((comment as unknown as { _data: Record<string, unknown> })._data.status).toBe('deleted');
                expect((comment as unknown as { _data: Record<string, unknown> })._data.body).toBe('[deleted]');
            });

            it('clears reactions on soft-delete via CommentReaction.deleteForComment', async () => {
                const comment = makeStub({ id: 'c1', status: 'active', body: 'Hello world' });
                const deleteSpy = vi.spyOn(CommentReaction, 'deleteForComment').mockResolvedValue(undefined);
                await comment.softDelete();
                expect(deleteSpy).toHaveBeenCalledWith('c1');
            });

            it('calls save once', async () => {
                const comment = makeStub({ id: 'c1', status: 'active', body: 'Hello world' });
                vi.spyOn(CommentReaction, 'deleteForComment').mockResolvedValue(undefined);
                await comment.softDelete();
                expect((comment as unknown as { _saveCalls: unknown[] })._saveCalls).toHaveLength(1);
            });
        });

        describe('toggleReaction', () => {
            it('delegates to CommentReaction.toggle with this comment id', async () => {
                const comment = makeStub({ id: 'c1' });
                const toggleSpy = vi.spyOn(CommentReaction, 'toggle').mockResolvedValue({ added: true });
                const result = await comment.toggleReaction('❤️', 'user-1');
                expect(toggleSpy).toHaveBeenCalledWith('c1', '❤️', 'user-1');
                expect(result).toEqual({ added: true });
            });
        });

        describe('isTopLevel / isActive', () => {
            it('isTopLevel returns true when parentId is null', () => {
                const comment = makeStub({ parentId: null });
                expect(comment.isTopLevel()).toBe(true);
            });

            it('isTopLevel returns false when parentId is set', () => {
                const comment = makeStub({ parentId: 'parent-123' });
                expect(comment.isTopLevel()).toBe(false);
            });

            it('isActive returns true when status is active', () => {
                const comment = makeStub({ status: 'active' });
                expect(comment.isActive()).toBe(true);
            });

            it('isActive returns false when status is not active', () => {
                const comment = makeStub({ status: 'deleted' });
                expect(comment.isActive()).toBe(false);
            });
        });
    });

    describe('Comment.computeDepthForParent', () => {
        it('returns 0 when parentId is null (top-level comment)', async () => {
            const depth = await Comment.computeDepthForParent(null);
            expect(depth).toBe(0);
        });

        it('returns 0 when parentId is provided but parent does not exist', async () => {
            // Stub Comment.find to return null (parent not found)
            const findSpy = vi.spyOn(Comment, 'find').mockResolvedValueOnce(null as never);
            const depth = await Comment.computeDepthForParent('nonexistent-id');
            expect(depth).toBe(0);
            findSpy.mockRestore();
        });

        it('returns parent.depth + 1 for a reply to an existing comment', async () => {
            // Create a stub parent with depth 1
            const parentStub = Object.create(Comment.prototype);
            (parentStub as any).get = (key: string) => (key === 'depth' ? 1 : undefined);
            const findSpy = vi.spyOn(Comment, 'find').mockResolvedValueOnce(parentStub as never);
            const depth = await Comment.computeDepthForParent('parent-id');
            expect(depth).toBe(2);
            findSpy.mockRestore();
        });
    });

    describe('Comment.validateReplyParent', () => {
        const ctx = { targetType: 'post', targetId: 'post-1', organizationId: 'org-1' };

        it('returns ok with depth 0 when parentId is null (top-level comment)', async () => {
            const result = await Comment.validateReplyParent(null, ctx);
            expect(result).toEqual({ ok: true, depth: 0 });
        });

        it('returns ok:false when the parent comment does not exist', async () => {
            const findSpy = vi.spyOn(Comment, 'find').mockResolvedValueOnce(null as never);
            const result = await Comment.validateReplyParent('missing-parent', ctx);
            expect(result).toEqual({ ok: false });
            findSpy.mockRestore();
        });

        it('returns ok:false when the parent belongs to a different target', async () => {
            const parentStub = Object.create(Comment.prototype);
            const data: Record<string, unknown> = {
                targetType: 'post',
                targetId: 'a-different-post',
                organizationId: 'org-1',
                depth: 0,
            };
            (parentStub as any).get = (key: string) => data[key];
            const findSpy = vi.spyOn(Comment, 'find').mockResolvedValueOnce(parentStub as never);
            const result = await Comment.validateReplyParent('parent-id', ctx);
            expect(result).toEqual({ ok: false });
            findSpy.mockRestore();
        });

        it('returns ok:false when the parent belongs to a different organization', async () => {
            const parentStub = Object.create(Comment.prototype);
            const data: Record<string, unknown> = {
                targetType: 'post',
                targetId: 'post-1',
                organizationId: 'org-2',
                depth: 0,
            };
            (parentStub as any).get = (key: string) => data[key];
            const findSpy = vi.spyOn(Comment, 'find').mockResolvedValueOnce(parentStub as never);
            const result = await Comment.validateReplyParent('parent-id', ctx);
            expect(result).toEqual({ ok: false });
            findSpy.mockRestore();
        });

        it('returns ok:true with parent.depth + 1 when target and org match', async () => {
            const parentStub = Object.create(Comment.prototype);
            const data: Record<string, unknown> = {
                targetType: 'post',
                targetId: 'post-1',
                organizationId: 'org-1',
                depth: 2,
            };
            (parentStub as any).get = (key: string) => data[key];
            const findSpy = vi.spyOn(Comment, 'find').mockResolvedValueOnce(parentStub as never);
            const result = await Comment.validateReplyParent('parent-id', ctx);
            expect(result).toEqual({ ok: true, depth: 3 });
            findSpy.mockRestore();
        });

        it('treats null organizationId on both sides as matching (single-founder mode)', async () => {
            const parentStub = Object.create(Comment.prototype);
            const data: Record<string, unknown> = {
                targetType: 'post',
                targetId: 'post-1',
                organizationId: null,
                depth: 0,
            };
            (parentStub as any).get = (key: string) => data[key];
            const findSpy = vi.spyOn(Comment, 'find').mockResolvedValueOnce(parentStub as never);
            const result = await Comment.validateReplyParent('parent-id', {
                targetType: 'post',
                targetId: 'post-1',
                organizationId: null,
            });
            expect(result).toEqual({ ok: true, depth: 1 });
            findSpy.mockRestore();
        });
    });
});

// Ensure types are used (prevents unused import warnings for type-only imports)
type _CommentRecord = CommentRecord;
type _NewCommentRecord = NewCommentRecord;

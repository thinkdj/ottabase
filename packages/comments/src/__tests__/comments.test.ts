import { describe, expect, it, vi } from 'vitest';
import type { CommentRecord, CommentStatus, NewCommentRecord, ReactionsMap } from '../index';
import { Comment, commentsTable, DEFAULT_REACTIONS } from '../index';

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

        it('should define casts for date and json fields', () => {
            expect(Comment.casts).toEqual({
                reactions: 'json',
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
            // overwrites them from session context to prevent impersonation.
            expect(Comment.writable.create).toContain('userId');
            expect(Comment.writable.create).toContain('organizationId');
            // status must NOT be writable on create (defaults to 'active')
            expect(Comment.writable.create).not.toContain('status');
            expect(Comment.writable.update).toContain('body');
            // status is writable to support moderation via CRUD
            expect(Comment.writable.update).toContain('status');
            // reactions must NOT be directly writable — toggling is server-side only via _reaction
            expect(Comment.writable.update).not.toContain('reactions');
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
        it('should have expected columns', () => {
            const columnNames = Object.keys(commentsTable);
            expect(columnNames).toContain('id');
            expect(columnNames).toContain('body');
            expect(columnNames).toContain('targetType');
            expect(columnNames).toContain('targetId');
            expect(columnNames).toContain('parentId');
            expect(columnNames).toContain('userId');
            expect(columnNames).toContain('status');
            expect(columnNames).toContain('reactions');
            expect(columnNames).toContain('depth');
            expect(columnNames).toContain('createdAt');
            expect(columnNames).toContain('updatedAt');
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

        it('should have addReaction method', () => {
            expect(typeof Comment.prototype.addReaction).toBe('function');
        });

        it('should have removeReaction method', () => {
            expect(typeof Comment.prototype.removeReaction).toBe('function');
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

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (instance as any).get = (key: string) => data[key];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (instance as any).set = (key: string, value: unknown) => {
                data[key] = value;
            };
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (instance as any).save = () => {
                saveCalls.push({ ...data });
                return Promise.resolve(instance);
            };

            return instance;
        }

        describe('softDelete', () => {
            it('sets status to deleted and body to [deleted]', async () => {
                const comment = makeStub({ status: 'active', body: 'Hello world', reactions: { '👍': ['u1'] } });
                await comment.softDelete();
                expect((comment as unknown as { _data: Record<string, unknown> })._data.status).toBe('deleted');
                expect((comment as unknown as { _data: Record<string, unknown> })._data.body).toBe('[deleted]');
            });

            it('clears reactions on soft-delete', async () => {
                const comment = makeStub({
                    status: 'active',
                    body: 'Hello world',
                    reactions: { '👍': ['u1'], '❤️': ['u2'] },
                });
                await comment.softDelete();
                expect((comment as unknown as { _data: Record<string, unknown> })._data.reactions).toEqual({});
            });

            it('calls save once', async () => {
                const comment = makeStub({ status: 'active', body: 'Hello world' });
                await comment.softDelete();
                expect((comment as unknown as { _saveCalls: unknown[] })._saveCalls).toHaveLength(1);
            });
        });

        describe('addReaction', () => {
            it('adds a new emoji entry with the user', async () => {
                const comment = makeStub({ reactions: {} });
                await comment.addReaction('👍', 'user-1');
                const reactions = (comment as unknown as { _data: Record<string, unknown> })._data
                    .reactions as ReactionsMap;
                expect(reactions['👍']).toEqual(['user-1']);
            });

            it('is idempotent — does not duplicate user', async () => {
                const comment = makeStub({ reactions: { '👍': ['user-1'] } });
                await comment.addReaction('👍', 'user-1');
                const reactions = (comment as unknown as { _data: Record<string, unknown> })._data
                    .reactions as ReactionsMap;
                expect(reactions['👍']).toEqual(['user-1']);
            });
        });

        describe('removeReaction', () => {
            it('removes the user from an existing emoji entry', async () => {
                const comment = makeStub({ reactions: { '👍': ['user-1', 'user-2'] } });
                await comment.removeReaction('👍', 'user-1');
                const reactions = (comment as unknown as { _data: Record<string, unknown> })._data
                    .reactions as ReactionsMap;
                expect(reactions['👍']).toEqual(['user-2']);
            });

            it('deletes the emoji key when the last user is removed', async () => {
                const comment = makeStub({ reactions: { '👍': ['user-1'] } });
                await comment.removeReaction('👍', 'user-1');
                const reactions = (comment as unknown as { _data: Record<string, unknown> })._data
                    .reactions as ReactionsMap;
                expect(reactions['👍']).toBeUndefined();
            });

            it('is a no-op when emoji key does not exist', async () => {
                const comment = makeStub({ reactions: {} });
                await comment.removeReaction('👍', 'user-1');
                const reactions = (comment as unknown as { _data: Record<string, unknown> })._data
                    .reactions as ReactionsMap;
                expect(Object.keys(reactions)).toHaveLength(0);
            });
        });

        describe('toggleReaction', () => {
            it('adds the reaction when the user has not reacted', async () => {
                const comment = makeStub({ reactions: {} });
                await comment.toggleReaction('❤️', 'user-1');
                const reactions = (comment as unknown as { _data: Record<string, unknown> })._data
                    .reactions as ReactionsMap;
                expect(reactions['❤️']).toContain('user-1');
            });

            it('removes the reaction when the user has already reacted', async () => {
                const comment = makeStub({ reactions: { '❤️': ['user-1'] } });
                await comment.toggleReaction('❤️', 'user-1');
                const reactions = (comment as unknown as { _data: Record<string, unknown> })._data
                    .reactions as ReactionsMap;
                expect(reactions['❤️']).toBeUndefined();
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (parentStub as any).get = (key: string) => (key === 'depth' ? 1 : undefined);
            const findSpy = vi.spyOn(Comment, 'find').mockResolvedValueOnce(parentStub as never);
            const depth = await Comment.computeDepthForParent('parent-id');
            expect(depth).toBe(2);
            findSpy.mockRestore();
        });
    });
});

// Ensure types are used (prevents unused import warnings for type-only imports)
type _CommentRecord = CommentRecord;
type _NewCommentRecord = NewCommentRecord;

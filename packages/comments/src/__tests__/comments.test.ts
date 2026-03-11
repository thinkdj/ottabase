import { describe, expect, it } from 'vitest';
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
            expect(Comment.writable.update).toContain('body');
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
});

// Ensure types are used (prevents unused import warnings for type-only imports)
type _CommentRecord = CommentRecord;
type _NewCommentRecord = NewCommentRecord;

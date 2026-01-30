import { describe, it, expect } from 'vitest';
import { Post, PostCategory, PostVersion, PostSeries, PostTag, PostTagLink } from '../ottaorm-models';

describe('ottablog models', () => {
    describe('Post model', () => {
        it('should have correct entity configuration', () => {
            expect(Post.entity).toBe('posts');
            expect(Post.primaryKey).toBe('id');
            expect(Post.table).toBeDefined();
        });

        it('should have correct casts defined', () => {
            expect(Post.casts).toHaveProperty('createdAt');
            expect(Post.casts).toHaveProperty('updatedAt');
            expect(Post.casts).toHaveProperty('content');
            expect(Post.casts).toHaveProperty('seoMeta');
        });

        it('should have correct default values', () => {
            const defaults = (Post as any).defaults;
            expect(defaults.status).toBe('draft');
            expect(defaults.contentType).toBe('blog');
            expect(defaults.isFeatured).toBe(false);
            expect(defaults.allowComments).toBe(true);
            expect(defaults.viewCount).toBe(0);
        });

        it('should have field metadata defined', () => {
            const fields = Post.getFields();
            expect(fields).toHaveProperty('title');
            expect(fields).toHaveProperty('slug');
            expect(fields).toHaveProperty('content');
            expect(fields).toHaveProperty('status');
            expect(fields).toHaveProperty('categoryId');
        });

        it('should have title field configured correctly', () => {
            const fields = Post.getFields();
            expect(fields.title.type).toBe('string');
            expect(fields.title.editable).toBe(true);
            expect(fields.title.searchable).toBe(true);
            expect(fields.title.sortable).toBe(true);
        });

        it('should have validation rules defined', () => {
            const rules = (Post as any).validationRules;
            expect(rules).toHaveProperty('title');
            expect(rules.title.rules).toContain('required');
        });
    });

    describe('PostCategory model', () => {
        it('should have correct entity configuration', () => {
            expect(PostCategory.entity).toBe('categories');
            expect(PostCategory.primaryKey).toBe('id');
            expect(PostCategory.table).toBeDefined();
        });

        it('should have correct casts defined', () => {
            expect(PostCategory.casts).toHaveProperty('sortOrder');
            expect(PostCategory.casts).toHaveProperty('createdAt');
            expect(PostCategory.casts).toHaveProperty('updatedAt');
        });

        it('should have field metadata for type column', () => {
            const fields = PostCategory.getFields();
            expect(fields).toHaveProperty('type');
            expect(fields.type.type).toBe('string');
            expect(fields.type.filterable).toBe(true);
        });

        it('should have name field configured correctly', () => {
            const fields = PostCategory.getFields();
            expect(fields.name.type).toBe('string');
            expect(fields.name.editable).toBe(true);
            expect(fields.name.searchable).toBe(true);
        });
    });

    describe('PostTag model', () => {
        it('should have correct entity configuration', () => {
            expect(PostTag.entity).toBe('post_tags');
            expect(PostTag.primaryKey).toBe('id');
            expect(PostTag.table).toBeDefined();
        });

        it('should have correct casts defined', () => {
            expect(PostTag.casts).toHaveProperty('createdAt');
        });

        it('should have field metadata for type column', () => {
            const fields = PostTag.getFields();
            expect(fields).toHaveProperty('type');
            expect(fields.type.type).toBe('string');
            expect(fields.type.editable).toBe(true);
            expect(fields.type.filterable).toBe(true);
        });

        it('should have color field configured', () => {
            const fields = PostTag.getFields();
            expect(fields).toHaveProperty('color');
            expect(fields.color.type).toBe('string');
            expect(fields.color.editable).toBe(true);
        });

        it('should have validation rules for name', () => {
            const rules = (PostTag as any).validationRules;
            expect(rules).toHaveProperty('name');
            expect(rules.name.rules).toContain('required');
        });

        it('should have static findBySlug method', () => {
            expect(PostTag.findBySlug).toBeDefined();
            expect(typeof PostTag.findBySlug).toBe('function');
        });

        it('should have static forApp method', () => {
            expect(PostTag.forApp).toBeDefined();
            expect(typeof PostTag.forApp).toBe('function');
        });

        it('should have static byType method', () => {
            expect(PostTag.byType).toBeDefined();
            expect(typeof PostTag.byType).toBe('function');
        });

        it('should have generateSlug instance method', () => {
            expect(PostTag.prototype.generateSlug).toBeDefined();
            expect(typeof PostTag.prototype.generateSlug).toBe('function');
        });

        it('should have getStyle instance method', () => {
            expect(PostTag.prototype.getStyle).toBeDefined();
            expect(typeof PostTag.prototype.getStyle).toBe('function');
        });
    });

    describe('PostTagLink model (junction table)', () => {
        it('should have correct entity configuration', () => {
            expect(PostTagLink.entity).toBe('post_tag_links');
            expect(PostTagLink.primaryKey).toBe('postId');
            expect(PostTagLink.table).toBeDefined();
        });

        it('should have field metadata defined', () => {
            const fields = PostTagLink.getFields();
            expect(fields).toHaveProperty('postId');
            expect(fields).toHaveProperty('tagId');
            expect(fields).toHaveProperty('createdAt');
        });

        it('should have static linkTag method', () => {
            expect(PostTagLink.linkTag).toBeDefined();
            expect(typeof PostTagLink.linkTag).toBe('function');
        });

        it('should have static unlinkTag method', () => {
            expect(PostTagLink.unlinkTag).toBeDefined();
            expect(typeof PostTagLink.unlinkTag).toBe('function');
        });

        it('should have static forPost method', () => {
            expect(PostTagLink.forPost).toBeDefined();
            expect(typeof PostTagLink.forPost).toBe('function');
        });

        it('should have static forTag method', () => {
            expect(PostTagLink.forTag).toBeDefined();
            expect(typeof PostTagLink.forTag).toBe('function');
        });
    });

    describe('PostVersion model', () => {
        it('should have correct entity configuration', () => {
            expect(PostVersion.entity).toBe('post_versions');
            expect(PostVersion.primaryKey).toBe('id');
            expect(PostVersion.table).toBeDefined();
        });

        it('should have correct casts defined', () => {
            expect(PostVersion.casts).toHaveProperty('createdAt');
            expect(PostVersion.casts).toHaveProperty('wordCount');
        });

        it('should have field metadata defined', () => {
            const fields = PostVersion.getFields();
            expect(fields).toHaveProperty('postId');
            expect(fields).toHaveProperty('versionNumber');
            expect(fields).toHaveProperty('title');
            expect(fields).toHaveProperty('content');
        });
    });

    describe('PostSeries model', () => {
        it('should have correct entity configuration', () => {
            expect(PostSeries.entity).toBe('series');
            expect(PostSeries.primaryKey).toBe('id');
            expect(PostSeries.table).toBeDefined();
        });

        it('should have correct casts defined', () => {
            expect(PostSeries.casts).toHaveProperty('isComplete');
            expect(PostSeries.casts).toHaveProperty('createdAt');
            expect(PostSeries.casts).toHaveProperty('updatedAt');
        });

        it('should have field metadata defined', () => {
            const fields = PostSeries.getFields();
            expect(fields).toHaveProperty('title');
            expect(fields).toHaveProperty('slug');
            expect(fields).toHaveProperty('isComplete');
            expect(fields).toHaveProperty('sortOrder');
        });
    });

    describe('Type column support', () => {
        it('PostCategory should support type field', () => {
            const fields = PostCategory.getFields();
            expect(fields.type).toBeDefined();
            expect(fields.type.uiConfig.description).toContain('post, news, docs');
        });

        it('PostTag should support type field', () => {
            const fields = PostTag.getFields();
            expect(fields.type).toBeDefined();
            expect(fields.type.uiConfig.description).toContain('post, news, docs');
        });

        it("Both should have type as default 'post'", () => {
            const catFields = PostCategory.getFields();
            const tagFields = PostTag.getFields();
            expect(catFields.type.uiConfig.defaultValue).toBe('post');
            expect(tagFields.type.uiConfig.defaultValue).toBe('post');
        });
    });

    describe('Model relationships', () => {
        it('Post model should have author relationship method', () => {
            expect(Post.prototype.author).toBeDefined();
            expect(typeof Post.prototype.author).toBe('function');
        });

        it('Post model should have tags relationship method', () => {
            expect(Post.prototype.tags).toBeDefined();
            expect(typeof Post.prototype.tags).toBe('function');
        });
    });

    describe('Model instance methods', () => {
        it('Post should have publish method', () => {
            expect(Post.prototype.publish).toBeDefined();
            expect(typeof Post.prototype.publish).toBe('function');
        });

        it('Post should have unpublish method', () => {
            expect(Post.prototype.unpublish).toBeDefined();
            expect(typeof Post.prototype.unpublish).toBe('function');
        });

        it('Post should have archive method', () => {
            expect(Post.prototype.archive).toBeDefined();
            expect(typeof Post.prototype.archive).toBe('function');
        });

        it('Post should have toggleFeatured method', () => {
            expect(Post.prototype.toggleFeatured).toBeDefined();
            expect(typeof Post.prototype.toggleFeatured).toBe('function');
        });

        it('Post should have incrementViews method', () => {
            expect(Post.prototype.incrementViews).toBeDefined();
            expect(typeof Post.prototype.incrementViews).toBe('function');
        });

        it('PostCategory should have generateSlug method', () => {
            expect(PostCategory.prototype.generateSlug).toBeDefined();
            expect(typeof PostCategory.prototype.generateSlug).toBe('function');
        });
    });

    describe('Model query helpers', () => {
        it('Post should have static findBySlug method', () => {
            expect(Post.findBySlug).toBeDefined();
            expect(typeof Post.findBySlug).toBe('function');
        });

        it('Post should have static published method', () => {
            expect(Post.published).toBeDefined();
            expect(typeof Post.published).toBe('function');
        });

        it('Post should have static featured method', () => {
            expect(Post.featured).toBeDefined();
            expect(typeof Post.featured).toBe('function');
        });

        it('Post should have static byCategory method', () => {
            expect(Post.byCategory).toBeDefined();
            expect(typeof Post.byCategory).toBe('function');
        });

        it('Post should have static bySeries method', () => {
            expect(Post.bySeries).toBeDefined();
            expect(typeof Post.bySeries).toBe('function');
        });

        it('PostCategory should have static roots method', () => {
            expect(PostCategory.roots).toBeDefined();
            expect(typeof PostCategory.roots).toBe('function');
        });

        it('PostCategory should have static children method', () => {
            expect(PostCategory.children).toBeDefined();
            expect(typeof PostCategory.children).toBe('function');
        });

        it('PostSeries should have static list method', () => {
            expect(PostSeries.list).toBeDefined();
            expect(typeof PostSeries.list).toBe('function');
        });

        it('PostSeries should have static complete method', () => {
            expect(PostSeries.complete).toBeDefined();
            expect(typeof PostSeries.complete).toBe('function');
        });

        it('PostVersion should have static forPost method', () => {
            expect(PostVersion.forPost).toBeDefined();
            expect(typeof PostVersion.forPost).toBe('function');
        });

        it('PostVersion should have static latestForPost method', () => {
            expect(PostVersion.latestForPost).toBeDefined();
            expect(typeof PostVersion.latestForPost).toBe('function');
        });
    });
});

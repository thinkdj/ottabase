import { describe, expect, it } from 'vitest';
import { Post, PostCategory, PostCategoryLink, PostSeries, PostTag, PostTagLink, PostVersion } from '../ottaorm-models';

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
            expect(Post.casts).toHaveProperty('meta');
            expect(Post.casts).toHaveProperty('isProtected');
        });

        it('should have correct default values', () => {
            const defaults = (Post as any).defaults;
            expect(defaults.status).toBe('draft');
            expect(defaults.contentType).toBe('blog');
            expect(defaults.isFeatured).toBe(false);
            expect(defaults.allowComments).toBe(true);
            expect(defaults.isProtected).toBe(false);
            expect(defaults.viewCount).toBe(0);
        });

        it('should have field metadata defined', () => {
            const fields = Post.getFields();
            expect(fields).toHaveProperty('title');
            expect(fields).toHaveProperty('slug');
            expect(fields).toHaveProperty('content');
            expect(fields).toHaveProperty('status');
            expect(fields).toHaveProperty('categoryId');
            expect(fields).toHaveProperty('isProtected');
            expect(fields).toHaveProperty('passwordHash');
            expect(fields).toHaveProperty('passwordHint');
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

        it('should have viewCount in casts', () => {
            expect(Post.casts).toHaveProperty('viewCount');
            expect(Post.casts.viewCount).toBe('number');
        });

        it('should have viewCount field metadata', () => {
            const fields = Post.getFields();
            expect(fields).toHaveProperty('viewCount');
            expect(fields.viewCount.type).toBe('number');
            expect(fields.viewCount.editable).toBe(false);
            expect(fields.viewCount.sortable).toBe(true);
        });

        it('should have meta json field configured as writable + editable', () => {
            expect(Post.casts.meta).toBe('json');
            const fields = Post.getFields();
            expect(fields).toHaveProperty('meta');
            expect(fields.meta.type).toBe('json');
            expect(fields.meta.editable).toBe(true);
            const writable = (Post as any).writable as { create: string[]; update: string[] };
            expect(writable.create).toContain('meta');
            expect(writable.update).toContain('meta');
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

        it('should mark slug as unique', () => {
            const fields = PostCategory.getFields();
            expect(fields.slug.unique).toBe(true);
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

        it('should mark slug as unique', () => {
            const fields = PostTag.getFields();
            expect(fields.slug.unique).toBe(true);
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
            expect(PostTagLink.primaryKey).toBe('id');
            expect(PostTagLink.table).toBeDefined();
        });

        it('should have field metadata defined', () => {
            const fields = PostTagLink.getFields();
            expect(fields).toHaveProperty('id');
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

    describe('PostCategoryLink model (junction table)', () => {
        it('should have correct entity configuration', () => {
            expect(PostCategoryLink.entity).toBe('post_category_links');
            expect(PostCategoryLink.primaryKey).toBe('id');
            expect(PostCategoryLink.table).toBeDefined();
        });

        it('should have field metadata defined', () => {
            const fields = PostCategoryLink.getFields();
            expect(fields).toHaveProperty('id');
            expect(fields).toHaveProperty('postId');
            expect(fields).toHaveProperty('categoryId');
            expect(fields).toHaveProperty('createdAt');
        });

        it('should have static linkCategory method', () => {
            expect(PostCategoryLink.linkCategory).toBeDefined();
            expect(typeof PostCategoryLink.linkCategory).toBe('function');
        });

        it('should have static unlinkCategory method', () => {
            expect(PostCategoryLink.unlinkCategory).toBeDefined();
            expect(typeof PostCategoryLink.unlinkCategory).toBe('function');
        });

        it('should have static forPost method', () => {
            expect(PostCategoryLink.forPost).toBeDefined();
            expect(typeof PostCategoryLink.forPost).toBe('function');
        });

        it('should have static forCategory method', () => {
            expect(PostCategoryLink.forCategory).toBeDefined();
            expect(typeof PostCategoryLink.forCategory).toBe('function');
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

        it('should mark slug as unique', () => {
            const fields = PostSeries.getFields();
            expect(fields.slug.unique).toBe(true);
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

        it('Post model should have categories relationship method', () => {
            expect(Post.prototype.categories).toBeDefined();
            expect(typeof Post.prototype.categories).toBe('function');
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

        it('Post should have trackView method', () => {
            expect(Post.prototype.trackView).toBeDefined();
            expect(typeof Post.prototype.trackView).toBe('function');
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

        it('Post should have static publishScheduled method', () => {
            expect(Post.publishScheduled).toBeDefined();
            expect(typeof Post.publishScheduled).toBe('function');
        });

        it('Post should have static related method', () => {
            expect(Post.related).toBeDefined();
            expect(typeof Post.related).toBe('function');
        });

        it('Post should have static popular method', () => {
            expect(Post.popular).toBeDefined();
            expect(typeof Post.popular).toBe('function');
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

    describe('Model writable fields', () => {
        it('PostTag should have writable fields for create and update', () => {
            const writable = (PostTag as any).writable;
            expect(writable).toBeDefined();
            expect(writable.create).toContain('name');
            expect(writable.create).toContain('slug');
            expect(writable.create).toContain('color');
            expect(writable.update).toContain('name');
            expect(writable.update).toContain('slug');
        });

        it('PostTagLink should have writable fields for create (postId, tagId)', () => {
            const writable = (PostTagLink as any).writable;
            expect(writable).toBeDefined();
            expect(writable.create).toContain('postId');
            expect(writable.create).toContain('tagId');
            expect(writable.update).toEqual([]);
        });

        it('PostCategoryLink should have writable fields for create (postId, categoryId)', () => {
            const writable = (PostCategoryLink as any).writable;
            expect(writable).toBeDefined();
            expect(writable.create).toContain('postId');
            expect(writable.create).toContain('categoryId');
            expect(writable.update).toEqual([]);
        });

        it('PostCategory should have writable fields for create and update', () => {
            const writable = (PostCategory as any).writable;
            expect(writable).toBeDefined();
            expect(writable.create).toContain('name');
            expect(writable.create).toContain('slug');
            expect(writable.create).toContain('parentId');
            expect(writable.update).toContain('name');
            expect(writable.update).toContain('parentId');
        });

        it('PostSeries should have writable fields for create and update', () => {
            const writable = (PostSeries as any).writable;
            expect(writable).toBeDefined();
            expect(writable.create).toContain('title');
            expect(writable.create).toContain('slug');
            expect(writable.create).toContain('isComplete');
            expect(writable.update).toContain('title');
            expect(writable.update).toContain('isComplete');
        });
    });
});

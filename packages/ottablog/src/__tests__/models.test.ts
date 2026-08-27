import { describe, expect, it, vi } from 'vitest';
import { BaseModel } from '@ottabase/ottaorm';
import { Post, PostCategory, PostCategoryLink, PostSeries, PostTag, PostTagLink, PostVersion } from '../ottaorm-models';
import { POST_CONTENT_MAX_BYTES, PostContentValidationError } from '../types';

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
            expect(fields).toHaveProperty('blurbText');
            expect(fields).toHaveProperty('photoNote');
            expect(fields).toHaveProperty('photoAlbum');
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

        it('configures first-class blurb text as searchable and writable', () => {
            const fields = Post.getFields();
            expect(fields.blurbText.type).toBe('string');
            expect(fields.blurbText.searchable).toBe(true);
            const writable = (Post as any).writable as { create: string[]; update: string[] };
            expect(writable.create).toContain('blurbText');
            expect(writable.update).toContain('blurbText');
        });

        it('keeps derived publication, attribution, and reading fields out of generic writes', () => {
            const writable = (Post as any).writable as { create: string[]; update: string[] };
            for (const field of ['authorId', 'publishedAt', 'postedAt', 'readingTimeMinutes', 'wordCount']) {
                expect(writable.create).not.toContain(field);
                expect(writable.update).not.toContain(field);
            }
        });

        it('defers the heavy body columns but never what the timeline renders', () => {
            // photoAlbum/blurbText/excerpt drive the /blog timeline, so deferring them would empty
            // the collages and thought cards. content/footnotes/privateNotes are read by nothing there.
            expect(Post.deferred).toEqual(['content', 'footnotes', 'privateNotes']);
            for (const field of ['photoAlbum', 'blurbText', 'excerpt', 'heroImage', 'title', 'slug']) {
                expect(Post.deferred).not.toContain(field);
            }
        });

        it('keeps privateNotes readable on a fully loaded record while hiding the password hash', () => {
            // The admin editor loads a post through single-record CRUD, which never defers, and
            // needs privateNotes to populate its notes editor. Privacy on public routes is the
            // serializer's strip, NOT `hidden` — hiding it here would blank the editor field.
            const post = new Post({
                entity: 'posts',
                data: {
                    id: 'post-1',
                    title: 'Draft',
                    privateNotes: { blocks: [{ type: 'paragraph', data: { text: 'internal' } }] },
                    passwordHash: 'hashed-secret',
                },
            });

            const json = post.toJson();
            expect(json.privateNotes).toEqual({ blocks: [{ type: 'paragraph', data: { text: 'internal' } }] });
            expect('passwordHash' in json).toBe(false);
        });

        it('creates blurbs with model-owned derived fields and locked article features', async () => {
            const create = vi.spyOn(Post, 'create').mockResolvedValue({} as any);
            await Post.createBlurb('Watched xyz today.\nIt stayed with me.', {
                status: 'published',
                appId: 'app-1',
                organizationId: 'org-1',
                userId: 'user-1',
            });

            expect(create).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Watched xyz today.',
                    excerpt: 'Watched xyz today. It stayed with me.',
                    blurbText: 'Watched xyz today.\nIt stayed with me.',
                    content: null,
                    contentType: 'blurb',
                    categoryId: null,
                    seriesId: null,
                    heroImage: null,
                    footnotes: null,
                    status: 'published',
                    readingTimeMinutes: 1,
                    isFeatured: false,
                    isProtected: false,
                    appId: 'app-1',
                    organizationId: 'org-1',
                    userId: 'user-1',
                    authorId: 'user-1',
                }),
            );
            expect((create.mock.calls[0][0] as { slug: string }).slug).toMatch(/^blurb-[a-z0-9]+-[a-f0-9-]+$/);
            create.mockRestore();
        });

        it('stores crossposts on create and leaves them alone when updateBlurb omits them', async () => {
            const create = vi.spyOn(Post, 'create').mockResolvedValue({} as any);
            await Post.createBlurb('Cross-posted this one.', {
                crossposts: [{ url: 'https://www.instagram.com/p/abc', origin: true }, 'https://x.com/me/status/1'],
            });
            expect((create.mock.calls[0][0] as { crossposts: unknown }).crossposts).toEqual([
                { url: 'https://www.instagram.com/p/abc', origin: true },
                { url: 'https://x.com/me/status/1' },
            ]);
            create.mockRestore();

            const stored: Record<string, unknown> = { crossposts: [{ url: 'https://x.com/me/status/1' }] };
            const post = Object.assign(Object.create(Post.prototype) as Post, {
                get: (field: string) => stored[field],
                set: (field: string, value: unknown) => {
                    stored[field] = value;
                },
                save: async () => undefined,
                isBlurb: () => true,
            });

            // Status-only PATCH: an omitted list means unchanged, never "drop my links".
            await post.updateBlurb('Cross-posted this one.', { status: 'published' });
            expect(stored.crossposts).toEqual([{ url: 'https://x.com/me/status/1' }]);

            await post.updateBlurb('Cross-posted this one.', { crossposts: [] });
            expect(stored.crossposts).toBeNull();
        });

        it('creates photo journals with an ordered album and lead-photo compatibility metadata', async () => {
            const create = vi.spyOn(Post, 'create').mockResolvedValue({} as any);
            const photos = [
                {
                    id: 'photo-1',
                    mediaId: 'media-1',
                    url: 'https://images.test/kyoto.jpg',
                    alt: 'Lanterns reflected in a wet lane',
                    caption: 'After the last train',
                    location: 'Kyoto, Japan',
                    width: 1800,
                    height: 1200,
                },
            ];

            await Post.createPhotoJournal(photos, {
                title: 'Kyoto, in the rain',
                note: 'A quiet blue hour.',
                isFeatured: true,
                status: 'published',
                appId: 'app-1',
                organizationId: 'org-1',
                userId: 'user-1',
            });

            expect(create).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Kyoto, in the rain',
                    excerpt: 'A quiet blue hour.',
                    blurbText: null,
                    photoNote: 'A quiet blue hour.',
                    photoAlbum: [
                        expect.objectContaining({
                            id: 'photo-1',
                            mediaId: 'media-1',
                            url: 'https://images.test/kyoto.jpg',
                            caption: 'After the last train',
                        }),
                    ],
                    content: null,
                    contentType: 'photo',
                    heroImage: expect.objectContaining({
                        url: 'https://images.test/kyoto.jpg',
                        mediaId: 'media-1',
                        alt: 'Lanterns reflected in a wet lane',
                    }),
                    status: 'published',
                    isFeatured: true,
                    isProtected: false,
                    appId: 'app-1',
                    organizationId: 'org-1',
                    userId: 'user-1',
                    authorId: 'user-1',
                }),
            );
            expect((create.mock.calls[0][0] as { slug: string }).slug).toMatch(
                /^kyoto-in-the-rain-[a-z0-9]+-[a-f0-9-]+$/,
            );
            create.mockRestore();
        });

        it('keeps the stored field note when updatePhotoJournal omits it', async () => {
            const stored: Record<string, unknown> = { title: 'Kyoto, in the rain', photoNote: 'A quiet blue hour.' };
            const photos = [{ id: 'photo-1', url: 'https://images.test/kyoto.jpg', caption: 'After the last train' }];
            const post = Object.assign(Object.create(Post.prototype) as Post, {
                get: (field: string) => stored[field],
                set: (field: string, value: unknown) => {
                    stored[field] = value;
                },
                save: async () => undefined,
                isPhotoJournal: () => true,
            });

            await post.updatePhotoJournal(photos, { status: 'published' });

            // An omitted note means "unchanged", never "clear it" — and the excerpt stays derived
            // from the surviving note rather than falling back to the lead caption.
            expect(stored.photoNote).toBe('A quiet blue hour.');
            expect(stored.excerpt).toBe('A quiet blue hour.');
        });

        it('clears the field note when updatePhotoJournal passes an explicit null', async () => {
            const stored: Record<string, unknown> = { title: 'Kyoto, in the rain', photoNote: 'A quiet blue hour.' };
            const photos = [{ id: 'photo-1', url: 'https://images.test/kyoto.jpg', caption: 'After the last train' }];
            const post = Object.assign(Object.create(Post.prototype) as Post, {
                get: (field: string) => stored[field],
                set: (field: string, value: unknown) => {
                    stored[field] = value;
                },
                save: async () => undefined,
                isPhotoJournal: () => true,
            });

            await post.updatePhotoJournal(photos, { note: null });

            expect(stored.photoNote).toBeNull();
        });

        it('stores an optional journal body and counts its words toward reading time', async () => {
            const create = vi.spyOn(Post, 'create').mockResolvedValue({} as any);
            const photos = [{ id: 'photo-1', url: 'https://images.test/kyoto.jpg', caption: 'After the last train' }];
            const content = {
                blocks: [
                    { type: 'paragraph', data: { text: 'The rain emptied the streets just before blue hour.' } },
                    { type: 'mediaGallery', data: { items: [{ url: 'https://images.test/lane.jpg' }] } },
                ],
            };

            await Post.createPhotoJournal(photos, { note: 'A quiet blue hour.', content });

            const written = create.mock.calls[0][0] as { content: unknown; wordCount: number };
            expect(written.content).toEqual(content);
            // Album words (note + caption) plus the body's own words.
            expect(written.wordCount).toBeGreaterThan(9);
            create.mockRestore();
        });

        it('keeps a stored journal body when updatePhotoJournal omits content and clears it on explicit null', async () => {
            const body = { blocks: [{ type: 'paragraph', data: { text: 'Still here.' } }] };
            const stored: Record<string, unknown> = { title: 'Kyoto, in the rain', content: body };
            const photos = [{ id: 'photo-1', url: 'https://images.test/kyoto.jpg' }];
            const post = Object.assign(Object.create(Post.prototype) as Post, {
                get: (field: string) => stored[field],
                set: (field: string, value: unknown) => {
                    stored[field] = value;
                },
                save: async () => undefined,
                isPhotoJournal: () => true,
            });

            await post.updatePhotoJournal(photos, { status: 'published' });
            expect(stored.content).toEqual(body);

            await post.updatePhotoJournal(photos, { content: null });
            expect(stored.content).toBeNull();
        });

        it('stores crossposts on a photo journal with the same PATCH semantics as a blurb', async () => {
            const create = vi.spyOn(Post, 'create').mockResolvedValue({} as any);
            const photos = [{ id: 'photo-1', url: 'https://images.test/kyoto.jpg' }];
            await Post.createPhotoJournal(photos, { crossposts: ['https://www.instagram.com/p/abc'] });
            expect((create.mock.calls[0][0] as { crossposts: unknown }).crossposts).toEqual([
                { url: 'https://www.instagram.com/p/abc' },
            ]);
            create.mockRestore();

            const stored: Record<string, unknown> = {
                title: 'Kyoto, in the rain',
                crossposts: [{ url: 'https://www.instagram.com/p/abc' }],
            };
            const post = Object.assign(Object.create(Post.prototype) as Post, {
                get: (field: string) => stored[field],
                set: (field: string, value: unknown) => {
                    stored[field] = value;
                },
                save: async () => undefined,
                isPhotoJournal: () => true,
            });

            await post.updatePhotoJournal(photos, { status: 'published' });
            expect(stored.crossposts).toEqual([{ url: 'https://www.instagram.com/p/abc' }]);

            await post.updatePhotoJournal(photos, { crossposts: null });
            expect(stored.crossposts).toBeNull();
        });

        it('keeps the body word count when a partial update changes only the note', async () => {
            // The album's own words recount, and the body's share is recovered from the stored
            // total, so a note-only edit neither drops the body's words nor reads `content`.
            const stored: Record<string, unknown> = {
                title: 'Kyoto, in the rain',
                photoNote: 'A quiet blue hour.', // 4 album words
                photoAlbum: [{ id: 'photo-1', url: 'https://images.test/kyoto.jpg' }],
                wordCount: 104, // 4 album + 100 body
            };
            const photos = [{ id: 'photo-1', url: 'https://images.test/kyoto.jpg' }];
            const post = Object.assign(Object.create(Post.prototype) as Post, {
                get: (field: string) => stored[field],
                set: (field: string, value: unknown) => {
                    stored[field] = value;
                },
                save: async () => undefined,
                isPhotoJournal: () => true,
            });

            await post.updatePhotoJournal(photos, { note: 'Rain all evening and then nothing at all.' });

            // 8 new album words, and the body's 100 survive.
            expect(stored.wordCount).toBe(108);
        });

        it('rejects a journal body that is not editor content', async () => {
            const photos = [{ id: 'photo-1', url: 'https://images.test/kyoto.jpg' }];
            await expect(Post.createPhotoJournal(photos, { content: { blocks: 'nope' } as never })).rejects.toThrow(
                PostContentValidationError,
            );
        });

        it('rejects a journal body past the size ceiling', async () => {
            const photos = [{ id: 'photo-1', url: 'https://images.test/kyoto.jpg' }];
            const oversized = {
                blocks: [{ type: 'paragraph', data: { text: 'x'.repeat(POST_CONTENT_MAX_BYTES + 1) } }],
            };
            await expect(Post.createPhotoJournal(photos, { content: oversized })).rejects.toThrow(
                PostContentValidationError,
            );
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
            expect(fields.type.uiConfig?.description).toContain('post, news, docs');
        });

        it('PostTag should support type field', () => {
            const fields = PostTag.getFields();
            expect(fields.type).toBeDefined();
            expect(fields.type.uiConfig?.description).toContain('post, news, docs');
        });

        it("Both should have type as default 'post'", () => {
            const catFields = PostCategory.getFields();
            const tagFields = PostTag.getFields();
            expect(catFields.type.uiConfig?.defaultValue).toBe('post');
            expect(tagFields.type.uiConfig?.defaultValue).toBe('post');
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

    describe('Post write-path integrity', () => {
        // `create`, `update`, and instance `save()` all funnel through prepareForDatabase, so a rule
        // proven here is one no caller can address its way around — including a host app calling
        // Post.create() directly, which is exactly what the route-level validators cannot cover.
        const prepare = (data: Record<string, unknown>) =>
            (
                Post as unknown as {
                    prepareForDatabase: (d: Record<string, unknown>) => Record<string, unknown>;
                }
            ).prepareForDatabase(data);
        const prepareUpdate = (data: Record<string, unknown>, currentData?: Record<string, unknown>, id = 'post-1') =>
            (
                Post as unknown as {
                    prepareUpdateMutation: (
                        d: Record<string, unknown>,
                        context: { id: string; currentData?: Record<string, unknown>; driver?: undefined },
                    ) => Promise<Record<string, unknown>>;
                }
            ).prepareUpdateMutation(data, { id, currentData, driver: undefined });

        it('runs the content validators from the model, not only from the routes', () => {
            expect(() => prepare({ contentType: 'photo', photoAlbum: [{ url: 'javascript:alert(1)' }] })).toThrow(
                'HTTP(S)',
            );
            expect(() => prepare({ contentType: 'photo', photoAlbum: [] })).toThrow('needs at least one photograph');
            expect(() => prepare({ contentType: 'blog', blurbText: 'stray' })).toThrow('cannot carry blurb text');
            expect(() => prepare({ content: { notBlocks: true } })).toThrow('blocks array');
        });

        it('leaves a partial update alone so single-column writes still work', () => {
            // trackView() and publish() send whatever the instance holds; a guard that demanded a
            // whole coherent post would break every one of them.
            expect(() => prepare({ viewCount: 12 })).not.toThrow();
            expect(() => prepare({ status: 'published', publishedAt: Date.now() })).not.toThrow();
        });

        it('normalizes generic creates through the same subtype contract', async () => {
            const create = vi.spyOn(BaseModel, 'create').mockResolvedValue({} as never);

            await Post.create({
                title: 'Caller supplied title',
                contentType: 'blurb',
                blurbText: 'A normalized thought',
            });

            expect(create).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'A normalized thought',
                    excerpt: 'A normalized thought',
                    contentType: 'blurb',
                    photoAlbum: null,
                    content: null,
                    readingTimeMinutes: 1,
                    wordCount: 3,
                }),
                undefined,
            );
            create.mockRestore();
        });

        it('enforces publication invariants for generic model creates', async () => {
            await expect(
                Post.create({ title: 'Later', slug: 'later', status: 'scheduled', contentType: 'blog' }),
            ).rejects.toThrow('must include a publish date');

            const create = vi.spyOn(BaseModel, 'create').mockResolvedValue({} as never);
            const before = Date.now();
            await Post.create({ title: 'Live', slug: 'live', status: 'published', contentType: 'blog' });
            const written = create.mock.calls[0][0] as Record<string, unknown>;
            expect(written.publishAt).toBeNull();
            expect(written.publishedAt).toEqual(expect.any(Number));
            expect(written.postedAt).toEqual(expect.any(Number));
            expect(written.publishedAt as number).toBeGreaterThanOrEqual(before);
            create.mockRestore();
        });

        it('derives article reading metadata from the effective body', async () => {
            const create = vi.spyOn(BaseModel, 'create').mockResolvedValue({} as never);
            await Post.create({
                title: 'Measured',
                slug: 'measured',
                contentType: 'blog',
                userId: 'author-1',
                content: { blocks: [{ type: 'paragraph', data: { text: 'one two three four' } }] },
            });

            expect(create).toHaveBeenCalledWith(
                expect.objectContaining({ authorId: 'author-1', wordCount: 4, readingTimeMinutes: 1 }),
                undefined,
            );
            create.mockRestore();
        });

        it('validates the effective publication state and preserves live timestamps on edits', async () => {
            const current = {
                id: 'post-1',
                title: 'Already live',
                contentType: 'blog',
                status: 'published',
                publishAt: null,
                publishedAt: 1_700_000_000_000,
                postedAt: 1_700_000_000_100,
            };
            expect(await prepareUpdate({ title: 'Still live' }, current)).toEqual({ title: 'Still live' });

            const repaired = await prepareUpdate(
                { title: 'Repair legacy timestamps' },
                { ...current, publishedAt: null, postedAt: null },
            );
            expect(repaired).toEqual(
                expect.objectContaining({
                    publishedAt: expect.any(Number),
                    postedAt: expect.any(Number),
                }),
            );

            await expect(prepareUpdate({ status: 'scheduled' }, current)).rejects.toThrow(
                'must include a publish date',
            );
        });

        it('loads the current row before validating and normalizing subtype transitions', async () => {
            const current = new Post({
                entity: 'posts',
                data: {
                    id: 'photo-1',
                    title: 'A journal',
                    contentType: 'photo',
                    photoAlbum: [{ id: 'p1', url: 'https://images.test/p1.jpg' }],
                    photoNote: 'A note',
                    content: { blocks: [{ type: 'paragraph', data: { text: 'body' } }] },
                    heroImage: { url: 'https://images.test/p1.jpg' },
                    footnotes: { blocks: [] },
                },
            });
            const find = vi.spyOn(Post, 'find').mockResolvedValue(current);
            const normalized = await prepareUpdate({ contentType: 'blog', title: 'An article' }, undefined, 'photo-1');

            expect(find).toHaveBeenCalledWith('photo-1', undefined);
            expect(normalized).toEqual(
                expect.objectContaining({
                    contentType: 'blog',
                    content: null,
                    blurbText: null,
                    photoNote: null,
                    photoAlbum: null,
                    heroImage: null,
                    footnotes: null,
                }),
            );
            find.mockRestore();
        });

        it('reuses a trusted current row instead of reading it twice', async () => {
            const current = {
                id: 'photo-1',
                title: 'A journal',
                contentType: 'photo',
                photoAlbum: [{ id: 'p1', url: 'https://images.test/p1.jpg' }],
                photoNote: 'A note',
                content: { blocks: [{ type: 'paragraph', data: { text: 'body' } }] },
            };
            const find = vi.spyOn(Post, 'find');
            const normalized = await prepareUpdate({ contentType: 'blog', title: 'An article' }, current, 'photo-1');

            expect(find).not.toHaveBeenCalled();
            expect(normalized).toEqual(
                expect.objectContaining({
                    contentType: 'blog',
                    content: null,
                    photoNote: null,
                    photoAlbum: null,
                }),
            );
            find.mockRestore();
        });
    });

    describe('taxonomy slug mutation hooks', () => {
        it.each([
            [PostSeries, { id: 'series-1', appId: 'app-1', title: 'Series', slug: 'series' }, { title: 'Renamed' }],
            [
                PostCategory,
                { id: 'cat-1', appId: 'app-1', name: 'Category', slug: 'category', type: 'post' },
                { name: 'Renamed' },
            ],
            [PostTag, { id: 'tag-1', appId: 'app-1', name: 'Tag', slug: 'tag', type: 'post' }, { name: 'Renamed' }],
        ] as const)(
            '%s reuses the authorized current snapshot for slug normalization',
            async (Model, current, data) => {
                const find = vi.spyOn(Model, 'find');
                const first = vi.spyOn(Model, 'first').mockResolvedValue(null);
                const prepareUpdateMutation = (
                    Model as unknown as {
                        prepareUpdateMutation: (
                            value: Record<string, unknown>,
                            context: { id: string; currentData: Record<string, unknown>; driver?: undefined },
                        ) => Promise<Record<string, unknown>>;
                    }
                ).prepareUpdateMutation.bind(Model);

                const normalized = await prepareUpdateMutation(
                    { ...data },
                    {
                        id: current.id,
                        currentData: { ...current },
                        driver: undefined,
                    },
                );

                expect(find).not.toHaveBeenCalled();
                expect(first).toHaveBeenCalled();
                expect(normalized.slug).toBe(current.slug);
                first.mockRestore();
                find.mockRestore();
            },
        );
    });

    describe('Post deferred-column safety', () => {
        // Exactly what a collection read hands back: Post.deferred columns absent, and `get` on one
        // of them throwing rather than answering null.
        const fromCollectionRead = () =>
            new Post({
                entity: 'posts',
                data: { id: 'post-1', title: 'Kyoto, in the rain', excerpt: 'A quiet blue hour.' },
                omitted: ['content', 'footnotes', 'privateNotes'],
            });

        it('still throws on a bare get of a deferred column', () => {
            // The guard below must not become a silent null for everyone — that is the failure mode
            // the ORM raises this error to prevent.
            expect(() => fromCollectionRead().get('content')).toThrow(/not loaded/);
        });

        it('derives from the body only when the body was actually loaded', () => {
            const post = fromCollectionRead();
            // Nothing to derive from, so both leave the stored values alone rather than throwing
            // inside an unrelated save.
            expect(() => post.updateReadingStats()).not.toThrow();
            expect(() => post.generateExcerpt()).not.toThrow();
            expect(post.get('excerpt')).toBe('A quiet blue hour.');
            expect(post.get('wordCount')).toBeUndefined();
        });

        it('derives normally from a fully loaded record', () => {
            const post = new Post({
                entity: 'posts',
                data: {
                    id: 'post-2',
                    title: 'Kyoto, in the rain',
                    excerpt: null,
                    content: { blocks: [{ type: 'paragraph', data: { text: 'The rain emptied the streets.' } }] },
                },
            });

            post.updateReadingStats();
            post.generateExcerpt();
            expect(post.get('wordCount')).toBeGreaterThan(0);
            expect(post.get('excerpt')).toContain('The rain emptied the streets.');
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

        it('publishes a bounded scheduled batch with one conditional update', async () => {
            const due = ['p1', 'p2', 'p3'].map(
                (id) =>
                    new Post({
                        entity: 'posts',
                        data: { id, title: `Post ${id}`, slug: id, publishAt: 1, status: 'scheduled' },
                    }),
            );
            const whereSpy = vi.spyOn(Post, 'where').mockResolvedValue(due as any);
            const returning = vi.fn(async () => [
                { id: 'p1', title: 'Post p1', slug: 'p1' },
                { id: 'p2', title: 'Post p2', slug: 'p2' },
            ]);
            const update = vi.fn(() => ({
                set: vi.fn(() => ({
                    where: vi.fn(() => ({ returning })),
                })),
            }));
            const driver = { getDb: () => ({ update }) };

            const result = await Post.publishScheduled({ appId: 'app-1', batchSize: 2 }, driver as never);

            expect(whereSpy).toHaveBeenCalledWith(
                expect.objectContaining({ status: 'scheduled', appId: 'app-1' }),
                expect.objectContaining({
                    orderBy: 'publishAt',
                    orderDirection: 'asc',
                    limit: 3,
                    select: ['id', 'title', 'slug', 'publishAt'],
                }),
                driver,
            );
            expect(update).toHaveBeenCalledTimes(1);
            expect(returning).toHaveBeenCalledTimes(1);
            expect(result).toEqual({
                posts: [
                    { id: 'p1', title: 'Post p1', slug: 'p1' },
                    { id: 'p2', title: 'Post p2', slug: 'p2' },
                ],
                hasMore: true,
            });
            whereSpy.mockRestore();
        });

        it('rejects an unbounded scheduled publish batch', async () => {
            await expect(Post.publishScheduled({ batchSize: 91 })).rejects.toThrow(/integer from 1 to 90/);
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

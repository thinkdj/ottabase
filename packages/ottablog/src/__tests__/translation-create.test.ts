import { afterEach, describe, expect, it, vi } from 'vitest';
import { Post, PostTranslation } from '../ottaorm-models';

describe('translation create conflicts', () => {
    afterEach(() => vi.restoreAllMocks());

    it.each([false, true])('does not overwrite an existing translation (concurrent insert: %s)', async (race) => {
        const post = new Post({ entity: Post.entity, data: { id: 'p1', contentType: 'blog', content: null } });
        const existing = new PostTranslation({
            entity: PostTranslation.entity,
            data: { id: 't1', postId: 'p1', language: 'ml', status: 'published' },
        });
        vi.spyOn(Post, 'find').mockResolvedValue(post);
        vi.spyOn(Post, 'first').mockResolvedValue(null);
        const lookup = vi.spyOn(PostTranslation, 'findForPost');
        if (race) lookup.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
        else lookup.mockResolvedValue(existing);
        const create = vi.spyOn(PostTranslation, 'create').mockRejectedValue(new Error('UNIQUE constraint failed'));
        const update = vi.spyOn(existing, 'updateContent');
        await expect(
            PostTranslation.createForPost(
                'p1',
                {
                    language: 'ml',
                    title: 'Draft title',
                    slug: 'draft-ml',
                    status: 'draft',
                    appId: 'app',
                    organizationId: 'org',
                },
                {
                    defaultLanguage: 'en',
                    supportedLanguages: [
                        { code: 'en', name: 'English' },
                        { code: 'ml', name: 'Malayalam' },
                    ],
                    fallbackToDefault: true,
                },
            ),
        ).rejects.toMatchObject({ status: 422 });
        expect(update).not.toHaveBeenCalled();
        expect(create).toHaveBeenCalledTimes(race ? 1 : 0);
    });
});

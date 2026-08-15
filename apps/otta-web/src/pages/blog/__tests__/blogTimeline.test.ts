import { describe, expect, it } from 'vitest';
import { partitionBlogTimeline } from '../blogTimeline';

describe('partitionBlogTimeline', () => {
    it('keeps blurbs and ordinary photo journals interleaved in source chronology', () => {
        const ordered = [
            { id: 'article-new', contentType: 'blog' as const, isFeatured: false },
            { id: 'thought', contentType: 'blurb' as const, isFeatured: true },
            { id: 'travel-log', contentType: 'photo' as const, isFeatured: false },
            { id: 'article-featured', contentType: 'blog' as const, isFeatured: true },
            { id: 'photo-featured', contentType: 'photo' as const, isFeatured: true },
            { id: 'article-old', contentType: 'news' as const, isFeatured: false },
        ];

        const result = partitionBlogTimeline(ordered);

        expect(result.featuredPosts.map((post) => post.id)).toEqual(['article-featured', 'photo-featured']);
        expect(result.timelinePosts.map((post) => post.id)).toEqual([
            'article-new',
            'thought',
            'travel-log',
            'article-old',
        ]);
    });
});

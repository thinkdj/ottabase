import { describe, expect, it } from 'vitest';
import { partitionBlogTimeline, groupPostsByYear } from '../blogTimeline';

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

    it('groups posts into year sections for the personal index', () => {
        const grouped = groupPostsByYear([
            { id: 'a', publishedAt: '2026-03-12T00:00:00Z' },
            { id: 'b', publishedAt: '2026-01-02T00:00:00Z' },
            { id: 'c', publishedAt: '2025-11-01T00:00:00Z' },
            { id: 'd', publishedAt: null },
        ]);

        expect(grouped.map((group) => group.year)).toEqual(['2026', '2025', 'Undated']);
        expect(grouped[0].posts.map((post) => post.id)).toEqual(['a', 'b']);
    });
});

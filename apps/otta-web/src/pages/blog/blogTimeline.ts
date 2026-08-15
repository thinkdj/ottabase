import type { ContentType } from '@ottabase/ottablog';

/** Preserve API chronology while lifting only highlight-capable content into the featured rail. */
export function partitionBlogTimeline<T extends { contentType: ContentType; isFeatured: boolean }>(posts: T[]) {
    return {
        featuredPosts: posts.filter((post) => post.isFeatured && post.contentType !== 'blurb'),
        timelinePosts: posts.filter((post) => !post.isFeatured || post.contentType === 'blurb'),
    };
}

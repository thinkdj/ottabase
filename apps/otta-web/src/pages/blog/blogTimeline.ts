import type { ContentType } from '@ottabase/ottablog';

/** Preserve API chronology while lifting only highlight-capable content into the featured rail. */
export function partitionBlogTimeline<T extends { contentType: ContentType; isFeatured: boolean }>(posts: T[]) {
    return {
        featuredPosts: posts.filter((post) => post.isFeatured && post.contentType !== 'blurb'),
        timelinePosts: posts.filter((post) => !post.isFeatured || post.contentType === 'blurb'),
    };
}

/** Group a chronological list into year sections for a personal-blog index. */
export function groupPostsByYear<T extends { publishedAt?: string | number | Date | null }>(
    posts: T[],
): Array<{ year: string; posts: T[] }> {
    const groups = new Map<string, T[]>();
    for (const post of posts) {
        const value = post.publishedAt;
        const year = value == null || value === '' ? 'Undated' : String(new Date(value).getUTCFullYear() || 'Undated');
        const list = groups.get(year) ?? [];
        list.push(post);
        groups.set(year, list);
    }
    return Array.from(groups, ([year, yearPosts]) => ({ year, posts: yearPosts }));
}

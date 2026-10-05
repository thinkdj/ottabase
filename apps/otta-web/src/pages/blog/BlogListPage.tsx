/**
 * The public blog feed and its archives. Every route renders the same BlogFeed with a different
 * scope, so the look, the filters and the URL state are one thing.
 */
import { useParams } from '@tanstack/react-router';
import { BlogFeed } from './BlogFeed';
import { parseDateScope, type FeedScope } from './blogFeedScope';

const ALL: FeedScope = { kind: 'all' };
const useSlug = () => (useParams({ strict: false }) as { slug?: string }).slug ?? '';

export function BlogListPage() {
    return <BlogFeed scope={ALL} />;
}

export function BlogTagArchivePage() {
    const slug = useSlug();
    return <BlogFeed scope={{ kind: 'tag', slug }} />;
}

export function BlogCategoryArchivePage() {
    const slug = useSlug();
    return <BlogFeed scope={{ kind: 'category', slug }} />;
}

export function BlogSeriesArchivePage() {
    const slug = useSlug();
    return <BlogFeed scope={{ kind: 'series', slug }} />;
}

export function BlogAuthorArchivePage() {
    const { authorId = '' } = useParams({ strict: false }) as { authorId?: string };
    return <BlogFeed scope={{ kind: 'author', id: authorId }} />;
}

export function BlogDateArchivePage() {
    const params = useParams({ strict: false }) as { year?: string; month?: string };
    return <BlogFeed scope={parseDateScope(params)} />;
}

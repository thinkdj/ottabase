import { MarketingPageContent } from '../../components/MarketingPageContent';
import { fetchMarketingPageBySlug } from '../../lib/fetch-marketing-page';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

/** Reserved single-segment paths — static app routes take precedence; these block accidental collisions. */
const RESERVED_SHORT_SLUGS = new Set(['page', 'api', '_next', 'favicon.ico', 'robots.txt', 'sitemap.xml']);

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    if (RESERVED_SHORT_SLUGS.has(slug.toLowerCase())) return { title: 'Not found' };
    const post = await fetchMarketingPageBySlug(slug);
    if (!post) return { title: 'Not found' };
    const title = post.seoMeta?.title?.trim() || post.title;
    const description = post.seoMeta?.description?.trim() || post.excerpt?.trim() || undefined;
    return {
        title,
        description,
        robots: post.seoMeta?.noIndex ? 'noindex, nofollow' : 'index, follow',
    };
}

/** Short URL: `/:slug` when it matches a published marketing page (same post as `/page/:slug`). */
export default async function MarketingPageShortSegment({ params }: Props) {
    const { slug } = await params;
    if (RESERVED_SHORT_SLUGS.has(slug.toLowerCase())) notFound();
    const post = await fetchMarketingPageBySlug(slug);
    if (!post) notFound();
    return (
        <article className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
            <header className="mb-10">
                <h1 className="text-3xl font-semibold tracking-tight text-foreground dark:text-foreground sm:text-4xl">
                    {post.title}
                </h1>
                {post.excerpt ? (
                    <p className="mt-3 text-lg text-muted-foreground dark:text-muted-foreground">{post.excerpt}</p>
                ) : null}
            </header>
            <MarketingPageContent content={post.content} />
        </article>
    );
}

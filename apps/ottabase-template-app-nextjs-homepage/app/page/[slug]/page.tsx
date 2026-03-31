import { MarketingPageContent } from '../../../components/MarketingPageContent';
import { fetchMarketingPageBySlug } from '../../../lib/fetch-marketing-page';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
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

/** Canonical marketing URL: `/page/:slug` */
export default async function MarketingPageNestedRoute({ params }: Props) {
    const { slug } = await params;
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

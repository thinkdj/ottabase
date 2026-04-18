/**
 * Public changelog detail — blog-style article with OttaRenderer for EditorJS body.
 *
 * Uses the unified ottablog Post model with contentType='changelog'.
 */
import { SEOHead } from '@/components/SEOHead';
import { BLOG_DETAIL_QUERY_CONFIG } from '@/config/queryConfig';
import { useSession } from '@/lib/auth';
import type { PostAuthor } from '@/types/blog';
import { MediaLightboxProvider } from '@ottabase/medialibrary';
import type { HeroImage } from '@ottabase/ottablog';
import type { OutputData } from '@ottabase/ottaeditor';
import { useApiQuery } from '@ottabase/ottaorm/client';
import { Blocks, customRenderers, defaultEJSRConfigs } from '@ottabase/ottarenderer';
import '@ottabase/ottarenderer/styles';
import { Badge, Button } from '@ottabase/ui-shadcn';
import { IconArrowLeft, IconEdit } from '@tabler/icons-react';
import { Link, useParams } from '@tanstack/react-router';

interface ChangelogPostDetail {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    content: OutputData | null;
    heroImage: HeroImage | null;
    status: string;
    isFeatured: boolean;
    authorId: string | null;
    author?: PostAuthor | null;
    readingTimeMinutes: number | null;
    publishedAt: string | null;
}

function formatLongDate(iso: string | null): string {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        });
    } catch {
        return '';
    }
}

export function ChangelogDetailPage() {
    const params = useParams({ strict: false });
    const slug = (params as { slug?: string }).slug ?? '';
    const { user } = useSession({ skipAutoSync: true });

    // Use the blog API with contentType filter for changelogs
    const {
        data: entry,
        isLoading,
        isError,
    } = useApiQuery<ChangelogPostDetail>({
        entity: 'posts',
        queryKey: ['changelog-by-slug', slug],
        endpoint: `/api/blog/posts/by-slug/${encodeURIComponent(slug)}?contentType=changelog`,
        queryOptions: {
            enabled: !!slug,
            throwOnError: false,
            ...BLOG_DETAIL_QUERY_CONFIG,
        },
    });

    if (isLoading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center bg-background dark:bg-background">
                <div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent dark:border-primary" />
            </div>
        );
    }

    if (isError || !entry) {
        return (
            <div className="mx-auto max-w-2xl px-4 py-16 text-center">
                <h1 className="text-2xl font-semibold text-foreground dark:text-foreground">Not found</h1>
                <p className="mt-2 text-muted-foreground dark:text-muted-foreground">
                    This changelog entry does not exist or is not published.
                </p>
                <Button asChild variant="outline" className="mt-6">
                    <Link to="/changelog">
                        <IconArrowLeft className="mr-2 size-4" aria-hidden />
                        Back to changelog
                    </Link>
                </Button>
            </div>
        );
    }

    // entry is guaranteed to be defined after the above checks
    const description = entry.excerpt ?? undefined;
    const heroUrl = entry.heroImage?.url;
    const currentUserId = (user as any)?.id;
    const isAuthor = currentUserId && entry.authorId && currentUserId === entry.authorId;

    return (
        <div className="min-h-screen bg-background dark:bg-background">
            <SEOHead
                title={entry.title}
                description={description}
                ogType="article"
                twitterCard="summary_large_image"
                ogImage={heroUrl}
                publishedTime={entry.publishedAt ?? undefined}
                author={entry.author?.name ?? undefined}
            />

            <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
                <div className="mb-8 flex items-center justify-between">
                    <Button variant="ghost" size="sm" asChild className="-ml-2">
                        <Link to="/changelog">
                            <IconArrowLeft className="mr-1.5 size-4" aria-hidden />
                            What&apos;s New
                        </Link>
                    </Button>
                    {isAuthor && (
                        <Button variant="outline" size="sm" asChild>
                            <Link to="/admin/blog/$postId/edit" params={{ postId: entry.id }}>
                                <IconEdit className="mr-1.5 size-4" aria-hidden />
                                Edit
                            </Link>
                        </Button>
                    )}
                </div>

                <header className="mb-8">
                    <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                        {formatLongDate(entry.publishedAt)}
                        {entry.readingTimeMinutes != null && entry.readingTimeMinutes > 0 && (
                            <span className="before:mx-2 before:content-['·']">
                                {entry.readingTimeMinutes} min read
                            </span>
                        )}
                    </p>
                    <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground dark:text-foreground sm:text-4xl">
                        {entry.title}
                    </h1>
                    {entry.author && (
                        <div className="mt-6 flex items-center gap-3">
                            {entry.author.image ? (
                                <img
                                    src={entry.author.image}
                                    alt=""
                                    className="h-10 w-10 rounded-full object-cover ring-1 ring-border dark:ring-border"
                                />
                            ) : (
                                <div className="h-10 w-10 rounded-full bg-muted dark:bg-muted" />
                            )}
                            <span className="text-sm font-medium text-foreground dark:text-foreground">
                                {entry.author.name}
                            </span>
                        </div>
                    )}
                </header>

                {entry.heroImage?.url && (
                    <div className="mb-8 overflow-hidden rounded-2xl bg-muted/30 p-2 ring-1 ring-border dark:bg-muted/20 dark:ring-border sm:p-3">
                        <img
                            src={entry.heroImage.url}
                            alt={entry.heroImage.alt ?? ''}
                            className="w-full rounded-xl object-cover"
                        />
                        {entry.heroImage.caption && (
                            <p className="mt-2 text-center text-sm text-muted-foreground dark:text-muted-foreground">
                                {entry.heroImage.caption}
                            </p>
                        )}
                    </div>
                )}

                {entry.excerpt && (
                    <p className="mb-8 text-lg leading-relaxed text-muted-foreground dark:text-muted-foreground">
                        {entry.excerpt}
                    </p>
                )}

                <div className="mb-6 flex flex-wrap gap-2">
                    <Badge variant="outline" className="rounded-full font-normal">
                        Changelog
                    </Badge>
                </div>

                {entry.content && entry.content.blocks?.length > 0 && (
                    <MediaLightboxProvider variant="immersive">
                        <div className="changelog-prose prose prose-neutral max-w-none dark:prose-invert prose-headings:scroll-mt-20 prose-p:leading-relaxed">
                            <Blocks
                                data={entry.content}
                                config={{ ...defaultEJSRConfigs }}
                                renderers={customRenderers}
                            />
                        </div>
                    </MediaLightboxProvider>
                )}

                <footer className="mt-14 border-t border-border pt-8 dark:border-border">
                    <Button variant="outline" asChild>
                        <Link to="/changelog">
                            <IconArrowLeft className="mr-2 size-4" aria-hidden />
                            All updates
                        </Link>
                    </Button>
                </footer>
            </article>
        </div>
    );
}

export default ChangelogDetailPage;

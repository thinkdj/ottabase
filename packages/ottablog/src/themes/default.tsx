/**
 * @ottabase/ottablog - Default Theme
 *
 * Clean, modern default theme with dark mode support
 */

import { Blocks, customRenderers, defaultEJSRConfigs } from '@ottabase/ottarenderer';
import { sanitizeUrl } from '@ottabase/utils/sanitize';
import { BlurbCard } from '../components/BlurbCard';
import { PhotoJournalGallery } from '../components/PhotoJournalGallery';
import type { EditorJSData } from '../types';
import { contentTypeLabel, formatDate as defaultFormatDate } from '../types';
import type { Theme } from './types';

/**
 * Default Theme - Modern, clean design with dark mode
 */
export const defaultTheme: Theme = {
    metadata: {
        id: 'default',
        name: 'Default',
        description: 'Clean, modern default theme with dark mode support',
        version: '1.0.0',
    },
    config: {
        classes: {
            container: 'blog-post max-w-3xl mx-auto px-4 py-8',
            header: 'mb-8',
            hero: 'mb-10',
            title: 'font-serif text-4xl sm:text-5xl font-semibold tracking-[-0.03em] leading-[1.1] text-foreground',
            metadata:
                'flex flex-wrap items-center justify-center gap-x-3 gap-y-2 mt-5 mb-10 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground',
            excerpt: 'text-lg text-muted-foreground mb-8 leading-relaxed',
            content: 'prose prose-slate dark:prose-invert max-w-none mb-12',
            footnotes: 'mt-12 rounded-xl bg-muted/40 p-5',
            series: 'rounded-xl bg-muted/40 px-4 py-3 mb-8',
            footer: 'mt-12 pt-8 border-t border-border/60',
            card: 'blog-card',
            blurb: 'max-w-3xl mx-auto',
            photoJournal: 'mx-auto max-w-6xl',
            archiveContainer: 'max-w-4xl mx-auto px-4 py-8 space-y-8',
            archiveTitle: 'text-3xl font-bold tracking-tight',
        },
    },
    renderers: {
        renderBlurb: (post, props) => <BlurbCard post={post} props={props} tone="editorial" />,
        renderPhotoJournal: (post, props) => <PhotoJournalGallery post={post} props={props} tone="editorial" />,
        renderHero: (post, props) => {
            if (!props.showHeroImage || !post.heroImage?.url) return null;
            // Same print-edge treatment as the photo journal's frames: a barely-there radius that
            // reads as a photographic print rather than a UI card, and a hairline over the image so
            // a light photo still has an edge. The caption is set like a journal's, not a browser's.
            return (
                <figure className={`${props.className || ''} ${defaultTheme.config?.classes?.hero || ''}`}>
                    <div
                        className={`relative overflow-hidden rounded-[0.2rem] bg-muted/40 ${post.heroImage.maxHeight ? '' : 'aspect-[16/9]'}`}
                        style={post.heroImage.maxHeight ? { maxHeight: `${post.heroImage.maxHeight}px` } : undefined}
                    >
                        <img
                            src={sanitizeUrl(post.heroImage.url)}
                            alt={post.heroImage.alt || post.title}
                            className="h-full w-full object-cover"
                            loading="eager"
                            decoding="async"
                        />
                        <span
                            className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/5"
                            aria-hidden="true"
                        />
                    </div>
                    {post.heroImage.caption && (
                        <figcaption className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                            {post.heroImage.caption}
                        </figcaption>
                    )}
                </figure>
            );
        },
        /**
         * Article masthead, built like the photo journal's: a structural eyebrow, a serif display
         * title, and a centred block that hands off to left-aligned body copy. The eyebrow carries
         * real information — what this is and how long it takes — rather than decorating the page.
         */
        renderTitle: (post, props) => {
            if (!props.showTitle) return null;
            const kind = contentTypeLabel(post.contentType ?? 'blog');
            const minutes = post.readingTimeMinutes;
            return (
                <div className="mx-auto max-w-2xl text-center">
                    <p className="mb-4 text-[0.625rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                        {kind}
                        {minutes ? ` · ${minutes} min read` : ''}
                    </p>
                    <h1 className={`${props.className || ''} ${defaultTheme.config?.classes?.title || ''}`}>
                        {post.title}
                    </h1>
                </div>
            );
        },
        renderMetadata: (post, props) => {
            if (!props.showMetadata) return null;
            const formatDate = props.formatDate || defaultFormatDate;
            return (
                <div className={`${defaultTheme.config?.classes?.metadata || ''}`}>
                    {post.author?.name && (
                        <div className="flex items-center gap-2">
                            {post.author?.image && (
                                <img
                                    src={sanitizeUrl(post.author.image)}
                                    alt={post.author.name}
                                    className="h-6 w-6 rounded-full object-cover ring-1 ring-border"
                                />
                            )}
                            <span
                                className={`text-sm font-medium normal-case tracking-normal text-foreground${
                                    props.onAuthorClick ? ' cursor-pointer hover:underline' : ''
                                }`}
                                onClick={() =>
                                    props.onAuthorClick && post.authorId && props.onAuthorClick(post.authorId)
                                }
                            >
                                {post.author.name}
                            </span>
                        </div>
                    )}
                    {post.publishedAt && (
                        <time
                            dateTime={
                                typeof post.publishedAt === 'string'
                                    ? post.publishedAt
                                    : new Date(post.publishedAt).toISOString()
                            }
                        >
                            {formatDate(post.publishedAt)}
                        </time>
                    )}
                    {/* Reading time lives in the masthead eyebrow now — repeating it here read as
                        two different facts rather than one. */}
                    {post.isFeatured && (
                        <span className="rounded-full bg-background px-2.5 py-0.5 text-muted-foreground ring-1 ring-border">
                            Featured
                        </span>
                    )}
                </div>
            );
        },
        renderExcerpt: (post, props) => {
            if (!props.showExcerpt || !post.excerpt) return null;
            return <p className={`${defaultTheme.config?.classes?.excerpt || ''}`}>{post.excerpt}</p>;
        },
        renderContent: (post, props) => {
            const hasContent = post.content?.blocks && post.content.blocks.length > 0;
            if (!hasContent) return null;
            return (
                <div className={`${props.contentClassName || ''} ${defaultTheme.config?.classes?.content || ''}`}>
                    <Blocks
                        // Ensure version and time are always present — editorjs-blocks-react-renderer
                        // calls data.version.includes() unconditionally and will throw if absent.
                        data={{ version: '2.30.0', time: Date.now(), ...(post.content as EditorJSData) }}
                        renderers={customRenderers}
                        config={defaultEJSRConfigs}
                    />
                </div>
            );
        },
        renderFootnotes: (post, props) => {
            const hasFootnotes = post.footnotes?.blocks && post.footnotes.blocks.length > 0;
            if (!props.showFootnotes || !hasFootnotes) return null;
            return (
                <aside className={`${defaultTheme.config?.classes?.footnotes || ''}`}>
                    <h2 className="mb-3 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                        Footnotes
                    </h2>
                    <div className="prose prose-sm prose-slate dark:prose-invert max-w-none text-muted-foreground">
                        <Blocks
                            data={{ version: '2.30.0', time: Date.now(), ...(post.footnotes as EditorJSData) }}
                            renderers={customRenderers}
                            config={defaultEJSRConfigs}
                        />
                    </div>
                </aside>
            );
        },
        renderCard: (post, props) => {
            if (post.contentType === 'blurb') {
                return defaultTheme.renderers.renderBlurb?.(post, { ...props, variant: 'timeline' });
            }
            if (post.contentType === 'photo') {
                return defaultTheme.renderers.renderPhotoJournal?.(post, { ...props, variant: 'timeline' });
            }
            const formatDate = props.formatDate || defaultFormatDate;
            return (
                <article
                    className={`group rounded-xl border border-transparent bg-muted/40 transition-colors duration-normal hover:bg-muted/70 ${defaultTheme.config?.classes?.card || ''}`}
                >
                    <div className="p-5 flex gap-4">
                        {post.seriesOrder != null && (
                            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-background text-muted-foreground ring-1 ring-border font-semibold text-sm shrink-0">
                                {post.seriesOrder}
                            </div>
                        )}
                        {props.showHeroImage && post.heroImage?.url && (
                            <img
                                src={sanitizeUrl(post.heroImage.url)}
                                alt={post.heroImage.alt || post.title}
                                className="w-24 h-24 object-cover rounded-lg shrink-0 hidden sm:block"
                            />
                        )}
                        <div className="min-w-0 flex-1">
                            <h2 className="text-[0.9375rem] font-semibold line-clamp-1 flex items-center gap-2">
                                {post.title}
                                {post.isProtected && (
                                    <span className="text-muted-foreground text-xs shrink-0" title="Protected">
                                        {'\u{1F512}'}
                                    </span>
                                )}
                            </h2>
                            {props.showExcerpt && post.excerpt && (
                                <p className="text-sm leading-relaxed text-muted-foreground mt-1 line-clamp-2">
                                    {post.excerpt}
                                </p>
                            )}
                            {props.showMetadata && (
                                <div className="flex items-center gap-3 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground mt-2">
                                    {post.author?.name && <span>{post.author.name}</span>}
                                    {post.publishedAt && <time>{formatDate(post.publishedAt)}</time>}
                                    {post.readingTimeMinutes && <span>{post.readingTimeMinutes} min read</span>}
                                </div>
                            )}
                        </div>
                    </div>
                </article>
            );
        },
        renderSeries: (post, props) => {
            const hasSeriesInfo = post.seriesId && post.seriesTitle;
            if (!props.showSeries || !hasSeriesInfo) return null;
            return (
                <div className={`${defaultTheme.config?.classes?.series || ''}`}>
                    <span className="text-sm text-muted-foreground">
                        Part of series: <strong className="font-medium text-foreground">{post.seriesTitle}</strong>
                    </span>
                    {post.seriesOrder && post.seriesTotalParts && (
                        <span className="ml-2 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                            (Part {post.seriesOrder} of {post.seriesTotalParts})
                        </span>
                    )}
                    {props.renderSeriesNav?.(post)}
                </div>
            );
        },
    },
};

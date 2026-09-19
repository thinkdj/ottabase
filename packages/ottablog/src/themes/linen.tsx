/**
 * @ottabase/ottablog - Linen Theme
 *
 * A quiet personal-blog theme: paper, ink, and type. Inspired by literary
 * blogs (overreacted, macwright, paco.me) rather than a SaaS content feed.
 */

import { Blocks, customRenderers, defaultEJSRConfigs } from '@ottabase/ottarenderer';
import { sanitizeUrl } from '@ottabase/utils/sanitize';
import type { ReactNode } from 'react';
import { BlurbCard } from '../components/BlurbCard';
import { PhotoJournalGallery } from '../components/PhotoJournalGallery';
import type { EditorJSData } from '../types';
import { contentTypeLabel, formatDate as defaultFormatDate } from '../types';
import type { Theme } from './types';

function listDate(value: Date | string | number | null): string {
    return defaultFormatDate(value, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function kindLabel(contentType: string | undefined): string {
    if (contentType === 'blurb') return 'Note';
    if (contentType === 'photo') return 'Journal';
    if (contentType === 'blog') return 'Essay';
    return contentTypeLabel((contentType as 'blog') ?? 'blog');
}

/**
 * Linen Theme — typography-first personal blog
 */
export const linenTheme: Theme = {
    metadata: {
        id: 'linen',
        name: 'Linen',
        description: 'Warm paper, serif type, and a quiet personal-blog layout',
        version: '1.0.0',
        author: 'Deepak Thomas',
        tags: ['personal', 'serif', 'minimal', 'literary'],
    },
    config: {
        classes: {
            container: 'blog-post-linen mx-auto max-w-[40rem] px-0 py-4',
            header: 'mb-10',
            hero: 'mb-10 -mx-0',
            title: 'font-serif text-[2.15rem] leading-[1.15] tracking-[-0.03em] text-foreground sm:text-[2.65rem]',
            metadata: 'mt-4 mb-10 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-muted-foreground',
            excerpt: 'mb-8 font-serif text-lg leading-relaxed text-muted-foreground',
            content:
                'prose prose-lg prose-stone dark:prose-invert mb-14 max-w-none font-serif prose-headings:font-serif prose-headings:font-medium prose-headings:tracking-[-0.02em] prose-a:font-medium prose-a:text-foreground prose-a:underline prose-a:decoration-foreground/25 prose-a:underline-offset-4 hover:prose-a:decoration-foreground/60 prose-blockquote:border-l-foreground/20 prose-blockquote:font-normal prose-blockquote:not-italic prose-code:font-mono prose-code:text-[0.9em] prose-pre:bg-muted/50 prose-pre:shadow-none',
            footnotes: 'mt-14 border-t border-border/70 pt-8',
            series: 'mb-10 border-b border-border/70 pb-6',
            footer: 'mt-14 border-t border-border/70 pt-8',
            card: 'blog-card-linen',
            blurb: 'mx-auto max-w-[40rem]',
            photoJournal: 'mx-auto max-w-[44rem]',
            archiveContainer: 'mx-auto max-w-[40rem] space-y-10',
            archiveTitle: 'font-serif text-3xl font-medium tracking-[-0.03em]',
        },
    },
    renderers: {
        renderBlurb: (post, props) => <BlurbCard post={post} props={props} tone="linen" />,
        renderPhotoJournal: (post, props) => <PhotoJournalGallery post={post} props={props} tone="linen" />,
        renderHero: (post, props) => {
            if (!props.showHeroImage || !post.heroImage?.url) return null;
            return (
                <figure className={`${props.className || ''} ${linenTheme.config?.classes?.hero || ''}`}>
                    <div
                        className={`relative overflow-hidden bg-muted/40 ${post.heroImage.maxHeight ? '' : 'aspect-[16/9]'}`}
                        style={post.heroImage.maxHeight ? { maxHeight: `${post.heroImage.maxHeight}px` } : undefined}
                    >
                        <img
                            src={sanitizeUrl(post.heroImage.url)}
                            alt={post.heroImage.alt || post.title}
                            className="h-full w-full object-cover"
                            loading="eager"
                            decoding="async"
                        />
                    </div>
                    {post.heroImage.caption && (
                        <figcaption className="mt-3 text-[0.8125rem] leading-relaxed text-muted-foreground">
                            {post.heroImage.caption}
                        </figcaption>
                    )}
                </figure>
            );
        },
        renderTitle: (post, props) => {
            if (!props.showTitle) return null;
            return (
                <h1 className={`${props.className || ''} ${linenTheme.config?.classes?.title || ''}`}>{post.title}</h1>
            );
        },
        renderMetadata: (post, props) => {
            if (!props.showMetadata) return null;
            const formatDate = props.formatDate || defaultFormatDate;
            const kind = kindLabel(post.contentType);
            const pieces: Array<{ key: string; node: ReactNode }> = [];
            if (post.publishedAt) {
                pieces.push({
                    key: 'date',
                    node: (
                        <time
                            dateTime={
                                typeof post.publishedAt === 'string'
                                    ? post.publishedAt
                                    : new Date(post.publishedAt).toISOString()
                            }
                        >
                            {formatDate(post.publishedAt)}
                        </time>
                    ),
                });
            }
            if (post.readingTimeMinutes) {
                pieces.push({
                    key: 'read',
                    node: <span>{post.readingTimeMinutes} min</span>,
                });
            }
            if (post.contentType && post.contentType !== 'blog') {
                pieces.push({ key: 'kind', node: <span>{kind}</span> });
            }
            if (post.author?.name) {
                pieces.push({
                    key: 'author',
                    node: (
                        <span
                            className={props.onAuthorClick ? 'cursor-pointer hover:underline' : undefined}
                            onClick={() => props.onAuthorClick && post.authorId && props.onAuthorClick(post.authorId)}
                        >
                            {post.author.name}
                        </span>
                    ),
                });
            }
            if (pieces.length === 0) return null;
            return (
                <div className={`${linenTheme.config?.classes?.metadata || ''}`}>
                    {pieces.map((piece, index) => (
                        <span key={piece.key} className="inline-flex items-center gap-3">
                            {index > 0 && (
                                <span className="text-border" aria-hidden="true">
                                    ·
                                </span>
                            )}
                            {piece.node}
                        </span>
                    ))}
                </div>
            );
        },
        renderExcerpt: (post, props) => {
            if (!props.showExcerpt || !post.excerpt) return null;
            return <p className={`${linenTheme.config?.classes?.excerpt || ''}`}>{post.excerpt}</p>;
        },
        renderContent: (post, props) => {
            const hasContent = post.content?.blocks && post.content.blocks.length > 0;
            if (!hasContent) return null;
            return (
                <div className={`${props.contentClassName || ''} ${linenTheme.config?.classes?.content || ''}`}>
                    <Blocks
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
                <aside className={`${linenTheme.config?.classes?.footnotes || ''}`}>
                    <h2 className="mb-4 font-serif text-sm tracking-wide text-muted-foreground">Notes</h2>
                    <div className="prose prose-sm prose-stone dark:prose-invert max-w-none font-serif text-muted-foreground">
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
                return linenTheme.renderers.renderBlurb?.(post, { ...props, variant: 'timeline' });
            }
            if (post.contentType === 'photo') {
                return linenTheme.renderers.renderPhotoJournal?.(post, { ...props, variant: 'timeline' });
            }
            return (
                <article className={`group ${linenTheme.config?.classes?.card || ''}`}>
                    <div className="flex items-baseline gap-5 sm:gap-8">
                        {post.seriesOrder != null ? (
                            <span className="w-8 shrink-0 text-right font-serif text-lg tabular-nums text-muted-foreground/70">
                                {String(post.seriesOrder).padStart(2, '0')}
                            </span>
                        ) : post.publishedAt ? (
                            <time
                                className="w-[4.25rem] shrink-0 text-[0.8125rem] tabular-nums text-muted-foreground"
                                dateTime={
                                    typeof post.publishedAt === 'string'
                                        ? post.publishedAt
                                        : new Date(post.publishedAt).toISOString()
                                }
                            >
                                {listDate(post.publishedAt)}
                            </time>
                        ) : (
                            <span className="w-[4.25rem] shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                            <h2 className="font-serif text-[1.2rem] leading-snug tracking-[-0.02em] text-foreground sm:text-[1.35rem]">
                                <span className="underline-offset-[5px] decoration-foreground/25 group-hover:underline">
                                    {post.title}
                                </span>
                                {post.isProtected && (
                                    <span className="ml-2 text-xs text-muted-foreground" title="Protected">
                                        {'\u{1F512}'}
                                    </span>
                                )}
                            </h2>
                            {props.showExcerpt && post.excerpt && (
                                <p className="mt-1.5 line-clamp-2 text-[0.9375rem] leading-relaxed text-muted-foreground">
                                    {post.excerpt}
                                </p>
                            )}
                            {props.showMetadata && (post.readingTimeMinutes || post.contentType !== 'blog') && (
                                <p className="mt-2 text-[0.75rem] text-muted-foreground">
                                    {post.contentType && post.contentType !== 'blog'
                                        ? kindLabel(post.contentType)
                                        : null}
                                    {post.contentType && post.contentType !== 'blog' && post.readingTimeMinutes
                                        ? ' · '
                                        : null}
                                    {post.readingTimeMinutes ? `${post.readingTimeMinutes} min` : null}
                                </p>
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
                <div className={`${linenTheme.config?.classes?.series || ''}`}>
                    <p className="text-[0.8125rem] text-muted-foreground">
                        Part of <strong className="font-medium text-foreground">{post.seriesTitle}</strong>
                        {post.seriesOrder && post.seriesTotalParts ? (
                            <span>
                                {' '}
                                · {post.seriesOrder} of {post.seriesTotalParts}
                            </span>
                        ) : null}
                    </p>
                    {props.renderSeriesNav?.(post)}
                </div>
            );
        },
    },
};

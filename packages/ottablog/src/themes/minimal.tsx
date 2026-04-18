/**
 * @ottabase/ottablog - Minimal Theme
 *
 * Clean, minimalist theme with focus on typography and readability
 */

import { Blocks, customRenderers, defaultEJSRConfigs } from '@ottabase/ottarenderer';
import type { EditorJSData } from '../types';
import { formatDate as defaultFormatDate } from '../types';
import type { Theme } from './types';

/**
 * Minimal Theme - Clean, typography-focused design
 */
export const minimalTheme: Theme = {
    metadata: {
        id: 'minimal',
        name: 'Minimal',
        description: 'Clean, minimalist theme focused on typography and readability',
        version: '1.0.0',
        author: 'Ottabase',
    },
    config: {
        classes: {
            container: 'blog-post-minimal max-w-3xl mx-auto px-6 py-12',
            header: 'mb-12',
            hero: 'mb-12 -mx-6',
            title: 'text-5xl md:text-6xl font-light mb-6 text-foreground tracking-tight leading-tight',
            metadata: 'flex flex-wrap items-center gap-6 mb-8 text-xs uppercase tracking-wider text-muted-foreground',
            excerpt: 'text-xl text-muted-foreground mb-10 leading-relaxed font-light',
            content:
                'prose prose-lg prose-slate dark:prose-invert max-w-none mb-16 prose-headings:font-light prose-headings:tracking-tight',
            footnotes: 'border-t border-dashed pt-10 mt-16',
            series: 'bg-transparent border-b border-dashed pb-6 mb-10',
            footer: 'mt-16 pt-10 border-t border-dashed',
            card: 'blog-card-minimal',
            archiveContainer: 'max-w-3xl mx-auto px-6 py-12 space-y-10',
            archiveTitle: 'text-3xl font-light tracking-tight',
        },
    },
    renderers: {
        renderHero: (post, props) => {
            if (!props.showHeroImage || !post.heroImage?.url) return null;
            return (
                <figure className={`${props.className || ''} ${minimalTheme.config?.classes?.hero || ''}`}>
                    <img
                        src={post.heroImage.url}
                        alt={post.heroImage.alt || post.title}
                        className="w-full h-auto object-cover grayscale-[0.3]"
                        loading="eager"
                    />
                    {post.heroImage.caption && (
                        <figcaption className="text-xs text-muted-foreground mt-4 text-center uppercase tracking-wider">
                            {post.heroImage.caption}
                        </figcaption>
                    )}
                </figure>
            );
        },
        renderTitle: (post, props) => {
            if (!props.showTitle) return null;
            return (
                <h1 className={`${props.className || ''} ${minimalTheme.config?.classes?.title || ''}`}>
                    {post.title}
                </h1>
            );
        },
        renderMetadata: (post, props) => {
            if (!props.showMetadata) return null;
            const formatDate = props.formatDate || defaultFormatDate;
            return (
                <div className={`${minimalTheme.config?.classes?.metadata || ''}`}>
                    {post.author?.name && (
                        <div className="flex items-center gap-2">
                            {post.author?.image && (
                                <img
                                    src={post.author.image}
                                    alt={post.author.name}
                                    className="w-6 h-6 rounded-full opacity-80"
                                />
                            )}
                            <span>{post.author.name}</span>
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
                    {post.readingTimeMinutes && <span>{post.readingTimeMinutes} min</span>}
                    {post.isFeatured && (
                        <span className="px-2 py-0.5 border border-current text-xs uppercase tracking-wider">
                            Featured
                        </span>
                    )}
                </div>
            );
        },
        renderExcerpt: (post, props) => {
            if (!props.showExcerpt || !post.excerpt) return null;
            return <p className={`${minimalTheme.config?.classes?.excerpt || ''}`}>{post.excerpt}</p>;
        },
        renderContent: (post, props) => {
            const hasContent = post.content?.blocks && post.content.blocks.length > 0;
            if (!hasContent) return null;
            return (
                <div className={`${props.contentClassName || ''} ${minimalTheme.config?.classes?.content || ''}`}>
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
                <aside className={`${minimalTheme.config?.classes?.footnotes || ''}`}>
                    <h2 className="text-sm font-light uppercase tracking-wider mb-6 text-muted-foreground">
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
            const formatDate = props.formatDate || defaultFormatDate;
            return (
                <article
                    className={`group border-b border-dashed pb-6 mb-2 last:border-b-0 ${minimalTheme.config?.classes?.card || ''}`}
                >
                    <div className="flex gap-6">
                        {post.seriesOrder != null && (
                            <div className="text-2xl font-light text-muted-foreground/50 shrink-0 w-8 text-right tabular-nums">
                                {String(post.seriesOrder).padStart(2, '0')}
                            </div>
                        )}
                        {props.showHeroImage && post.heroImage?.url && (
                            <img
                                src={post.heroImage.url}
                                alt={post.heroImage.alt || post.title}
                                className="w-20 h-20 object-cover grayscale-[0.3] shrink-0 hidden sm:block"
                            />
                        )}
                        <div className="min-w-0 flex-1">
                            <h2 className="text-lg font-light tracking-tight group-hover:text-primary transition-colors line-clamp-1">
                                {post.title}
                                {post.isProtected && (
                                    <span className="ml-2 text-muted-foreground text-xs" title="Protected">
                                        {'\u{1F512}'}
                                    </span>
                                )}
                            </h2>
                            {props.showExcerpt && post.excerpt && (
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2 font-light">
                                    {post.excerpt}
                                </p>
                            )}
                            {props.showMetadata && (
                                <div className="flex items-center gap-4 text-xs uppercase tracking-wider text-muted-foreground mt-2">
                                    {post.author?.name && <span>{post.author.name}</span>}
                                    {post.publishedAt && <time>{formatDate(post.publishedAt)}</time>}
                                    {post.readingTimeMinutes && <span>{post.readingTimeMinutes} min</span>}
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
                <div className={`${minimalTheme.config?.classes?.series || ''}`}>
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">
                        Series: <strong className="font-normal text-foreground">{post.seriesTitle}</strong>
                    </span>
                    {post.seriesOrder && post.seriesTotalParts && (
                        <span className="text-xs text-muted-foreground ml-2">
                            ({post.seriesOrder} / {post.seriesTotalParts})
                        </span>
                    )}
                    {props.renderSeriesNav?.(post)}
                </div>
            );
        },
    },
};

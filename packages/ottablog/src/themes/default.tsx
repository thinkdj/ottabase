/**
 * @ottabase/ottablog - Default Theme
 *
 * Clean, modern default theme with dark mode support
 */

import { Blocks, customRenderers, defaultEJSRConfigs } from '@ottabase/ottarenderer';
import type { EditorJSData } from '../types';
import { formatDate as defaultFormatDate } from '../types';
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
            container: 'blog-post max-w-4xl mx-auto px-4 py-8',
            header: 'mb-8',
            hero: 'mb-8 rounded-lg overflow-hidden shadow-lg',
            title: 'text-4xl md:text-5xl font-bold mb-4 text-foreground',
            metadata: 'flex flex-wrap items-center gap-4 mb-6 text-sm text-muted-foreground',
            excerpt: 'text-xl text-muted-foreground mb-8 leading-relaxed',
            content: 'prose prose-slate dark:prose-invert max-w-none mb-12',
            footnotes: 'border-t pt-8 mt-12',
            series: 'bg-muted/50 border border-border rounded-lg p-4 mb-8',
            footer: 'mt-12 pt-8 border-t',
            card: 'blog-card',
            archiveContainer: 'max-w-4xl mx-auto px-4 py-8 space-y-8',
            archiveTitle: 'text-3xl font-bold',
        },
    },
    renderers: {
        renderHero: (post, props) => {
            if (!props.showHeroImage || !post.heroImage?.url) return null;
            return (
                <figure
                    className={`${props.className || ''} ${defaultTheme.config?.classes?.hero || ''} ${post.heroImage.maxHeight ? 'overflow-hidden' : ''}`}
                    style={post.heroImage.maxHeight ? { maxHeight: `${post.heroImage.maxHeight}px` } : undefined}
                >
                    <img
                        src={post.heroImage.url}
                        alt={post.heroImage.alt || post.title}
                        className="w-full h-auto object-cover"
                        loading="eager"
                    />
                    {post.heroImage.caption && (
                        <figcaption className="text-sm text-muted-foreground mt-2 text-center italic">
                            {post.heroImage.caption}
                        </figcaption>
                    )}
                </figure>
            );
        },
        renderTitle: (post, props) => {
            if (!props.showTitle) return null;
            return (
                <h1 className={`${props.className || ''} ${defaultTheme.config?.classes?.title || ''}`}>
                    {post.title}
                </h1>
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
                                <img src={post.author.image} alt={post.author.name} className="w-6 h-6 rounded-full" />
                            )}
                            <span
                                className={props.onAuthorClick ? 'cursor-pointer hover:underline' : ''}
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
                    {post.readingTimeMinutes && <span>{post.readingTimeMinutes} min read</span>}
                    {post.isFeatured && (
                        <span className="px-2 py-1 bg-primary text-primary-foreground text-xs rounded font-medium">
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
                    <h2 className="text-xl font-semibold mb-4">Footnotes</h2>
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
                    className={`group bg-card border rounded-lg hover:shadow-md transition-shadow ${defaultTheme.config?.classes?.card || ''}`}
                >
                    <div className="p-5 flex gap-4">
                        {post.seriesOrder != null && (
                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted text-muted-foreground font-semibold text-sm shrink-0">
                                {post.seriesOrder}
                            </div>
                        )}
                        {props.showHeroImage && post.heroImage?.url && (
                            <img
                                src={post.heroImage.url}
                                alt={post.heroImage.alt || post.title}
                                className="w-24 h-24 object-cover rounded shrink-0 hidden sm:block"
                            />
                        )}
                        <div className="min-w-0 flex-1">
                            <h2 className="font-semibold text-lg group-hover:text-primary transition-colors line-clamp-1 flex items-center gap-2">
                                {post.title}
                                {post.isProtected && (
                                    <span className="text-muted-foreground text-xs shrink-0" title="Protected">
                                        {'\u{1F512}'}
                                    </span>
                                )}
                            </h2>
                            {props.showExcerpt && post.excerpt && (
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{post.excerpt}</p>
                            )}
                            {props.showMetadata && (
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
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
                    <span className="text-sm font-medium">
                        Part of series: <strong>{post.seriesTitle}</strong>
                    </span>
                    {post.seriesOrder && post.seriesTotalParts && (
                        <span className="text-sm text-muted-foreground ml-2">
                            (Part {post.seriesOrder} of {post.seriesTotalParts})
                        </span>
                    )}
                    {props.renderSeriesNav?.(post)}
                </div>
            );
        },
    },
};

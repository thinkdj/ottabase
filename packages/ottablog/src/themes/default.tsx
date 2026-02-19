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
        },
    },
    renderers: {
        renderHero: (post, props) => {
            if (!props.showHeroImage || !post.heroImage?.url) return null;
            return (
                <figure className={`${props.className || ''} ${defaultTheme.config?.classes?.hero || ''}`}>
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
                    {post.authorName && (
                        <div className="flex items-center gap-2">
                            {post.authorAvatar && (
                                <img src={post.authorAvatar} alt={post.authorName} className="w-8 h-8 rounded-full" />
                            )}
                            <span
                                className={props.onAuthorClick ? 'cursor-pointer hover:underline' : ''}
                                onClick={() =>
                                    props.onAuthorClick && post.authorId && props.onAuthorClick(post.authorId)
                                }
                            >
                                {post.authorName}
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
                        data={post.content as EditorJSData}
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
                            data={post.footnotes as EditorJSData}
                            renderers={customRenderers}
                            config={defaultEJSRConfigs}
                        />
                    </div>
                </aside>
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

/**
 * @ottabase/ottablog - Minimal Theme
 *
 * Clean, minimalist theme with focus on typography and readability
 */

import React from 'react';
import { Blocks, customRenderers, defaultEJSRConfigs } from '@ottabase/ottarenderer';
import { formatDate as defaultFormatDate } from '../types';
import type { Theme } from './types';
import type { BlogPostData, BlogRendererProps } from '../components/BlogRenderer';
import type { EditorJSData } from '../types';

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
                    {post.authorName && (
                        <div className="flex items-center gap-2">
                            {post.authorAvatar && (
                                <img
                                    src={post.authorAvatar}
                                    alt={post.authorName}
                                    className="w-6 h-6 rounded-full opacity-80"
                                />
                            )}
                            <span>{post.authorName}</span>
                        </div>
                    )}
                    {post.publishedAt && (
                        <time
                            dateTime={
                                typeof post.publishedAt === 'string' ? post.publishedAt : post.publishedAt.toISOString()
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
                <aside className={`${minimalTheme.config?.classes?.footnotes || ''}`}>
                    <h2 className="text-sm font-light uppercase tracking-wider mb-6 text-muted-foreground">
                        Footnotes
                    </h2>
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

/**
 * BlogRenderer Component
 *
 * Renders blog post content with all metadata using EditorJS renderer.
 * Supports hooks and themes for extensibility.
 * This is a reusable component that can be used in any app.
 */
import './BlogRenderer.css';
import React, { useEffect, useMemo, useState } from 'react';
import { applyFilters, doAction, HOOKS } from '../hooks';
import { defaultTheme, getActiveTheme, getTheme } from '../themes';
import { formatDate as defaultFormatDate } from '../types';
import type { EditorJSData, HeroImage, SeoMeta } from '../types';

export interface BlogPostData {
    id: string;
    title: string;
    slug: string;
    excerpt?: string | null;
    content?: EditorJSData | null;
    contentType?: string;
    status?: string;
    heroImage?: HeroImage | null;
    seoMeta?: SeoMeta | null;
    footnotes?: EditorJSData | null;
    authorId?: string | null;
    authorName?: string | null;
    authorEmail?: string | null;
    authorAvatar?: string | null;
    readingTimeMinutes?: number | null;
    wordCount?: number | null;
    isFeatured?: boolean;
    publishedAt?: Date | string | null;
    createdAt?: Date | string | null;
    // Series info
    seriesId?: string | null;
    seriesOrder?: number | null;
    seriesTitle?: string | null;
    seriesTotalParts?: number | null;
}

export interface BlogRendererProps {
    /** The blog post data to render */
    post: BlogPostData;
    /** Whether to show the hero image */
    showHeroImage?: boolean;
    /** Whether to show the title */
    showTitle?: boolean;
    /** Whether to show metadata (author, date, reading time) */
    showMetadata?: boolean;
    /** Whether to show the excerpt */
    showExcerpt?: boolean;
    /** Whether to show footnotes */
    showFootnotes?: boolean;
    /** Whether to show series navigation */
    showSeries?: boolean;
    /** Custom class name for the container */
    className?: string;
    /** Custom class name for the content area */
    contentClassName?: string;
    /** Custom date formatter */
    formatDate?: (date: Date | string) => string;
    /** Render custom header above the title */
    renderHeader?: () => React.ReactNode;
    /** Render custom footer below the content */
    renderFooter?: () => React.ReactNode;
    /** Render series navigation */
    renderSeriesNav?: (post: BlogPostData) => React.ReactNode;
    /** On author click */
    onAuthorClick?: (authorId: string) => void;
    /** Theme ID to use (defaults to active theme) */
    themeId?: string;
    /** Disable hooks (for testing) */
    disableHooks?: boolean;
}

/**
 * BlogRenderer - Renders a complete blog post with all metadata
 * Supports hooks and themes for extensibility
 *
 * @example
 * ```tsx
 * <BlogRenderer
 *   post={blogPost}
 *   showHeroImage
 *   showMetadata
 *   showFootnotes
 * />
 * ```
 */
export function BlogRenderer({
    post,
    showHeroImage = true,
    showTitle = true,
    showMetadata = true,
    showExcerpt = false,
    showFootnotes = true,
    showSeries = true,
    className = '',
    contentClassName = '',
    formatDate = defaultFormatDate,
    renderHeader,
    renderFooter,
    renderSeriesNav,
    onAuthorClick,
    themeId,
    disableHooks = false,
}: BlogRendererProps) {
    // Resolve theme: themeId override > active theme > default (memoized)
    const theme = useMemo(() => (themeId ? getTheme(themeId) : null) ?? getActiveTheme() ?? defaultTheme, [themeId]);

    const props = useMemo(
        () => ({
            post,
            showHeroImage,
            showTitle,
            showMetadata,
            showExcerpt,
            showFootnotes,
            showSeries,
            className,
            contentClassName,
            formatDate,
            renderHeader,
            renderFooter,
            renderSeriesNav,
            onAuthorClick,
        }),
        [
            post,
            showHeroImage,
            showTitle,
            showMetadata,
            showExcerpt,
            showFootnotes,
            showSeries,
            className,
            contentClassName,
            formatDate,
            renderHeader,
            renderFooter,
            renderSeriesNav,
            onAuthorClick,
        ],
    );

    // Apply filters to post data (synchronously for React)
    const [filteredPost, setFilteredPost] = useState<BlogPostData>(post);
    const [filteredContent, setFilteredContent] = useState<EditorJSData | null>(post.content || null);
    const [isFilteringComplete, setIsFilteringComplete] = useState(false);

    useEffect(() => {
        if (!disableHooks) {
            setIsFilteringComplete(false);

            // Apply filters asynchronously
            Promise.all([
                applyFilters(HOOKS['post.title.filter'], post.title, post),
                applyFilters(HOOKS['post.excerpt.filter'], post.excerpt, post),
                applyFilters(HOOKS['post.content.filter'], post.content, post),
            ]).then(([filteredTitle, filteredExcerpt, filteredContentResult]) => {
                const newFilteredPost = {
                    ...post,
                    title: filteredTitle as string,
                    excerpt: filteredExcerpt as string | null,
                };

                setFilteredPost(newFilteredPost);
                setFilteredContent(filteredContentResult as EditorJSData | null);
                setIsFilteringComplete(true);

                // Execute action hooks AFTER filters have been applied (fixes race condition)
                doAction(HOOKS['post.render.before'], newFilteredPost, props);
            });
        } else {
            // If hooks are disabled, use original post data
            setFilteredPost(post);
            setFilteredContent(post.content || null);
            setIsFilteringComplete(true);
        }
    }, [post.id, post.title, post.excerpt, post.content, disableHooks, props]);

    const hasContent = filteredContent?.blocks && filteredContent.blocks.length > 0;
    const hasFootnotes = post.footnotes?.blocks && post.footnotes.blocks.length > 0;
    const hasSeriesInfo = post.seriesId && post.seriesTitle;

    // Use theme renderers if available, otherwise fall back to default (memoized)
    // Wrap each renderer in error handling to prevent theme bugs from crashing the entire render
    const renderers = useMemo(() => {
        const safeRenderer = <T extends unknown[]>(
            renderer: ((...args: T) => React.ReactNode) | undefined,
            fallback: (...args: T) => React.ReactNode,
            name: string,
        ) => {
            return (...args: T): React.ReactNode => {
                try {
                    const fn = renderer || fallback;
                    return fn(...args);
                } catch (error) {
                    console.error(`Error in theme renderer "${name}":`, error);
                    return null; // Fail gracefully - render nothing instead of crashing
                }
            };
        };

        return {
            renderHero: safeRenderer(theme.renderers.renderHero, defaultTheme.renderers.renderHero, 'renderHero'),
            renderTitle: safeRenderer(theme.renderers.renderTitle, defaultTheme.renderers.renderTitle, 'renderTitle'),
            renderMetadata: safeRenderer(
                theme.renderers.renderMetadata,
                defaultTheme.renderers.renderMetadata,
                'renderMetadata',
            ),
            renderExcerpt: safeRenderer(
                theme.renderers.renderExcerpt,
                defaultTheme.renderers.renderExcerpt,
                'renderExcerpt',
            ),
            renderContent: safeRenderer(
                theme.renderers.renderContent,
                defaultTheme.renderers.renderContent,
                'renderContent',
            ),
            renderFootnotes: safeRenderer(
                theme.renderers.renderFootnotes,
                defaultTheme.renderers.renderFootnotes,
                'renderFootnotes',
            ),
            renderSeries: safeRenderer(
                theme.renderers.renderSeries,
                defaultTheme.renderers.renderSeries,
                'renderSeries',
            ),
        };
    }, [theme]);

    const containerClass = `${theme.config?.classes?.container || ''} ${className}`.trim();

    // Execute action hooks (side effects only, not for rendering)
    // Only run after filtering is complete to ensure hooks receive filtered data
    useEffect(() => {
        if (!disableHooks && isFilteringComplete) {
            doAction(HOOKS['post.content.before'], filteredPost, props);
            return () => {
                doAction(HOOKS['post.content.after'], filteredPost, props);
            };
        }
    }, [disableHooks, isFilteringComplete, filteredPost, props]);

    useEffect(() => {
        if (!disableHooks && isFilteringComplete) {
            doAction(HOOKS['post.render.after'], filteredPost, props);
        }
    }, [disableHooks, isFilteringComplete, filteredPost, props]);

    return (
        <article className={`blog-post ${containerClass}`}>
            {/* Custom header */}
            {renderHeader?.()}

            {/* Theme renderer: Header */}
            {theme.renderers.renderHeader?.(filteredPost, props)}

            {/* Theme renderer: Hero Image */}
            {renderers.renderHero(filteredPost, props)}

            {/* Theme renderer: Series */}
            {renderers.renderSeries(filteredPost, props)}

            {/* Theme renderer: Title */}
            {renderers.renderTitle(filteredPost, props)}

            {/* Theme renderer: Metadata */}
            {renderers.renderMetadata(filteredPost, props)}

            {/* Theme renderer: Excerpt */}
            {renderers.renderExcerpt(filteredPost, props)}

            {/* Theme renderer: Main Content */}
            {renderers.renderContent({ ...filteredPost, content: filteredContent }, props)}

            {/* Theme renderer: Footnotes */}
            {renderers.renderFootnotes(filteredPost, props)}

            {/* Theme renderer: Footer */}
            {theme.renderers.renderFooter?.(filteredPost, props)}

            {/* Custom footer */}
            {renderFooter?.()}
        </article>
    );
}

/**
 * BlogExcerptCard - Renders a blog post card for listings
 */
export interface BlogExcerptCardProps {
    post: BlogPostData;
    showHeroImage?: boolean;
    showExcerpt?: boolean;
    showMetadata?: boolean;
    className?: string;
    formatDate?: (date: Date | string) => string;
    onClick?: () => void;
    href?: string;
    LinkComponent?: React.ComponentType<{
        href: string;
        className?: string;
        children: React.ReactNode;
    }>;
}

export function BlogExcerptCard({
    post,
    showHeroImage = true,
    showExcerpt = true,
    showMetadata = true,
    className = '',
    formatDate = defaultFormatDate,
    onClick,
    href,
    LinkComponent,
}: BlogExcerptCardProps) {
    const Wrapper = LinkComponent
        ? ({ children }: { children: React.ReactNode }) => (
              <LinkComponent href={href || `/blog/${post.slug}`} className={`blog-card ${className}`}>
                  {children}
              </LinkComponent>
          )
        : ({ children }: { children: React.ReactNode }) => (
              <article className={`blog-card ${className} ${onClick ? 'blog-card--clickable' : ''}`} onClick={onClick}>
                  {children}
              </article>
          );

    return (
        <Wrapper>
            {/* Hero Image */}
            {showHeroImage && post.heroImage?.url && (
                <div className="blog-card__image-wrapper">
                    <img
                        src={post.heroImage.url}
                        alt={post.heroImage.alt || post.title}
                        className="blog-card__image"
                        loading="lazy"
                    />
                    {post.isFeatured && <span className="blog-card__featured-badge">Featured</span>}
                </div>
            )}

            <div className="blog-card__body">
                {/* Content Type Badge */}
                {post.contentType && post.contentType !== 'blog' && (
                    <span className="blog-card__type-badge">{post.contentType}</span>
                )}

                {/* Title */}
                <h2 className="blog-card__title">{post.title}</h2>

                {/* Excerpt */}
                {showExcerpt && post.excerpt && <p className="blog-card__excerpt">{post.excerpt}</p>}

                {/* Metadata */}
                {showMetadata && (
                    <div className="blog-card__meta">
                        {post.authorName && <span className="blog-card__author">{post.authorName}</span>}
                        {post.publishedAt && <time className="blog-card__date">{formatDate(post.publishedAt)}</time>}
                        {post.readingTimeMinutes && (
                            <span className="blog-card__reading-time">{post.readingTimeMinutes} min</span>
                        )}
                    </div>
                )}
            </div>
        </Wrapper>
    );
}

export default BlogRenderer;

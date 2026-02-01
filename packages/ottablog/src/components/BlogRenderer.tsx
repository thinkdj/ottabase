/**
 * BlogRenderer Component
 *
 * Renders blog post content with all metadata using EditorJS renderer.
 * Supports hooks and themes for extensibility.
 * This is a reusable component that can be used in any app.
 */
import React, { useEffect, useState } from 'react';
import { applyFilters, doAction, HOOKS } from '../hooks';
import { defaultTheme, getActiveTheme } from '../themes';
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

const defaultFormatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
};

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
    // Get active theme
    const theme = themeId ? getActiveTheme() || defaultTheme : getActiveTheme() || defaultTheme;
    const props = {
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
    };

    // Apply filters to post data (synchronously for React)
    const [filteredPost, setFilteredPost] = useState<BlogPostData>(post);
    const [filteredContent, setFilteredContent] = useState<EditorJSData | null>(post.content || null);
    const [hookNodes, setHookNodes] = useState<React.ReactNode[]>([]);

    useEffect(() => {
        if (!disableHooks) {
            // Apply filters asynchronously
            Promise.all([
                applyFilters(HOOKS['post.title.filter'], post.title, post),
                applyFilters(HOOKS['post.excerpt.filter'], post.excerpt, post),
                applyFilters(HOOKS['post.content.filter'], post.content, post),
            ]).then(([filteredTitle, filteredExcerpt, filteredContentResult]) => {
                setFilteredPost((prev) => ({
                    ...prev,
                    title: filteredTitle as string,
                    excerpt: filteredExcerpt as string | null,
                }));
                setFilteredContent(filteredContentResult as EditorJSData | null);
            });

            // Execute action hooks (for side effects, not rendering)
            doAction(HOOKS['post.render.before'], filteredPost, props);
        }
    }, [post.id, disableHooks]); // Only re-run when post ID changes

    const hasContent = filteredContent?.blocks && filteredContent.blocks.length > 0;
    const hasFootnotes = post.footnotes?.blocks && post.footnotes.blocks.length > 0;
    const hasSeriesInfo = post.seriesId && post.seriesTitle;

    // Use theme renderers if available, otherwise fall back to default
    const renderHero = theme.renderers.renderHero || defaultTheme.renderers.renderHero;
    const renderTitle = theme.renderers.renderTitle || defaultTheme.renderers.renderTitle;
    const renderMetadata = theme.renderers.renderMetadata || defaultTheme.renderers.renderMetadata;
    const renderExcerpt = theme.renderers.renderExcerpt || defaultTheme.renderers.renderExcerpt;
    const renderContent = theme.renderers.renderContent || defaultTheme.renderers.renderContent;
    const renderFootnotes = theme.renderers.renderFootnotes || defaultTheme.renderers.renderFootnotes;
    const renderSeries = theme.renderers.renderSeries || defaultTheme.renderers.renderSeries;

    const containerClass = `${theme.config?.classes?.container || ''} ${className}`.trim();

    // Execute action hooks (side effects only, not for rendering)
    useEffect(() => {
        if (!disableHooks) {
            doAction(HOOKS['post.content.before'], filteredPost, props);
            return () => {
                doAction(HOOKS['post.content.after'], filteredPost, props);
            };
        }
    }, [filteredPost.id]);

    useEffect(() => {
        if (!disableHooks) {
            doAction(HOOKS['post.render.after'], filteredPost, props);
        }
    }, [filteredPost.id]);

    return (
        <article className={`blog-post ${containerClass}`}>
            {/* Custom header */}
            {renderHeader?.()}

            {/* Theme renderer: Header */}
            {theme.renderers.renderHeader?.(filteredPost, props)}

            {/* Theme renderer: Hero Image */}
            {renderHero(filteredPost, props)}

            {/* Theme renderer: Series */}
            {renderSeries(filteredPost, props)}

            {/* Theme renderer: Title */}
            {renderTitle(filteredPost, props)}

            {/* Theme renderer: Metadata */}
            {renderMetadata(filteredPost, props)}

            {/* Theme renderer: Excerpt */}
            {renderExcerpt(filteredPost, props)}

            {/* Theme renderer: Main Content */}
            {renderContent({ ...filteredPost, content: filteredContent }, props)}

            {/* Theme renderer: Footnotes */}
            {renderFootnotes(filteredPost, props)}

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

/**
 * BlogRenderer Component
 *
 * Renders blog post content with all metadata using EditorJS renderer.
 * Supports hooks and themes for extensibility.
 * This is a reusable component that can be used in any app.
 */
import '@ottabase/ottarenderer/styles';
import React, { useEffect, useMemo, useState } from 'react';
import { redactErrorForLog } from '@ottabase/utils/http-errors';
import { sanitizeUrl } from '@ottabase/utils/sanitize';
import { applyFilters, doAction, HOOKS } from '../hooks';
import { defaultTheme, getActiveTheme, getTheme } from '../themes';
import type { EditorJSData } from '../types';
import { formatDate as defaultFormatDate } from '../types';
import './BlogRenderer.css';
import type { BlurbRendererProps, BlogExcerptCardProps, BlogPostData, BlogRendererProps } from './blog-renderer-types';
import { BlurbText, BlurbTextLinksAllowed } from './BlurbText';
import { PhotoJournalRenderer } from './PhotoJournalRenderer';

// The prop/data interfaces are declared in the pure `./blog-renderer-types` module so that
// pure sites can reference them without importing this rendered file. Re-export them here so
// relative importers (tests, theme/plugin type modules) keep resolving them from this path.
export type { BlurbRendererProps, BlogExcerptCardProps, BlogPostData, BlogRendererProps } from './blog-renderer-types';
export { BlurbText } from './BlurbText';

/** Render a blurb through the active theme and the blurb-specific filter hook. */
export function BlurbRenderer({
    post,
    variant = 'detail',
    themeId,
    disableHooks = false,
    ...rest
}: BlurbRendererProps) {
    const theme = useMemo(() => (themeId ? getTheme(themeId) : null) ?? getActiveTheme() ?? defaultTheme, [themeId]);
    const [filteredText, setFilteredText] = useState(post.blurbText ?? post.excerpt ?? '');

    const props: BlurbRendererProps = { post, variant, themeId, disableHooks, ...rest };

    useEffect(() => {
        let active = true;
        if (disableHooks) {
            setFilteredText(post.blurbText ?? post.excerpt ?? '');
            return () => {
                active = false;
            };
        }
        void Promise.resolve(applyFilters(HOOKS['post.blurb.filter'], post.blurbText ?? post.excerpt ?? '', post)).then(
            (value: string) => {
                if (active) setFilteredText(String(value ?? ''));
            },
        );
        return () => {
            active = false;
        };
    }, [post, disableHooks]);

    const filteredPost = { ...post, blurbText: filteredText };
    const renderer = theme.renderers.renderBlurb ?? defaultTheme.renderers.renderBlurb;
    let rendered: React.ReactNode = null;
    try {
        rendered = renderer?.(filteredPost, props);
    } catch (error) {
        console.error('Error in theme renderBlurb:', redactErrorForLog(error));
        rendered = (
            <BlurbText text={filteredText} className={variant === 'detail' ? 'text-xl leading-relaxed' : 'text-base'} />
        );
    }

    return (
        // Timeline cards get wrapped in a link by the caller, so auto-linked URLs in the text would
        // nest anchors — see BlurbTextLinksAllowed.
        <BlurbTextLinksAllowed.Provider value={variant !== 'timeline'}>
            <article
                className={`blog-blurb blog-blurb--${variant} ${theme.config?.classes?.blurb ?? ''} ${rest.className ?? ''}`.trim()}
            >
                {variant === 'detail' ? (
                    <h1 className="sr-only">{post.title}</h1>
                ) : (
                    <h2 className="sr-only">{post.title}</h2>
                )}
                {rendered}
            </article>
        </BlurbTextLinksAllowed.Provider>
    );
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
export function BlogRenderer(props: BlogRendererProps) {
    if (props.post.contentType === 'blurb') return <BlurbRenderer {...props} variant="detail" />;
    if (props.post.contentType === 'photo') return <PhotoJournalRenderer {...props} variant="detail" />;
    return <ArticleBlogRenderer {...props} />;
}

function ArticleBlogRenderer({
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
    }, [post, disableHooks, props]);

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
                    console.error(`Error in theme renderer "${name}":`, redactErrorForLog(error));
                    return null; // Fail gracefully - render nothing instead of crashing
                }
            };
        };

        // Safe wrapper for optional renderers (no fallback — returns null if not defined)
        const safeOptionalRenderer = <T extends unknown[]>(
            renderer: ((...args: T) => React.ReactNode) | undefined,
            name: string,
        ) => {
            return (...args: T): React.ReactNode => {
                if (!renderer) return null;
                try {
                    return renderer(...args);
                } catch (error) {
                    console.error(`Error in theme renderer "${name}":`, redactErrorForLog(error));
                    return null;
                }
            };
        };

        return {
            renderHeader: safeOptionalRenderer(theme.renderers.renderHeader, 'renderHeader'),
            renderHero: safeRenderer(theme.renderers.renderHero, defaultTheme.renderers.renderHero!, 'renderHero'),
            renderTitle: safeRenderer(theme.renderers.renderTitle, defaultTheme.renderers.renderTitle!, 'renderTitle'),
            renderMetadata: safeRenderer(
                theme.renderers.renderMetadata,
                defaultTheme.renderers.renderMetadata!,
                'renderMetadata',
            ),
            renderExcerpt: safeRenderer(
                theme.renderers.renderExcerpt,
                defaultTheme.renderers.renderExcerpt!,
                'renderExcerpt',
            ),
            renderContent: safeRenderer(
                theme.renderers.renderContent,
                defaultTheme.renderers.renderContent!,
                'renderContent',
            ),
            renderFootnotes: safeRenderer(
                theme.renderers.renderFootnotes,
                defaultTheme.renderers.renderFootnotes!,
                'renderFootnotes',
            ),
            renderSeries: safeRenderer(
                theme.renderers.renderSeries,
                defaultTheme.renderers.renderSeries!,
                'renderSeries',
            ),
            renderFooter: safeOptionalRenderer(theme.renderers.renderFooter, 'renderFooter'),
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
            {renderers.renderHeader(filteredPost, props)}

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
            {renderers.renderFooter(filteredPost, props)}

            {/* Custom footer */}
            {renderFooter?.()}
        </article>
    );
}

/**
 * BlogExcerptCard - Renders a blog post card for listings
 */
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
    themeId,
}: BlogExcerptCardProps) {
    // Check for a theme-provided card renderer
    const theme = useMemo(() => (themeId ? getTheme(themeId) : null) ?? getActiveTheme() ?? defaultTheme, [themeId]);

    if (post.contentType === 'blurb') {
        const blurb = (
            <BlurbRenderer
                post={post}
                variant="timeline"
                showHeroImage={false}
                showExcerpt
                showMetadata={showMetadata}
                className={className}
                formatDate={formatDate}
                themeId={themeId}
            />
        );
        if (LinkComponent) {
            return (
                <LinkComponent href={href || `/blog/${post.slug}`} className="block rounded-xl outline-none">
                    {blurb}
                </LinkComponent>
            );
        }
        return onClick ? (
            <div role="link" tabIndex={0} onClick={onClick} className="cursor-pointer">
                {blurb}
            </div>
        ) : (
            blurb
        );
    }

    if (post.contentType === 'photo') {
        const journal = (
            <PhotoJournalRenderer
                post={post}
                variant="timeline"
                showHeroImage
                showExcerpt={showExcerpt}
                showMetadata={showMetadata}
                className={className}
                formatDate={formatDate}
                themeId={themeId}
            />
        );
        if (LinkComponent) {
            return (
                <LinkComponent href={href || `/blog/${post.slug}`} className="block rounded-2xl outline-none">
                    {journal}
                </LinkComponent>
            );
        }
        return onClick ? (
            <div role="link" tabIndex={0} onClick={onClick} className="cursor-pointer">
                {journal}
            </div>
        ) : (
            journal
        );
    }

    if (theme.renderers.renderCard) {
        try {
            const cardProps: BlogRendererProps = {
                post,
                showHeroImage,
                showExcerpt,
                showMetadata,
                className,
                formatDate,
            };
            const rendered = theme.renderers.renderCard(post, cardProps);
            if (rendered !== null && rendered !== undefined) return <>{rendered}</>;
        } catch (error) {
            console.error('Error in theme renderCard:', redactErrorForLog(error));
            // Fall through to default card rendering
        }
    }

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
                        src={sanitizeUrl(post.heroImage.url)}
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
                        {post.author?.name && <span className="blog-card__author">{post.author.name}</span>}
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

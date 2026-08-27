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
import { applyFilters, HOOKS } from '../hooks';
import { defaultTheme, getActiveTheme, getTheme } from '../themes';
import type { EditorJSData } from '../types';
import { formatDate as defaultFormatDate } from '../types';
import './BlogRenderer.css';
import type { BlurbRendererProps, BlogExcerptCardProps, BlogPostData, BlogRendererProps } from './blog-renderer-types';
import { BlurbText, BlurbTextLinksAllowed } from './BlurbText';
import { CrosspostsRow } from './Crossposts';
import { PhotoJournalRenderer } from './PhotoJournalRenderer';
import { usePostRenderLifecycle } from './usePostRenderLifecycle';

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
    const rawText = post.blurbText ?? post.excerpt ?? '';
    // The source token changes for a same-ID refetch and when hooks are re-enabled. A post ID alone
    // cannot identify an input generation: using it briefly rendered a previous filter result for
    // newly fetched content carrying the same ID.
    const filterSource = useMemo(() => ({ post, rawText, hooksDisabled: disableHooks }), [post, rawText, disableHooks]);
    const [filteredText, setFilteredText] = useState<{ source: typeof filterSource; value: string } | null>(null);

    const props: BlurbRendererProps = { post, variant, themeId, disableHooks, ...rest };

    useEffect(() => {
        let active = true;
        if (!disableHooks) {
            setFilteredText(null);
            void Promise.resolve(applyFilters(HOOKS['post.blurb.filter'], rawText, post))
                .then((value: string) => {
                    if (active) setFilteredText({ source: filterSource, value: String(value ?? '') });
                })
                .catch((error: unknown) => {
                    console.error('Error in post.blurb.filter:', redactErrorForLog(error));
                    if (active) setFilteredText({ source: filterSource, value: rawText });
                });
        }
        return () => {
            active = false;
        };
    }, [disableHooks, filterSource, post, rawText]);

    const textReady = disableHooks || filteredText?.source === filterSource;
    const renderedText = disableHooks || !textReady ? rawText : (filteredText?.value ?? rawText);
    const filteredPost = { ...post, blurbText: renderedText };
    const filteredProps = { ...props, post: filteredPost };
    usePostRenderLifecycle({
        enabled: !disableHooks && textReady,
        revision: filteredText,
        payload: { post: filteredPost, props: filteredProps },
    });

    const renderer = theme.renderers.renderBlurb ?? defaultTheme.renderers.renderBlurb;
    let rendered: React.ReactNode = null;
    try {
        rendered = renderer?.(filteredPost, filteredProps);
    } catch (error) {
        console.error('Error in theme renderBlurb:', redactErrorForLog(error));
        rendered = (
            <BlurbText text={renderedText} className={variant === 'detail' ? 'text-xl leading-relaxed' : 'text-base'} />
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

    // Keep the filtered result stamped with the post it belongs to. Until the current post's
    // async filters settle, rendering falls back to the current raw values rather than showing a
    // previous post's title or body.
    const filterSource = useMemo(() => ({ post, hooksDisabled: disableHooks }), [post, disableHooks]);
    const [filteredState, setFilteredState] = useState<{
        source: typeof filterSource;
        post: BlogPostData;
        content: EditorJSData | null;
    } | null>(null);

    useEffect(() => {
        if (disableHooks) return;

        let active = true;
        setFilteredState(null);
        void Promise.all([
            applyFilters(HOOKS['post.title.filter'], post.title, post),
            applyFilters(HOOKS['post.excerpt.filter'], post.excerpt, post),
            applyFilters(HOOKS['post.content.filter'], post.content, post),
        ])
            .then(([filteredTitle, filteredExcerpt, filteredContentResult]) => {
                if (!active) return;
                const newFilteredPost = {
                    ...post,
                    title: filteredTitle as string,
                    excerpt: filteredExcerpt as string | null,
                };

                setFilteredState({
                    source: filterSource,
                    post: newFilteredPost,
                    content: filteredContentResult as EditorJSData | null,
                });
            })
            .catch((error: unknown) => {
                console.error('Error in post render filters:', redactErrorForLog(error));
                if (!active) return;
                setFilteredState({ source: filterSource, post, content: post.content || null });
            });

        return () => {
            active = false;
        };
    }, [post, disableHooks, filterSource]);

    const filteringForThisPost = !disableHooks && filteredState?.source === filterSource;
    const isFilteringComplete = disableHooks || filteringForThisPost;
    const filteredPost = disableHooks || !filteringForThisPost ? post : filteredState!.post;
    const filteredContent = disableHooks || !filteringForThisPost ? post.content || null : filteredState!.content;

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

    usePostRenderLifecycle({
        enabled: !disableHooks && isFilteringComplete,
        revision: filteredState,
        payload: { post: filteredPost, props },
        includeContent: true,
    });

    return (
        <article className={`blog-post ${containerClass}`}>
            {/* Custom header */}
            {renderHeader?.()}

            {/* Theme renderer: Header */}
            {renderers.renderHeader(filteredPost, props)}

            {/* Theme renderer: Series */}
            {renderers.renderSeries(filteredPost, props)}

            {/* Theme renderer: Title */}
            {renderers.renderTitle(filteredPost, props)}

            {/* Theme renderer: Metadata */}
            {renderers.renderMetadata(filteredPost, props)}

            {/* Hero sits BELOW the masthead, the way a photo journal and any printed feature open:
                the headline says what this is, the image illustrates it. Leading with the image
                pushes the title under the fold on a phone and reads like a stock template. */}
            {renderers.renderHero(filteredPost, props)}

            {/* Crossposts sit outside the theme's metadata renderer on purpose: every theme,
                including ones written after this feature, should credit an external original
                rather than each having to remember to. Renders nothing when there are none. */}
            {showMetadata && <CrosspostsRow post={filteredPost} className="mt-2" />}

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
    const cardHref = sanitizeUrl(href || `/blog/${post.slug}`);

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
                <LinkComponent href={cardHref} className="block rounded-xl outline-none">
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
                <LinkComponent href={cardHref} className="block rounded-2xl outline-none">
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
              <LinkComponent href={cardHref} className={`blog-card ${className}`}>
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

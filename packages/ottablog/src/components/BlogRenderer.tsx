/**
 * BlogRenderer Component
 *
 * Renders blog post content with all metadata using EditorJS renderer.
 * This is a reusable component that can be used in any app.
 */
import React from "react";
import {
  Blocks,
  customRenderers,
  defaultEJSRConfigs,
} from "@ottabase/ottarenderer";
import type { HeroImage, SeoMeta, EditorJSData } from "../types";

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
}

const defaultFormatDate = (date: Date | string): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

/**
 * BlogRenderer - Renders a complete blog post with all metadata
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
  className = "",
  contentClassName = "",
  formatDate = defaultFormatDate,
  renderHeader,
  renderFooter,
  renderSeriesNav,
  onAuthorClick,
}: BlogRendererProps) {
  const hasContent = post.content?.blocks && post.content.blocks.length > 0;
  const hasFootnotes =
    post.footnotes?.blocks && post.footnotes.blocks.length > 0;
  const hasSeriesInfo = post.seriesId && post.seriesTitle;

  return (
    <article className={`blog-post ${className}`}>
      {/* Custom header */}
      {renderHeader?.()}

      {/* Hero Image */}
      {showHeroImage && post.heroImage?.url && (
        <figure className="blog-post__hero">
          <img
            src={post.heroImage.url}
            alt={post.heroImage.alt || post.title}
            className="blog-post__hero-image"
            loading="eager"
          />
          {post.heroImage.caption && (
            <figcaption className="blog-post__hero-caption">
              {post.heroImage.caption}
            </figcaption>
          )}
        </figure>
      )}

      {/* Series Banner */}
      {showSeries && hasSeriesInfo && (
        <div className="blog-post__series-banner">
          <span className="blog-post__series-label">
            Part of series: <strong>{post.seriesTitle}</strong>
          </span>
          {post.seriesOrder && post.seriesTotalParts && (
            <span className="blog-post__series-progress">
              Part {post.seriesOrder} of {post.seriesTotalParts}
            </span>
          )}
          {renderSeriesNav?.(post)}
        </div>
      )}

      {/* Title */}
      {showTitle && (
        <h1 className="blog-post__title">{post.title}</h1>
      )}

      {/* Metadata */}
      {showMetadata && (
        <div className="blog-post__meta">
          {/* Author */}
          {post.authorName && (
            <div className="blog-post__author">
              {post.authorAvatar && (
                <img
                  src={post.authorAvatar}
                  alt={post.authorName}
                  className="blog-post__author-avatar"
                />
              )}
              <span
                className={`blog-post__author-name ${onAuthorClick ? "blog-post__author-name--clickable" : ""}`}
                onClick={() =>
                  onAuthorClick && post.authorId && onAuthorClick(post.authorId)
                }
              >
                {post.authorName}
              </span>
            </div>
          )}

          {/* Date */}
          {post.publishedAt && (
            <time
              className="blog-post__date"
              dateTime={
                typeof post.publishedAt === "string"
                  ? post.publishedAt
                  : post.publishedAt.toISOString()
              }
            >
              {formatDate(post.publishedAt)}
            </time>
          )}

          {/* Reading Time */}
          {post.readingTimeMinutes && (
            <span className="blog-post__reading-time">
              {post.readingTimeMinutes} min read
            </span>
          )}

          {/* Featured Badge */}
          {post.isFeatured && (
            <span className="blog-post__featured-badge">Featured</span>
          )}
        </div>
      )}

      {/* Excerpt */}
      {showExcerpt && post.excerpt && (
        <p className="blog-post__excerpt">{post.excerpt}</p>
      )}

      {/* Main Content */}
      {hasContent && (
        <div className={`blog-post__content ${contentClassName}`}>
          <Blocks
            data={post.content as EditorJSData}
            renderers={customRenderers}
            config={defaultEJSRConfigs}
          />
        </div>
      )}

      {/* Footnotes */}
      {showFootnotes && hasFootnotes && (
        <aside className="blog-post__footnotes">
          <h2 className="blog-post__footnotes-title">Footnotes</h2>
          <div className="blog-post__footnotes-content">
            <Blocks
              data={post.footnotes as EditorJSData}
              renderers={customRenderers}
              config={defaultEJSRConfigs}
            />
          </div>
        </aside>
      )}

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
  className = "",
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
        <article
          className={`blog-card ${className} ${onClick ? "blog-card--clickable" : ""}`}
          onClick={onClick}
        >
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
          {post.isFeatured && (
            <span className="blog-card__featured-badge">Featured</span>
          )}
        </div>
      )}

      <div className="blog-card__body">
        {/* Content Type Badge */}
        {post.contentType && post.contentType !== "blog" && (
          <span className="blog-card__type-badge">{post.contentType}</span>
        )}

        {/* Title */}
        <h2 className="blog-card__title">{post.title}</h2>

        {/* Excerpt */}
        {showExcerpt && post.excerpt && (
          <p className="blog-card__excerpt">{post.excerpt}</p>
        )}

        {/* Metadata */}
        {showMetadata && (
          <div className="blog-card__meta">
            {post.authorName && (
              <span className="blog-card__author">{post.authorName}</span>
            )}
            {post.publishedAt && (
              <time className="blog-card__date">
                {formatDate(post.publishedAt)}
              </time>
            )}
            {post.readingTimeMinutes && (
              <span className="blog-card__reading-time">
                {post.readingTimeMinutes} min
              </span>
            )}
          </div>
        )}
      </div>
    </Wrapper>
  );
}

export default BlogRenderer;

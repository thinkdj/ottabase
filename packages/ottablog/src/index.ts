/**
 * @ottabase/ottablog
 *
 * Blog and content management system for Ottabase apps.
 * Supports blog posts, changelogs, documentation, and more.
 *
 * Features:
 * - Multiple content types (blog, changelog, docs, news, announcement)
 * - EditorJS integration via OttaEditor
 * - SEO metadata support
 * - Hero images with Cloudflare Images integration
 * - Categories with hierarchy support
 * - PostTag model for blog-specific tags (with color, type)
 * - Multi-app database sharing via appId
 * - Reading time calculation
 * - Slug generation
 *
 * Note: For universal/non-blog tags, use Tag from @ottabase/ottaorm
 *
 * @example
 * ```typescript
 * import {
 *   Post,
 *   PostCategory,
 *   PostTag,
 *   PostTagLink,
 *   postsTable,
 *   categoriesTable,
 *   postTagsTable,
 *   generateSlug,
 *   CONTENT_TYPES,
 * } from "@ottabase/ottablog";
 * ```
 */

// Models + schema exports (fat models)
export {
    categoriesTable,
    OttablogPlugin,
    ottablogPluginsTable,
    OttablogTheme,
    ottablogThemesTable,
    Post,
    PostCategory,
    PostCategoryLink,
    postCategoryLinksTable,
    PostSeries,
    postsTable,
    PostTag,
    PostTagLink,
    postTagLinksTable,
    postTagsTable,
    PostVersion,
    postVersionsTable,
    seriesTable,
} from './ottaorm-models';

// Type exports from models
export type {
    Category,
    NewCategory,
    NewOttablogPluginType,
    NewOttablogThemeType,
    NewPost,
    NewPostCategoryLinkType,
    NewPostCategoryType,
    NewPostSeriesType,
    NewPostTagLinkType,
    NewPostTagType,
    NewPostType,
    NewPostVersion,
    NewPostVersionType,
    NewSeries,
    OttablogPluginType,
    OttablogThemeType,
    Post,
    PostCategoryLinkType,
    PostCategoryType,
    PostSeriesType,
    PostTag,
    PostTagLink,
    PostTagLinkType,
    PostTagType,
    PostType,
    PostVersion,
    PostVersionType,
    Series,
} from './ottaorm-models';

// Type exports
export type { ContentType, EditorJSData, HeroImage, PostAuthor, PostStatus, ReadingTime, SeoMeta } from './types';

// Constants and helpers
export {
    calculateReadingTime,
    CONTENT_TYPES,
    DEFAULT_SEO_META,
    extractExcerpt,
    formatDate,
    formatShortDate,
    generateSlug,
    POST_STATUSES,
} from './types';

// Slug utilities (shared across models)
export { normalizeSlugInput, resolveUniqueSlug } from './slug-utils';
export type { SlugLifecycleConfig, SlugScope } from './slug-utils';

// Components (React)
export { BlogExcerptCard, BlogRenderer } from './components/BlogRenderer';
export type { BlogExcerptCardProps, BlogPostData, BlogRendererProps } from './components/BlogRenderer';
export { BlogRendererErrorBoundary } from './components/BlogRendererErrorBoundary';

// Hooks System
export * from './hooks';

// Theme System
export * from './themes';

// Plugin System
export * from './plugins';

// Studio (themes/plugins management)
export * from './studio';

// Initialization
export { initOttablog } from './init';

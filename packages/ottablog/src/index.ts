/**
 * @ottabase/ottablog
 *
 * Blog and content management system for Ottabase apps.
 * Supports articles, blurbs, photo journals, changelogs, documentation, and more.
 *
 * Features:
 * - Multiple content types (blog, blurb, photo, changelog, docs, news, announcement)
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
    BlurbWriteOptions,
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
    PostCategoryLinkType,
    PostCategoryType,
    PostSeriesType,
    PostTagLinkType,
    PostTagType,
    PostType,
    PostVersionType,
    PhotoJournalWriteOptions,
    Series,
} from './ottaorm-models';

// Type exports
export type {
    ContentType,
    EditorJSData,
    HeroImage,
    PhotoJournalItem,
    PostAuthor,
    PostCrosspost,
    PostStatus,
    ReadingTime,
    SeoMeta,
} from './types';

// Constants and helpers
export {
    calculateReadingTime,
    BLURB_MAX_LENGTH,
    BlurbValidationError,
    ContentValidationError,
    CONTENT_TYPES,
    contentTypeLabel,
    createBlurbExcerpt,
    createBlurbTitle,
    createPhotoJournalExcerpt,
    createPhotoJournalTitle,
    CROSSPOST_URL_MAX_LENGTH,
    crosspostLabel,
    CrosspostValidationError,
    DEFAULT_SEO_META,
    extractExcerpt,
    formatDate,
    formatShortDate,
    generateSlug,
    MAX_CROSSPOSTS,
    normalizeBlurbText,
    PHOTO_JOURNAL_MAX_ITEMS,
    PHOTO_JOURNAL_NOTE_MAX_LENGTH,
    PhotoJournalValidationError,
    POST_CONTENT_MAX_BYTES,
    PostContentValidationError,
    POST_STATUSES,
    validateBlurbText,
    validateCrossposts,
    validatePhotoJournalItems,
    validatePhotoJournalNote,
    validatePostContent,
    validatePostWrite,
} from './types';

// Slug utilities (shared across models)
export { normalizeSlugInput, resolveUniqueSlug } from './slug-utils';
export type { SlugLifecycleConfig, SlugScope } from './slug-utils';

// Migrations (org-mode index swap; register conditionally in the app's migration registry)
export { ottablogOrgModeMigrations, ottablogOrgModeSuppressedIndexes } from './migrations';

// Draft preview tokens (Web Crypto HMAC; used by the router's ?preview= path)
export { signPreviewToken, verifyPreviewToken } from './preview-token';

// Blog theme tokens: sparse CSS-variable overrides for the [data-brand-scope="blog"] room
export { blogThemeTokensToCss } from './theme-tokens';
export type { BlogThemeCssOptions, BlogThemeTokens } from './theme-tokens';
export type { PreviewTokenPayload } from './preview-token';

// SEO builders for edge-injected per-post meta (pure, React-free)
export { buildPostSeoTags, escapeHtml, extractBlogSlugFromPath, jsonForScriptTag, replaceDocumentTitle } from './seo';
export type { PostSeoInput } from './seo';

// Blog-renderer prop/data types (pure, type-only). The rendered components (BlogRenderer,
// BlogExcerptCard, BlogRendererErrorBoundary), the default/minimal themes, and initOttablog are
// UI — import them from the '@ottabase/ottablog/renderer' subpath.
export type {
    BlurbRendererProps,
    BlogExcerptCardProps,
    BlogPostData,
    BlogRendererProps,
    PhotoJournalRendererProps,
} from './components/blog-renderer-types';

// Hooks System
export * from './hooks';

// Theme System (pure): registry + types only. The rendered default/minimal themes live behind
// '@ottabase/ottablog/renderer'; re-exporting the barrel here would leak @ottabase/ottarenderer.
export {
    getActiveTheme,
    getAllThemes,
    getTheme,
    hasTheme,
    registerTheme,
    setActiveTheme,
    themeRegistry,
} from './themes/registry';
export type { Theme, ThemeConfig, ThemeMetadata, ThemeRegistry, ThemeRenderers } from './themes/types';

// Plugin System
export * from './plugins';

// Studio (themes/plugins management)
export * from './studio';
